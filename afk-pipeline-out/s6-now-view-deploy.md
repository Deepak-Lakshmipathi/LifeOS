# S6 — NOW view (dumb brain) · Deploy Tables

Pipeline run: `afk-pipeline auto`. Repo `Deepak-Lakshmipathi/LifeOS`. PRD #34. Single tracer-bullet slice — no parallelism.

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| #35 — NOW view (dumb brain) | Add a priority-ranked NOW surface: pure `rankNow` + `NowView` + a `Now\|All` header toggle | files (new): `src/now/rankNow.ts`, `src/now/rankNow.test.ts`, `src/components/NowView.tsx`; (edit): `src/App.tsx`. PRD #34 / ADR-0007 / brief `docs/slices/slice-S6-now-view.md`. Blocked by: none (S5 merged). do NOT touch: `src/types`, `src/sync/*`, `src/db/*`, `src/data/*`, `src/hooks/useTasks.ts`, `TaskItem.tsx`, `TaskList.tsx`, `src/lib/*`, Dexie schema (stays v2); no new dep; read-only via `list()`. Tests: `rankNow.test.ts` (Vitest — priority desc, undefined sinks, created_at tie, done excluded, empty, no-mutate) + existing `e2e/pwa.spec.ts` green (click `All` first only if the seeded-grouping e2e defaults to Now). | Sonnet | batch-1 (status:ready) |

## HITL-flagged

None. All design calls resolved up-front in P1 (ADR-0007): rankNow semantics, top-3 live + Up next(5)/Later layout, throwaway Now/All toggle. No business/product unknowns; no `auto` assumptions.

## Dispatch

batch-1 = {#35} only. One implementer agent (Sonnet) + one CI Build Supervisor. Per-PR dual-green gate: CI green (Supervisor triages the wrapper-validation flake) AND ponytail-review (ultra) green-light → orchestrator merges to master. No downstream phase (S7 blocked by S6).
