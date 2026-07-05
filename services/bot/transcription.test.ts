import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTranscriber } from './transcription'

afterEach(() => {
  vi.unstubAllGlobals()
})

function fakeFetchOk(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    }),
  )
}

describe('createTranscriber / GroqTranscriber', () => {
  it('is confident when the text is non-empty and the mean no_speech_prob is low', async () => {
    fakeFetchOk({
      text: 'call the CA about GST',
      segments: [{ no_speech_prob: 0.1 }, { no_speech_prob: 0.2 }],
    })

    const transcriber = createTranscriber('fake-groq-key')
    const result = await transcriber.transcribe(Buffer.from('fake-ogg-bytes'), 'audio/ogg')

    expect(result).toEqual({ text: 'call the CA about GST', confident: true })
  })

  it('is not confident when the mean no_speech_prob is high', async () => {
    fakeFetchOk({
      text: 'maybe something',
      segments: [{ no_speech_prob: 0.8 }, { no_speech_prob: 0.9 }],
    })

    const transcriber = createTranscriber('fake-groq-key')
    const result = await transcriber.transcribe(Buffer.from('fake-ogg-bytes'), 'audio/ogg')

    expect(result.confident).toBe(false)
  })

  it('is not confident when the text is empty/whitespace-only', async () => {
    fakeFetchOk({
      text: '   ',
      segments: [{ no_speech_prob: 0.1 }],
    })

    const transcriber = createTranscriber('fake-groq-key')
    const result = await transcriber.transcribe(Buffer.from('fake-ogg-bytes'), 'audio/ogg')

    expect(result.confident).toBe(false)
  })

  it('is not confident when segments are empty or missing, even with non-empty text', async () => {
    fakeFetchOk({ text: 'hello there', segments: [] })

    const transcriber = createTranscriber('fake-groq-key')
    const result = await transcriber.transcribe(Buffer.from('fake-ogg-bytes'), 'audio/ogg')
    expect(result.confident).toBe(false)

    fakeFetchOk({ text: 'hello there' }) // segments field missing entirely
    const result2 = await transcriber.transcribe(Buffer.from('fake-ogg-bytes'), 'audio/ogg')
    expect(result2.confident).toBe(false)
  })

  it('never throws when fetch itself rejects — returns { text: "", confident: false }', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    )

    const transcriber = createTranscriber('fake-groq-key')
    const result = await transcriber.transcribe(Buffer.from('fake-ogg-bytes'), 'audio/ogg')

    expect(result).toEqual({ text: '', confident: false })
  })

  it('never throws on a non-2xx response — returns { text: "", confident: false }', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'unauthorized' }),
      }),
    )

    const transcriber = createTranscriber('fake-groq-key')
    const result = await transcriber.transcribe(Buffer.from('fake-ogg-bytes'), 'audio/ogg')

    expect(result).toEqual({ text: '', confident: false })
  })
})
