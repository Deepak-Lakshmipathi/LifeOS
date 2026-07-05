/**
 * router — owner guard + photo batch-confirm + confirm-destructive gate +
 * Claude NLU + intent dispatch (S16b, ADR-0011; photo branch + confirm-check
 * branch added S19b, ADR-0012 Decisions 3, 4; update/delete confirm-gate
 * added S17, ADR-0013 Decision 4).
 *
 * `dispatchIntent` is the generic seam described in ADR-0011 Decision 4:
 * getIntentHandler(name)?.handle(params, ctx) ?? "not yet supported". It
 * accepts any classified intent name — Claude's own "other", or a future
 * name that has no registered handler yet — and never touches the vault
 * when no handler is found.
 *
 * `handleIncomingMessage` is the full per-message pipeline: the owner guard
 * runs first and is a complete no-op for any other chat id (no Claude call,
 * no vault write, no reply). After the owner guard, a photo message never
 * reaches NLU — it's downloaded, vision-extracted, and turned into a
 * pending batch-confirm prompt (ADR-0012 Decision 4: photo is not a
 * classified intent, there's nothing to classify). A text message while a
 * photo batch is pending is parsed as all/none/subset instead of being
 * classified. Next, a text message while an update/delete confirmation is
 * pending (confirm/store.ts — an independent Map from the photo batch
 * above) is resolved by confirm/gate.ts's resolvePending instead of being
 * classified: a bare "y"/"n" is not itself a classifiable intent, and
 * running it through Claude would be a wasted call at best and a
 * misclassification risk at worst (ADR-0013 Decision 3). Otherwise, the
 * existing Claude-classify + dispatch flow is unchanged.
 */

import './intents/index' // side effect: registers every shipped intent handler
import { getIntentHandler } from './intents/registry'
import type { BotContext } from './intents/types'
import { handleCreate } from './intents/create'
import { classifyAndExtract, type ClaudeClient } from './nlu'
import type { TelegramClient, TelegramMessage } from './telegramClient'
import { extractTasksFromImage, type ExtractedTask } from './visionExtract'
import { setPending, getPending, clearPending, type PendingPhotoConfirmation } from './photoConfirm'
import { resolvePending } from './confirm/gate'
import type { VaultTransport } from '../../src/vault/transport'

export const NOT_YET_SUPPORTED = 'not yet supported'

const NO_TASKS_FOUND_REPLY = "Couldn't find any tasks in that photo."
const PHOTO_DOWNLOAD_FAILED_REPLY = "Couldn't download that photo — try sending it again."
const CANCELLED_REPLY = 'Cancelled.'
const INSTRUCTION_LINE = (count: number) =>
  `Reply 'all' to create all ${count}, 'none' to cancel, or numbers (e.g. '1,3') for a subset.`

export interface RouterDeps {
  claudeClient: ClaudeClient
  telegramClient: TelegramClient
  vaultTransport: VaultTransport
  ownerChatId: string
}

/** Dispatches a classified intent name to its registered handler, or the fallback reply. */
export async function dispatchIntent(name: string, params: unknown, ctx: BotContext): Promise<string> {
  const handler = getIntentHandler(name)
  if (!handler) return NOT_YET_SUPPORTED
  return handler.handle(params, ctx)
}

/** One numbered confirm-prompt line: `N. title · domain-or-Inbox · P<priority>`. */
function formatTaskLine(index: number, task: ExtractedTask): string {
  const domainLabel = task.domain ?? 'Inbox'
  const prioritySegment = task.priority !== undefined ? ` · P${task.priority}` : ''
  return `${index + 1}. ${task.title} · ${domainLabel}${prioritySegment}`
}

function buildConfirmPrompt(tasks: ExtractedTask[]): string {
  const lines = tasks.map((task, i) => formatTaskLine(i, task))
  return [...lines, INSTRUCTION_LINE(tasks.length)].join('\n')
}

/** Parses a confirm-check reply into selected 1-based indices, or a sentinel outcome. */
type ConfirmParseResult =
  | { kind: 'indices'; indices: number[] }
  | { kind: 'cancel' }
  | { kind: 'invalid' }

const SUBSET_PATTERN = /^\d+(,\d+)*$/

function parseConfirmReply(text: string, taskCount: number): ConfirmParseResult {
  const normalized = text.trim().toLowerCase()

  if (normalized === 'all' || normalized === 'y') {
    return { kind: 'indices', indices: taskCount > 0 ? Array.from({ length: taskCount }, (_, i) => i) : [] }
  }

  if (normalized === 'none' || normalized === 'n') {
    return { kind: 'cancel' }
  }

  if (SUBSET_PATTERN.test(normalized)) {
    const indices = normalized.split(',').map((n) => Number(n) - 1)
    if (indices.every((i) => i >= 0 && i < taskCount)) {
      return { kind: 'indices', indices }
    }
  }

  return { kind: 'invalid' }
}

/**
 * Owner-guard + photo batch-confirm + Claude NLU + dispatch + reply
 * pipeline for one incoming Telegram message. A message from any chat id
 * other than deps.ownerChatId is a complete no-op (PRD "Owner guard").
 */
export async function handleIncomingMessage(msg: TelegramMessage, deps: RouterDeps): Promise<void> {
  if (msg.chatId !== deps.ownerChatId) return

  const ctx: BotContext = { vaultTransport: deps.vaultTransport, chatId: msg.chatId }

  if (msg.photoFileId) {
    await handlePhotoMessage(msg.chatId, msg.photoFileId, msg.caption, deps)
    return
  }

  const pendingBatch = msg.text ? getPending(msg.chatId) : undefined
  if (pendingBatch) {
    await handleConfirmReply(msg.chatId, msg.text, pendingBatch, ctx, deps)
    return
  }

  // Confirm-destructive gate (S17, ADR-0013 Decisions 3-4) — an independent
  // pending-state Map from the photo batch above; null means nothing is
  // pending for this chat and the message falls through to NLU as today.
  const pendingReply = await resolvePending(msg.chatId, msg.text, ctx)
  if (pendingReply !== null) {
    await deps.telegramClient.sendMessage(msg.chatId, pendingReply)
    return
  }

  const extracted = await classifyAndExtract(deps.claudeClient, msg.text)
  const reply = await dispatchIntent(extracted.intent, extracted, ctx)
  await deps.telegramClient.sendMessage(msg.chatId, reply)
}

async function handlePhotoMessage(
  chatId: string,
  photoFileId: string,
  caption: string | undefined,
  deps: RouterDeps,
): Promise<void> {
  let image: { data: Buffer; mediaType: string }
  try {
    image = await deps.telegramClient.downloadPhoto(photoFileId)
  } catch {
    await deps.telegramClient.sendMessage(chatId, PHOTO_DOWNLOAD_FAILED_REPLY)
    return
  }

  const tasks = await extractTasksFromImage(deps.claudeClient, image, caption)

  if (tasks.length === 0) {
    await deps.telegramClient.sendMessage(chatId, NO_TASKS_FOUND_REPLY)
    return
  }

  setPending(chatId, tasks)
  await deps.telegramClient.sendMessage(chatId, buildConfirmPrompt(tasks))
}

async function handleConfirmReply(
  chatId: string,
  text: string,
  batch: PendingPhotoConfirmation,
  ctx: BotContext,
  deps: RouterDeps,
): Promise<void> {
  const parsed = parseConfirmReply(text, batch.tasks.length)

  if (parsed.kind === 'cancel') {
    clearPending(chatId)
    await deps.telegramClient.sendMessage(chatId, CANCELLED_REPLY)
    return
  }

  if (parsed.kind === 'invalid') {
    await deps.telegramClient.sendMessage(chatId, INSTRUCTION_LINE(batch.tasks.length))
    return
  }

  const confirmations: string[] = []
  for (const index of parsed.indices) {
    const task = batch.tasks[index]!
    // Sequential, not Promise.all — one git commit per task, no new
    // concurrency surface (ADR-0012 Decision 4).
    confirmations.push(await handleCreate(task, ctx))
  }

  clearPending(chatId)

  const reply =
    confirmations.length > 1
      ? [`✓ added ${confirmations.length} tasks:`, ...confirmations].join('\n')
      : confirmations[0]!

  await deps.telegramClient.sendMessage(chatId, reply)
}
