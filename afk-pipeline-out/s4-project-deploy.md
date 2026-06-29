# S4 — Task belongs to a Project · Deploy Tables

Parent PRD: **#24** · Slice: **#25** · Repo: `Deepak-Lakshmipathi/LifeOS` · Generated 2026-06-29.

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| #25 — Task belongs to a Project | Add `project?: string` to Task, set on create/inline-edit (native datalist), render task list grouped by project ("Inbox" first); persist; offline + e2e green. | files: `src/types/index.ts`, `src/sync/SyncProvider.ts`, `src/sync/LocalOnly.ts`, `src/hooks/useTasks.ts`, `src/components/AddTaskInput.tsx`, `src/components/TaskItem.tsx`, `src/components/TaskList.tsx`, `src/App.tsx`, `src/lib/groupByProject.ts` (new), `src/lib/distinctProjects.ts` (new), `src/test/syncProvider.test.ts`, `src/test/groupByProject.test.ts` (new), `src/test/distinctProjects.test.ts` (new); PRD #24 / ADR-0004 / ADR-0005; blocked by: none; do NOT touch: `src/db/LifeOSDb.ts` (no index, schema stays v2), `e2e/pwa.spec.ts`; tests: `syncProvider.test.ts` (project round-trip), `groupByProject.test.ts`, `distinctProjects.test.ts` (Vitest) + `npm run test:e2e` green. | Sonnet | batch-1 (status:ready) |

## HITL-flagged

None. All design judgment was resolved up-front in the grill (ADR-0005). Inbox-first ordering is a documented default decision, not an open question.

## Dispatch
Single-slice batch. Dispatch #25 as one Sonnet implementer + one CI Build Supervisor. Drive to dual-green (CI green + ponytail-review ultra), then merge to master.
