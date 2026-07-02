# Bot voice notes: Groq Whisper transcription, no transcoding, confidence-gated retype

Status: **Accepted**. Extends [ADR-0011](0011-bot-transport-identity-router.md) (bot transport, auth, `id::`, intent-router seam). Implements [Slice S18](../slices/slice-S18-bot-voice.md).

S18 adds Telegram **voice notes** as a second message modality alongside S16's text path. Resolved in `afk-pipeline auto` mode (headless self-grill, architect + engineer/ponytail lenses) per ADR-0011's own precedent for this project. Three design calls the slice brief leaves open are resolved here: the transcription provider + key config, audio-format handling, and error/low-confidence handling.

## Framing — a modality, not an intent

Per the slice brief and ADR-0011 Decision 4, S18 is explicitly **not** a new `IntentName`. Voice is a front-end to the *same* `classifyAndExtract` → `dispatchIntent` pipeline S16 already ships: a voice message is downloaded, transcribed to text, and from that point on flows through the router exactly as if the owner had typed the transcript. `services/bot/intents/*` (registry, types, create.ts) and `services/bot/nlu.ts`'s `classifyAndExtract` are **untouched** — the change is confined to the message-ingest layer (`telegramClient.ts`, `router.ts`) plus one new transcription adapter module. This also decouples S18 from S17: whatever intents are registered when S18 lands (today, only `create`; `update`/`delete` if S17 has merged) are reachable from a voice transcript for free, because voice reuses the router's existing dispatch, not a parallel one.

## Decision 1 — Transcription provider: Groq's hosted Whisper API, behind a `Transcriber` interface

**Decision:** transcribe via Groq's OpenAI-compatible `POST https://api.groq.com/openai/v1/audio/transcriptions` endpoint, model `whisper-large-v3-turbo`, called with native `fetch` + `FormData` (Node 20+, no new SDK dependency) — the same "raw fetch, no vendor SDK" style `telegramClient.ts` already uses for the Telegram Bot API. Config: one new required env var, `GROQ_API_KEY`, loaded in `config.ts` alongside the existing secrets (never logged, per ADR-0011 Decision 2's convention).

**Why Groq over OpenAI's own Whisper endpoint:** both are viable (OpenAI's `audio/transcriptions` accepts the same input formats); Groq is chosen for cost + latency fit on a single-owner, low-volume personal bot — same rationale ADR-0011 Decision 2's HITL note (B) used to pin `claude-sonnet-5` over Opus for the NLU call. The two APIs share the same multipart request shape, so swapping providers later is a same-file change behind the interface below, not a router/intent change.

**Interface (`services/bot/transcription.ts`, new file):**
```ts
export interface TranscriptionResult {
  text: string
  /** false ⇒ router must NOT feed this into the intent pipeline (Decision 3). */
  confident: boolean
}

export interface Transcriber {
  transcribe(audio: Buffer, mimeType: string): Promise<TranscriptionResult>
}

export function createTranscriber(apiKey: string): Transcriber // GroqTranscriber
```
Mirrors `nlu.ts`'s `ClaudeClient`/`createClaudeClient` split: a narrow interface the router/tests program against, a factory that builds the real implementation, tests inject a fake `Transcriber` (never the real one) — same pattern `router.test.ts` already uses for `ClaudeClient`.

**Rejected:** calling Claude for transcription — Claude's messages API does not do audio-to-text ASR; a dedicated speech-to-text model is required, so this is not a "reuse the existing Anthropic client" case. Rejected a local/self-hosted Whisper model (`whisper.cpp`, `@xenova/transformers`) — adds a multi-hundred-MB model download and CPU-bound inference to a Node worker process that otherwise has zero heavy compute, for a single-owner bot where a hosted API call is simpler and cheaper than owning the inference (ponytail: laziest solution that works).

## Decision 2 — Audio format: pass Telegram's OGG/Opus straight through, no transcoding

**Decision:** no ffmpeg, no audio-conversion library. Telegram voice notes are always OGG container / Opus codec (Telegram Bot API's own `sendVoice` spec — `audio/ogg`); Groq's transcription endpoint's documented supported-format list explicitly includes `ogg`. Download the raw bytes via Telegram's two-step file API and POST them to Groq unmodified as `voice.ogg` (`audio/ogg`).

**Download path (`telegramClient.ts`):** `TelegramClient` gains `downloadVoiceFile(fileId: string): Promise<Buffer>` — calls `getFile` (`GET /bot<token>/getFile?file_id=<id>`) to resolve `file_path`, then fetches `https://api.telegram.org/file/bot<token>/<file_path>` and returns the body as a `Buffer`. `RealTelegramClient` implements it; tests inject a fake (same "interface is the only contract, never `RealTelegramClient`" rule the file's own header comment already states for `pollUpdates`/`sendMessage`).

**`TelegramMessage` shape change:** `{ chatId: string; text?: string; voice?: { fileId: string } }` — `text` becomes optional (a voice-only message carries no caption text), `voice` is new and optional. `RealTelegramClient`'s update-parsing loop reads `update.message?.voice?.file_id` alongside the existing `update.message?.text`; a message needs at least one of the two to reach `onMessage`.

**Rejected:** transcoding to WAV/MP3 before upload (via ffmpeg or a WASM codec) — adds a native-binary or multi-MB WASM dependency to convert between two formats a hosted ASR API already accepts natively; no correctness or quality benefit, pure added complexity (ponytail). Revisit only if a future provider swap (Decision 1) picks a provider that doesn't accept `ogg`.

**Out of scope (per the slice brief's non-goals):** long-audio chunking. Telegram's `getFile` has its own size ceiling for bot-accessible files; a file it can't serve surfaces as a fetch/JSON error from `downloadVoiceFile`, which Decision 3's error handling already catches and maps to the same "couldn't catch that" reply — no bespoke handling needed.

## Decision 3 — Error + low-confidence handling: never throw, gate on a confidence check, ask to retype

**Decision:** `GroqTranscriber.transcribe` **never throws** — mirrors `nlu.ts`'s `classifyAndExtract` contract exactly (any network error, non-2xx response, or unparseable body is caught and mapped to `{ text: '', confident: false }`). Request Groq's `verbose_json` response format, which returns Whisper's native per-segment `no_speech_prob`. `confident` is `true` only when **both**: (a) the returned `text`, trimmed, is non-empty, and (b) the mean `no_speech_prob` across `segments` is `<= 0.5` (an empty/missing `segments` array counts as not confident).

**Router behavior (`router.ts`):** after the existing owner guard, a message with `msg.voice` set is downloaded and transcribed *before* any Claude NLU call. If `confident === false`, the router replies with a fixed prompt — `"Couldn't quite catch that — mind typing it instead?"` — and returns immediately: **no** `classifyAndExtract` call, **no** vault write. This mirrors the owner-guard's "complete no-op below this gate" shape (ADR-0011 §"owner guard first"). If `confident === true`, the transcript is fed into the *unmodified* `classifyAndExtract` → `dispatchIntent` pipeline exactly as S16's text path does, and the reply is prefixed with the transcript for transparency (slice acceptance criterion: "reply shows the transcript + the action taken") — `heard: '<transcript>' → <inner reply>`, e.g. `heard: 'call the CA about GST' → ✓ added 'Call the CA about GST' · Finance`. The prefix-building helper lives in `reply.ts` next to `buildCreateReply`.

**Rejected:** silently feeding a low-confidence transcript into the intent pipeline anyway — for a **confirm-destructive** trust model (ADR-0011 lays the groundwork S17 builds on), a mis-transcribed "delete" is exactly the failure mode the echo-and-confirm philosophy exists to prevent; refusing to act on an unclear transcript is the same reversible-explicit posture the slice brief calls out. Rejected surfacing the raw error/exception message to the owner in Telegram — a fixed, friendly retype prompt is simpler and avoids leaking API/network internals into a chat UI, consistent with `create.ts`'s existing `UNCLEAR_REPLY` pattern for unparseable input.

## Write-set (this slice's diff, nothing else)

`services/bot/telegramClient.ts` (extend `TelegramMessage`/`TelegramClient`/`RealTelegramClient`), `services/bot/transcription.ts` (new), `services/bot/transcription.test.ts` (new), `services/bot/router.ts` (voice branch + `RouterDeps.transcriber`), `services/bot/router.test.ts` (extend), `services/bot/reply.ts` (heard-prefix helper), `services/bot/reply.test.ts` (extend), `services/bot/config.ts` (+ `GROQ_API_KEY`), `services/bot/config.test.ts` (extend), `services/bot/index.ts` (wire `createTranscriber` into deps), `services/bot/.env.example`, `services/bot/README.md`.

**Do NOT touch:** `services/bot/intents/**` (registry, types, create.ts — ADR-0011 Decision 4: not this slice's file), `services/bot/nlu.ts` (classification/extraction unchanged — voice only supplies its input text), `src/vault/**`, `src/sync/**`, `src/types/**`, `src/data/domains.ts`.

## HITL vs AFK — this slice ships AFK, not HITL

Unlike S16c (real git transport + live Telegram wiring, HITL by construction — PR #69), S18 does **not** get a HITL flag. Reasoning: S16c was HITL because it was the *first* slice to exercise a real `git commit`/push against the real vault, a destructive, hard-to-unit-test operation. S18 introduces two new "real" network calls (`RealTelegramClient.downloadVoiceFile`, `GroqTranscriber.transcribe`) that are **read-only against Telegram/Groq** — neither one performs a vault write. Any eventual vault write from a voice-derived `create` still flows through the exact same `create.ts` → `VaultTransport` path S16b/S16c already shipped and hand-verified; S18 adds no new write surface. This mirrors how `RealTelegramClient.sendMessage`/`pollUpdates` and `createClaudeClient` (S16b's own "real" implementations) shipped without a HITL gate — only the code that touches the vault's git history earned that bar.

**Documented assumption (auto-mode):** transcription *quality* against real audio (accents, background noise, Telegram's Opus compression) cannot be verified by a fixture-audio unit test alone. Recorded here as a non-blocking follow-up: the owner should send a few real voice notes after deploy and confirm the transcript + confidence gate behave as expected (README gets a short manual-smoke-test note, not a merge gate).

## Slicing

S18 ships as a single tracer-bullet slice (thin end-to-end vertical: Telegram voice in → download → transcribe → confidence gate → existing intent pipeline → transcript-echoing reply), same granularity as S16b. See `docs/slices/slice-S18-bot-voice.md` for acceptance criteria and the to-issues breakdown for the concrete file list / test names.
