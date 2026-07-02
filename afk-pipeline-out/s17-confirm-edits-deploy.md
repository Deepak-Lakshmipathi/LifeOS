# Deploy table — S17: Telegram bot confirm-destructive update/delete

PRD: [#74](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/74). ADR: [`docs/adr/0013-bot-confirm-destructive.md`](../docs/adr/0013-bot-confirm-destructive.md) (this branch, `afk/s17-confirm-edits-docs`). Pipeline run in `auto` mode per operator override: **self-grilled headlessly (architect + engineer persona agents), stops at this table — no implementer agents dispatched.**

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| [#75](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/75) — S17: Telegram bot confirm-destructive update/delete | Add update + delete intents with a fuzzy task matcher and a per-chat pending-confirmation gate that commits only on an explicit "y" | Files (new): `services/bot/taskMatch.ts`, `services/bot/confirm/store.ts`, `services/bot/confirm/gate.ts`, `services/bot/intents/update.ts`, `services/bot/intents/delete.ts` (+ each `.test.ts`); files (extend, additive): `services/bot/intents/index.ts` (2 import lines), `services/bot/intents/types.ts` (`IntentName`/`BotContext` widen), `services/bot/router.ts` (~5-line pending-check gate before NLU), `services/bot/nlu.ts` (intent enum + `target_reference`/`mark_done` fields); ADR-0013 (all decisions); PRD #74; blocked by: none (S16 fully merged); do NOT touch: `services/bot/intents/registry.ts`, `services/bot/intents/create.ts`, `src/vault/serialize.ts`, `src/vault/parseVault.ts`, `src/sync/VaultSync.ts`, `src/vault/transport.ts`, `kanban.html`, `CONTEXT.md`; tests: `taskMatch.test.ts`, `confirm/store.test.ts`, `confirm/gate.test.ts`, `update.test.ts`, `delete.test.ts`, `router.test.ts`, `nlu.test.ts` (Vitest, mocked Claude/Telegram/vaultTransport) | Sonnet | batch-1 (status:ready) — **but see hotspot flag below before dispatching alongside #72** |

Single tracer-bullet slice, not split further — see ADR-0013's "Slicing" section: the matcher, confirm-state store/gate, and the two intent handlers are mutually load-bearing (the gate can't be tested meaningfully without the matcher's `PendingAction` shape; the handlers can't be tested meaningfully without the gate consuming what they produce), so splitting into two tickets would just recreate the same `router.ts`/`intents/types.ts` write-set across both — no real parallelism gained.

Passes the Sonnet-readiness check: fully pre-resolved (ADR-0013 makes every design call — state model, matching thresholds, confirm UX, router diff shape), literal file paths/function signatures/thresholds given, testable acceptance criteria naming the exact test files, explicit "do NOT touch" fence.

## Parallel-group derivation

- **Batch 1 (status:ready now):** #75 only, from S17's own perspective — no Blocked-by edge, and it's the only slice in this PRD.
- **Cross-pipeline hotspot — `services/bot/router.ts`:** S19's #72 (`docs/adr/0012-bot-photo-vision.md`, sibling branch `afk/s19-photo-docs`) independently adds its own photo/confirm branches to the *same* `handleIncomingMessage` function in `router.ts`, and its own deploy table already flags this collision from the S19 side. Both diffs are small, additive, and non-conflicting in *intent* (they check different things before the same NLU call), but as literal same-file hunks from two branches they will conflict if dispatched in the same batch or merged out of order without a rebase. **Do not dispatch #75 and #72 in the same parallelism phase.** Resolution options for the orchestrator, in order of preference: (a) serialize — dispatch one, merge it, rebase the other's `router.ts` hunk, then dispatch; (b) extract a tiny shared prerequisite (e.g. a single `earlyIntercepts: Array<(msg, deps) => Promise<string | null>>` list `router.ts` iterates, that both S17's `resolvePending` and S19's photo/confirm branches register into) as its own prerequisite slice both depend on. Not resolved unilaterally by this pipeline.
- S18 (voice) has not yet reached this phase (no `afk/s18-*` branch or ADR observed in this working tree as of this run) — if/when it lands, check whether its transcript-reentry design also touches `router.ts`; if so it joins the same hotspot resolution above.

## HITL-flagged section

None. Every open design question in the S17 brief was resolved in ADR-0013 (auto-mode self-grill, architect + engineer persona agents) and recorded as either a firm decision or an explicitly flagged, non-blocking assumption (ADR-0013's HITL flags A–C: 2-minute confirm TTL, match thresholds 0.6/0.5, candidate cap of 5). None are business/product unknowns a model cannot invent — each is a bounded implementation default with a stated fallback ("revisit if insufficient in practice"), consistent with ADR-0011/ADR-0012's own precedent. Flag (D) — the `router.ts` cross-pipeline hotspot — is a coordination point for the orchestrator, not a design question for a human product owner, and does not block #75 from being independently correct and dispatchable once sequenced relative to #72.

## Deploy hint (operator instruction — per top-level override, this run does NOT auto-dispatch)

This pipeline invocation was told explicitly to stop here: *"Stop at labeled tracer-bullet issues + agent deployment tables — DO NOT dispatch implementer agents."* That overrides `auto` mode's normal PIPELINE.md#p5-dispatch behavior (which would otherwise proceed to dispatch + dual-green merge). Hand-off for a follow-up session or manual dispatch:

1. Resolve the `router.ts` hotspot against #72 first (see above) — decide dispatch order or extract the shared prerequisite.
2. Dispatch #75 (batch 1, `status:ready`) once sequenced.
3. Pair any dispatch with a CI Build Supervisor per `PIPELINE.md#ci-build-supervisor`; merge only on dual-green (CI + ponytail-review ultra).
4. After #75 merges, `kanban.html` and `CONTEXT.md` reconciliation is a separate, centrally-owned change — see this pipeline's final report for the exact card/glossary edits needed (not performed by this run, per explicit operator instruction to leave those files untouched).
