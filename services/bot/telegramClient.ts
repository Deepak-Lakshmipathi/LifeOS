/**
 * telegramClient — long-poll Telegram Bot API wrapper (S16b, ADR-0011 Decision 1;
 * photo detection + download added S19a, ADR-0012 Decision 5).
 *
 * The TelegramClient interface is the only contract the router/handler logic
 * depends on — tests inject a fake implementation, never RealTelegramClient
 * (mirrors VaultTransport's interface-vs-implementation split, ADR-0009).
 *
 * RealTelegramClient calls the actual Telegram Bot API (getUpdates long-poll +
 * sendMessage) via native fetch (Node 20+). It is this ticket's responsibility
 * to write, but per S16b's scope it is not exercised end-to-end in CI — live
 * verification is the S16c HITL follow-up, mirroring GitTransport (S15b).
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org'

export interface TelegramMessage {
  chatId: string
  text: string
  /** Highest-resolution file_id from update.message.photo, when the message is a photo. */
  photoFileId?: string
  /** update.message.caption, when the photo (or message) carries one. */
  caption?: string
}

/** The only contract router/handler logic depends on — program to this, not RealTelegramClient. */
export interface TelegramClient {
  pollUpdates(onMessage: (msg: TelegramMessage) => void | Promise<void>): void
  sendMessage(chatId: string, text: string): Promise<void>
  /**
   * Two-step Telegram file fetch (getFile → HTTPS download). mediaType is
   * always 'image/jpeg' — Telegram re-encodes compressed `photo` uploads as
   * JPEG server-side, so no content-sniffing is needed (ADR-0012 Decision 5).
   * Throws on any fetch failure or a getFile `ok: false` response — the
   * caller (S19b's router branch) is responsible for catching it.
   */
  downloadPhoto(fileId: string): Promise<{ data: Buffer; mediaType: string }>
}

interface TelegramUpdate {
  update_id: number
  message?: {
    chat: { id: number }
    text?: string
    photo?: Array<{ file_id: string }>
    caption?: string
  }
}

interface GetFileResponse {
  ok: boolean
  result: { file_path: string }
}

interface GetUpdatesResponse {
  ok: boolean
  result: TelegramUpdate[]
}

/** Real long-poll client — not covered by S16b's CI tests (no live network in CI). */
export class RealTelegramClient implements TelegramClient {
  private offset = 0
  private polling = false

  constructor(private readonly token: string) {}

  pollUpdates(onMessage: (msg: TelegramMessage) => void | Promise<void>): void {
    this.polling = true
    void this.loop(onMessage)
  }

  /** Stops the poll loop after the in-flight getUpdates call returns. */
  stop(): void {
    this.polling = false
  }

  private async loop(onMessage: (msg: TelegramMessage) => void | Promise<void>): Promise<void> {
    while (this.polling) {
      try {
        const res = await fetch(
          `${TELEGRAM_API_BASE}/bot${this.token}/getUpdates?timeout=30&offset=${this.offset}`,
        )
        const data = (await res.json()) as GetUpdatesResponse
        if (!data.ok) continue

        for (const update of data.result) {
          this.offset = update.update_id + 1
          const text = update.message?.text
          const chatId = update.message?.chat.id
          const photo = update.message?.photo
          const caption = update.message?.caption
          // Telegram orders photo variants smallest-to-largest resolution;
          // the last element is the highest-resolution one.
          const photoFileId = photo && photo.length > 0 ? photo[photo.length - 1].file_id : undefined

          if (chatId !== undefined && (text !== undefined || photoFileId !== undefined)) {
            await onMessage({
              chatId: String(chatId),
              text: text ?? '',
              ...(photoFileId !== undefined ? { photoFileId } : {}),
              ...(caption !== undefined ? { caption } : {}),
            })
          }
        }
      } catch {
        // Best-effort long-poll loop — network hiccups retry on the next
        // iteration rather than crashing the worker (no retry/backoff tuning
        // in this slice — PRD "Out of Scope").
      }
    }
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    await fetch(`${TELEGRAM_API_BASE}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
  }

  async downloadPhoto(fileId: string): Promise<{ data: Buffer; mediaType: string }> {
    const fileRes = await fetch(`${TELEGRAM_API_BASE}/bot${this.token}/getFile?file_id=${fileId}`)
    const fileData = (await fileRes.json()) as GetFileResponse
    if (!fileData.ok) {
      throw new Error(`Telegram getFile failed for file_id ${fileId}`)
    }

    const downloadRes = await fetch(
      `${TELEGRAM_API_BASE}/file/bot${this.token}/${fileData.result.file_path}`,
    )
    const data = Buffer.from(await downloadRes.arrayBuffer())

    return { data, mediaType: 'image/jpeg' }
  }
}
