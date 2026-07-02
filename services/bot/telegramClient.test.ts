import { afterEach, describe, expect, it, vi } from 'vitest'
import { RealTelegramClient, type TelegramMessage } from './telegramClient'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RealTelegramClient photo + caption detection', () => {
  it('selects the last (highest-resolution) file_id from a photo update and carries the caption', async () => {
    const client = new RealTelegramClient('test-token')
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        result: [
          {
            update_id: 1,
            message: {
              chat: { id: 42 },
              caption: 'grocery list',
              photo: [{ file_id: 'small' }, { file_id: 'medium' }, { file_id: 'large' }],
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const messages: TelegramMessage[] = []
    client.pollUpdates((msg) => {
      messages.push(msg)
      client.stop()
    })

    await vi.waitFor(() => expect(messages.length).toBeGreaterThan(0))

    expect(messages[0]).toEqual({
      chatId: '42',
      text: '',
      photoFileId: 'large',
      caption: 'grocery list',
    })
  })

  it('still handles a plain text update (no photo/caption fields set)', async () => {
    const client = new RealTelegramClient('test-token')
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        result: [
          {
            update_id: 1,
            message: { chat: { id: 7 }, text: 'hello' },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const messages: TelegramMessage[] = []
    client.pollUpdates((msg) => {
      messages.push(msg)
      client.stop()
    })

    await vi.waitFor(() => expect(messages.length).toBeGreaterThan(0))

    expect(messages[0]).toEqual({ chatId: '7', text: 'hello' })
  })
})

describe('RealTelegramClient.downloadPhoto', () => {
  it('performs the two-step getFile -> file-download fetch and returns raw bytes + mediaType', async () => {
    const client = new RealTelegramClient('test-token')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ ok: true, result: { file_path: 'photos/file_1.jpg' } }),
      })
      .mockResolvedValueOnce({
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await client.downloadPhoto('abc123')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.telegram.org/bottest-token/getFile?file_id=abc123',
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.telegram.org/file/bottest-token/photos/file_1.jpg',
    )
    expect(result.mediaType).toBe('image/jpeg')
    expect(Buffer.compare(result.data, Buffer.from([1, 2, 3]))).toBe(0)
  })

  it('throws when the getFile response has ok: false', async () => {
    const client = new RealTelegramClient('test-token')
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: false, result: { file_path: '' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(client.downloadPhoto('bad-id')).rejects.toThrow()
  })
})
