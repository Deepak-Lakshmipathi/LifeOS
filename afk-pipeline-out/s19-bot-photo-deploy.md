# Deploy table — S19: Telegram bot photos (vision)

PRD: [#70](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/70). ADR: [`docs/adr/0012-bot-photo-vision.md`](../docs/adr/0012-bot-photo-vision.md) (this branch, `afk/s19-photo-docs`). Pipeline run in `auto` mode per operator override: **self-grilled headlessly, stops at this table — no implementer agents dispatched.**

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| [#71](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/71) — S19a: Bot photo ingest | Extend `telegramClient.ts` with photo detection + `downloadPhoto`; add new `visionExtract.ts` (Claude vision, `claude-sonnet-5`, structured multi-task output, capped at 20, domain/priority normalization reused from `nlu.ts`) | Files: `services/bot/telegramClient.ts`, `services/bot/visionExtract.ts` (new), `services/bot/telegramClient.test.ts`, `services/bot/visionExtract.test.ts` (new); ADR-0012 §1/§2/§5; PRD #70; blocked by: none; do NOT touch: `services/bot/router.ts`, `services/bot/intents/*`, `services/bot/index.ts`, `src/vault/*`, `src/sync/*`; tests: `telegramClient.test.ts`, `visionExtract.test.ts` (Vitest, mocked fetch + mocked ClaudeClient) | Sonnet | batch-1 (status:ready) |
| [#72](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/72) — S19b: Bot photo batch-confirm + router wiring | Add `photoConfirm.ts` (10-min-expiring per-chat pending state) + a photo branch and confirm-check branch in `router.ts`'s `handleIncomingMessage`, reusing `intents/create.ts`'s `handleCreate` per confirmed task | Files: `services/bot/photoConfirm.ts` (new), `services/bot/router.ts`, `services/bot/photoConfirm.test.ts` (new), `services/bot/router.test.ts`; ADR-0012 §3/§4; PRD #70; blocked by: #71 (needs `downloadPhoto` + `extractTasksFromImage`); do NOT touch: `services/bot/intents/registry.ts`, `services/bot/intents/types.ts`, `services/bot/intents/create.ts`, `services/bot/intents/index.ts`, `services/bot/nlu.ts`, `services/bot/vaultTransport.ts`, `src/vault/*`, `kanban.html`, `CONTEXT.md`; tests: `photoConfirm.test.ts`, `router.test.ts` (Vitest, mocked telegramClient/ClaudeClient/vaultTransport) | Sonnet | dependency phase (after #71 merges) |

Both slices pass the Sonnet-readiness check: fully pre-resolved (ADR-0012 makes every design call), literal file paths and function signatures given, testable acceptance criteria naming the exact test files, explicit "do NOT touch" fences (write-sets are disjoint — `#71` never touches `router.ts`; `#72` never touches `telegramClient.ts`/`visionExtract.ts`, only imports from them).

## Parallel-group derivation

- **Batch 1 (status:ready now):** #71 only. No Blocked-by edge, and its write-set (`telegramClient.ts`, new `visionExtract.ts`) is disjoint from every other in-flight slice in this repo's currently-known open work.
- **Dependency phase:** #72, serially after #71 merges (real dependency — #72 imports `downloadPhoto` and `extractTasksFromImage` by name, not a hotspot-avoidance serialization).

No batching conflict with the sibling S17/S18 pipelines: #71's write-set is `telegramClient.ts` (extend, additive fields + one new method) + a new file; #72's write-set is `router.ts` (extend, two new branches) + a new file. S17's brief also touches "intent handler, conversation state" inside `services/bot/` and S18's brief touches "voice handler, transcription adapter" inside `services/bot/` — if S17 or S18 land a PR touching `router.ts` or `telegramClient.ts` before #71/#72 merge, that PR and #72 (or #71, for `telegramClient.ts`) become a same-file hotspot and must NOT be dispatched in the same batch; whichever merges first, the other rebases. This is flagged for the orchestrator's cross-pipeline coordination, not resolved unilaterally here (S19's own two slices are internally hotspot-free).

## HITL-flagged section

None. Every open design question in the S19 brief was resolved in ADR-0012 (auto-mode self-grill) and recorded as either a firm decision or an explicitly flagged, non-blocking assumption (ADR-0012's HITL-flags A–D: 20-task cap, 10-minute confirm TTL, `claude-sonnet-5` vision pin, single-pending-batch-per-chat). None of these are business/product unknowns a model cannot invent — each is a bounded implementation default with a stated fallback ("revisit if insufficient in practice"), consistent with ADR-0011's own precedent (its HITL flags (B) and (C) took the same shape). No slice in this PRD carries irreducible design judgment; both #71 and #72 are AFK-deployable.

## Deploy hint (operator instruction — per top-level override, this run does NOT auto-dispatch)

This pipeline invocation was told explicitly to stop here: *"Stop at labeled tracer-bullet issues + agent deployment tables — DO NOT dispatch implementer agents."* That overrides `auto` mode's normal PIPELINE.md#p5-dispatch behavior (which would otherwise proceed to dispatch + dual-green merge). Hand-off for a follow-up session or manual dispatch:

1. Dispatch #71 now (batch 1, `status:ready`).
2. On #71 merged-green, flip #72 to `status:ready` and dispatch it.
3. Pair any dispatch with a CI Build Supervisor per `PIPELINE.md#ci-build-supervisor`; merge only on dual-green (CI + ponytail-review ultra).
4. After #72 merges, the kanban (`kanban.html`) and `CONTEXT.md` reconciliation is a separate, centrally-owned change — see the pipeline's final report for the exact card/field edits needed (not performed by this run, per explicit operator instruction to leave those files untouched).
