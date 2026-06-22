# Deploy — Slice S2: Task gains `done_when`

PRD: [#8](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/8) · ADR-0004 (generic `update` at the seam) · CONTEXT.md (done_when, Sync seam)

Pipeline stops here. Tables ready to deploy; agents NOT dispatched.

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| [#9](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/9) — S2a done_when seam + model + hook | Grow seam to `add(input)` + generic `update(id,patch)`, add `Task.done_when?`, wire `useTasks`; verify by unit tests only | files: `src/types/task.ts`, `src/sync/SyncProvider.ts`, `src/sync/LocalOnly.ts`, `src/hooks/useTasks.ts`, `src/App.tsx` (call-site), `src/test/syncProvider.test.ts`; PRD #8 + ADR-0004; blocked by: none; do NOT touch: `TaskItem.tsx`, `AddTaskInput.tsx` beyond minimal `onAdd` sig fix, no Dexie schema bump; test: `src/test/syncProvider.test.ts` (Vitest) — add/update/unset/empty-title-throw/bad-id-throw/partial-merge; e2e `e2e/pwa.spec.ts` stays green | Sonnet | **batch-1** (status:ready) |
| [#10](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/10) — S2b done_when UI | Add always-visible `"Done when…"` create field, tap-title inline edit, secondary card render — consuming S2a seam unchanged | files: `src/components/AddTaskInput.tsx`, `src/components/TaskItem.tsx`; PRD #8; blocked by: #9; do NOT touch: `SyncProvider.ts`, `LocalOnly.ts`, `types/task.ts`, `LifeOSDb.ts` (frozen by S2a), no new seam/hook methods; render: small+dim under title, follows done-fade ~38% no strike, hidden when absent; test: e2e `e2e/pwa.spec.ts` green | Sonnet | **batch-2** (unlocks when #9 closes) |

## HITL-flagged

None. Every slice passed the Sonnet-readiness check (fully pre-resolved in the P1 grill: seam shape B, tap-title inline edit, single-line always-visible field, `update` semantics, card render rules — all literal).

## Deploy hint

Run **batch-1** (#9) as one Sonnet agent, prompt = issue #9 body + its Context cell. When #9's PR is green and merged, #10 flips `status:blocked → status:ready` (batch-2); dispatch it then. Both serial (#10 needs the seam) — no concurrency this slice.

At dispatch, launch a **CI Build Supervisor** scoped to the PRs #9/#10 open: triage flake-vs-real CI failures, rerun the known wrapper-validation network flake, alert on green. **Do not merge until CI is green** — local tests are necessary, not sufficient.
