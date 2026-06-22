# Slice S18 — Telegram bot: voice notes

> Read `docs/slices/README.md` + `CONTEXT.md` first. Claude usage → `claude-api` skill.

**Group:** E · **Depends on:** S17 · **Status:** planned

## Why
The most natural capture: talk to it from the car. A voice note → transcript → the same intent pipeline (create/update/delete with confirm-destructive).

## Scope — this slice only
- Handle Telegram voice messages: download the audio file (Telegram media API).
- Transcribe to text (speech-to-text service).
- Feed the transcript into the **existing** intent pipeline (S16/S17) — no new task logic.
- Echo the transcript in the reply so the user can see what was heard ("heard: '…' → ✓ added …").

## Out of scope
- Photo (S19). Multi-language tuning beyond the user's language. Long-audio chunking unless trivial.

## Data / model change
- None.

## Vertical
- Service: voice download → transcription adapter (behind an interface) → existing intent handler.
- Reply includes the recognized transcript for transparency.

## Acceptance criteria (done_when)
- [ ] A voice note is downloaded, transcribed, and routed through the intent pipeline.
- [ ] Create fires; update/delete still confirm (S17 behavior preserved).
- [ ] Reply shows the transcript + the action taken.
- [ ] Transcription is behind an interface (swappable provider); owner-guarded.
- [ ] Integration test with a fixture audio/mock transcriber.

## Relevant files
`services/bot/` (voice handler, transcription adapter), reuse intent pipeline (S16/S17).

## Notes for executor
Don't fork the intent logic — voice only adds a transcription front-end. Show the transcript so mis-hears are caught before acting (especially for destructive intents, which still confirm).
