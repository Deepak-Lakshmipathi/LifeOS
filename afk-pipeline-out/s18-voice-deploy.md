# S18 — Telegram bot: voice notes — deploy tables

PRD: [#77](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/77) · ADR: [0014](../docs/adr/0014-bot-voice-transcription.md) · Slice brief: `docs/slices/slice-S18-bot-voice.md`

Mode: `afk-pipeline auto`, scoped to S18. **Stopped at this table per operator instruction — no implementer agents dispatched.**

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| [#78](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/78) — S18: voice notes (transcription ingest + confidence gate) | Add a voice branch to the Telegram message-ingest layer: download → transcribe (Groq Whisper) → confidence gate → route confident transcripts through the existing, unmodified `classifyAndExtract`/`dispatchIntent` pipeline; echo the transcript in the reply. | Files: `services/bot/telegramClient.ts`, `services/bot/transcription.ts` (new), `services/bot/router.ts`, `services/bot/reply.ts`, `services/bot/config.ts`, `services/bot/index.ts`, `.env.example`, `README.md`, + each file's test (`transcription.test.ts` new, `router.test.ts`/`reply.test.ts`/`config.test.ts` extended). Full field-level spec + acceptance criteria + test names in issue #78 body. Design fully resolved in ADR-0014 (Groq Whisper `whisper-large-v3-turbo`, `GROQ_API_KEY` env, no transcoding — Telegram's OGG/Opus passes straight to Groq, confidence = non-empty transcript + mean `no_speech_prob` <= 0.5). Blocked by: none (S16 merged; S18 explicitly does not depend on S17). Do NOT touch: `services/bot/intents/**`, `services/bot/nlu.ts`, `src/vault/**`, `src/sync/**`, `src/types/**`, `kanban.html`, `CONTEXT.md`. Test: `npm test` in `services/bot/` — new `transcription.test.ts` + extended `router.test.ts`/`reply.test.ts`/`config.test.ts`, zero existing-assertion changes. | Sonnet | batch-1 (status:ready) |

Single-issue slice — no internal parallel batching needed. Nothing currently blocks it (S16 is merged to master).

## HITL-flagged section

None. See ADR-0014 "HITL vs AFK" section for the explicit reasoning: S18 adds only read-only network calls (Telegram voice download, Groq transcription); any resulting vault write reuses S16/S16c's already hand-verified `create.ts` → `VaultTransport` path unchanged, so it does not meet the bar S16c's live-git-write slice did. One **non-blocking documented assumption** carried instead (not a merge gate): real transcription *quality* against live audio (accents, background noise, Opus compression artifacts) can't be verified by a fixture-audio unit test — the README gets a short manual-smoke-test note asking the owner to send a couple of real voice notes post-deploy and eyeball the transcript/confidence behavior. Does not block merge or dispatch.

## Cross-slice hotspot note (for central reconciliation, not resolved here)

S18's write-set is disjoint from S16's shipped files, but **may** overlap S17's in-flight write-set on two files if S17 is dispatched/merged concurrently: `services/bot/router.ts` (S17 adds confirm-state + update/delete dispatch branches; S18 adds a voice branch — same file, different regions) and possibly `services/bot/config.ts` (S17 likely adds no new env var, but worth checking at merge time). Per the pipeline's hotspot rule this is a **serialize, don't same-batch** case: whichever of S17/S18 merges second should rebase against the first rather than the two landing as a single concurrent PR pair against the same file. Flagging for the orchestrator's central reconciliation — not resolved unilaterally here since S17's actual diff isn't visible from this branch.

## Deploy hint

Dispatch issue #78 as a single Sonnet-seeded implementer agent using the issue body as its full context (nothing else needed — every design call is pre-resolved in ADR-0014). Pair with a CI Build Supervisor per the pipeline's standard dispatch runbook if/when this is deployed. Merge gate: dual-green (CI + ponytail-review ultra) per the pipeline's standard rule — this run stopped before dispatch, so no PR exists yet to gate.
