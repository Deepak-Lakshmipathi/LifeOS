## Problem Statement

S16 let the owner capture a task by texting the bot from anywhere — but typing is still friction, and the whole point of a bot-in-the-pocket is capturing a thought the instant it occurs, often hands-busy (driving, walking, cooking). "Call the CA about GST" thought of at a red light gets lost by the time the owner can type it. The intent pipeline (Claude NLU → structured task → vault write) already exists and works from text; nothing yet gets a spoken thought into that pipeline.

## Solution

Add Telegram **voice notes** as a second way to reach the exact same intent pipeline S16 built (and S17 extends, if merged). The owner sends a voice message instead of typing; the bot downloads the audio via Telegram's file API, transcribes it to text via a hosted speech-to-text API (Groq's Whisper endpoint — ADR-0014 Decision 1), and feeds the transcript into the **unmodified** `classifyAndExtract` → `dispatchIntent` router exactly as if it had been typed. No new intent type, no fork of the create/update/delete logic — voice is purely a new front door on the message-ingest layer. Because it reuses the router's existing dispatch by name, whatever intents happen to be registered when this ships (today: `create`; `update`/`delete` too, if S17 has landed) are reachable by voice for free.

Telegram voice notes are already OGG/Opus — the same format Groq's transcription API accepts natively, so no audio transcoding step is needed (ADR-0014 Decision 2). Because a mis-heard word could silently trigger the wrong action (especially dangerous once S17's destructive update/delete land), the transcript is only handed to the NLU pipeline when the transcription API reports it's confident; a low-confidence or empty transcription instead gets a friendly "try typing that" reply with **no** Claude call and **no** vault write (ADR-0014 Decision 3). Every successful voice-triggered action echoes the transcript in the reply ("heard: '…' → ✓ added …") so the owner can catch a mis-hear before trusting the result.

## User Stories

1. As the owner, I want to send a voice note to the bot and have it become a task, so that I can capture a thought hands-free.
2. As the owner, I want the bot to show me what it heard before/alongside confirming the action, so that I can catch a mis-transcription immediately.
3. As the owner, if the bot couldn't transcribe clearly, I want it to ask me to retype rather than guess and act, so that a bad transcription never silently creates or (once S17 lands) edits/deletes the wrong thing.
4. As the owner, I want voice notes to go through the exact same rules text messages do (owner guard, domain/Inbox fallback, confirm-destructive once S17 ships), so that the bot behaves consistently regardless of how I talk to it.
5. As a maintainer, I want the transcription provider hidden behind a small interface, so that swapping providers later (cost, quality, self-hosted) touches one file, not the router or intent handlers.
6. As a maintainer, I want voice handling added without touching `services/bot/intents/**` or `nlu.ts`, so that S18 cannot conflict with S17's parallel work on those same files.
7. As the owner, I want create to still fire instantly from a confident voice transcript (no extra confirmation beyond what text already requires), so that voice capture is exactly as fast as the text path once heard correctly.

## Implementation Decisions

See [ADR-0014](../docs/adr/0014-bot-voice-transcription.md) for full rationale; summary:

- **Transcription provider: Groq's hosted Whisper API** (`whisper-large-v3-turbo`, OpenAI-compatible `/v1/audio/transcriptions` endpoint), called via native `fetch`/`FormData` — no new SDK dependency, matching `telegramClient.ts`'s existing raw-fetch style. New env var `GROQ_API_KEY` (config.ts, `.env.example`, README). Behind a new `Transcriber` interface (`services/bot/transcription.ts`) mirroring `nlu.ts`'s `ClaudeClient`/`createClaudeClient` split — tests inject a fake, never the real network call.
- **No audio transcoding.** Telegram voice notes are OGG/Opus; Groq's API accepts `ogg` natively. Raw bytes downloaded via a new `TelegramClient.downloadVoiceFile(fileId)` (Telegram's `getFile` → file URL fetch, two calls) are POSTed unmodified.
- **Confidence-gated routing.** `Transcriber.transcribe` never throws (mirrors `classifyAndExtract`'s contract) — any error maps to `{ text: '', confident: false }`. Confident = non-empty trimmed text AND mean Whisper `no_speech_prob` (verbose_json) `<= 0.5`. Not confident → fixed retype reply, no NLU call, no vault write. Confident → transcript flows into the existing `classifyAndExtract`/`dispatchIntent` pipeline unchanged; reply is prefixed `heard: '<transcript>' → <normal reply>`.
- **Message shape:** `TelegramMessage` gains an optional `voice: { fileId: string }` alongside the now-optional `text`. `router.ts`'s `handleIncomingMessage` branches on `msg.voice` right after the existing owner guard.
- **Ships AFK, not HITL.** Unlike S16c (first live vault git write, HITL by construction), S18 adds only read-only network calls (Telegram file download, Groq transcription) — any resulting vault write reuses S16/S16c's already-hand-verified `create.ts` → `VaultTransport` path unchanged. A non-blocking README note recommends the owner smoke-test transcript quality against real audio after deploy.
- **Depends on S16 only, not S17** (deliberate decoupling — the three Group-E modality slices, S17/S18/S19, are running in parallel; S18 reuses the router's existing dispatch-by-name so it works whether or not S17's `update`/`delete` handlers are registered yet).
- **Write-set:** `services/bot/telegramClient.ts`, `services/bot/transcription.ts` (new), `services/bot/router.ts`, `services/bot/reply.ts`, `services/bot/config.ts`, `services/bot/index.ts`, plus each file's test, `.env.example`, `README.md`. **Do NOT touch** `services/bot/intents/**` or `services/bot/nlu.ts` (S17's territory / unchanged S16 logic respectively).

## Out of Scope

- Photo capture (S19). Multi-language transcription tuning beyond the owner's language. Long-audio chunking (Telegram's own file-size ceiling applies; a file it can't serve surfaces as the same "couldn't transcribe" reply). Any change to intent classification logic, the intent-router registry, or the create/update/delete handlers themselves.
