/**
 * transcription — Groq Whisper transcription adapter (S18, ADR-0014
 * Decisions 1 + 3).
 *
 * Mirrors nlu.ts's ClaudeClient/createClaudeClient split: a narrow
 * Transcriber interface the router/tests program against, and a factory
 * that builds the real Groq-backed implementation. Tests inject a fake
 * Transcriber — never GroqTranscriber directly.
 *
 * GroqTranscriber.transcribe NEVER throws — any fetch error, non-2xx
 * response, or unparseable JSON body is caught and mapped to
 * { text: '', confident: false }, matching classifyAndExtract's own
 * never-throw contract so the router can call it unconditionally.
 */

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_MODEL = 'whisper-large-v3-turbo'

/** false ⇒ router must NOT feed this into the intent pipeline (ADR-0014 Decision 3). */
export interface TranscriptionResult {
  text: string
  confident: boolean
}

/** The only contract router/handler logic depends on — program to this, not GroqTranscriber. */
export interface Transcriber {
  transcribe(audio: Buffer, mimeType: string): Promise<TranscriptionResult>
}

interface GroqSegment {
  no_speech_prob?: number
}

interface GroqTranscriptionResponse {
  text?: string
  segments?: GroqSegment[]
}

/** true only when the text is non-empty AND the mean no_speech_prob across segments is <= 0.5. */
function isConfident(text: string, segments: GroqSegment[] | undefined): boolean {
  if (text.trim().length === 0) return false
  if (!segments || segments.length === 0) return false

  const probs = segments.map((segment) => segment.no_speech_prob ?? 0)
  const meanNoSpeechProb = probs.reduce((sum, p) => sum + p, 0) / probs.length

  return meanNoSpeechProb <= 0.5
}

class GroqTranscriber implements Transcriber {
  constructor(private readonly apiKey: string) {}

  async transcribe(audio: Buffer, mimeType: string): Promise<TranscriptionResult> {
    try {
      const form = new FormData()
      form.append('file', new Blob([audio], { type: mimeType }), 'voice.ogg')
      form.append('model', GROQ_MODEL)
      form.append('response_format', 'verbose_json')

      const res = await fetch(GROQ_TRANSCRIPTION_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}` },
        body: form,
      })

      if (!res.ok) {
        return { text: '', confident: false }
      }

      const data = (await res.json()) as GroqTranscriptionResponse
      const text = data.text ?? ''

      return { text, confident: isConfident(text, data.segments) }
    } catch {
      return { text: '', confident: false }
    }
  }
}

export function createTranscriber(apiKey: string): Transcriber {
  return new GroqTranscriber(apiKey)
}
