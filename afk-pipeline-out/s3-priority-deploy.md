# S3 (priority) — Deploy Tables

PRD: #15 · Spec: `docs/slices/slice-S3-priority.md` · ADR-0004 (addendum) · CONTEXT.md (priority glossary)
Target repo: `Deepak-Lakshmipathi/LifeOS`. Two slices, **serial** (S3b blocked by S3a; they also share no files except `useTasks.ts`, owned by S3a).

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| #16 — S3a: priority seam + model + Dexie v2 + hook | Add `priority?: 1\|2\|3` to Task; bump Dexie to v2 with a `priority` index (no `upgrade()`/backfill); widen `add` input + `update` patch; clear via `{priority: undefined}`; validate `∈{1,2,3}` (throw); forward priority through `useTasks`; fix stale ADR-0003→0004 cites. | files: `src/types/task.ts`, `src/db/LifeOSDb.ts`, `src/sync/SyncProvider.ts`, `src/sync/LocalOnly.ts`, `src/hooks/useTasks.ts`, `src/test/syncProvider.test.ts`. PRD #15 / ADR-0004 addendum. blocked by: none. do NOT touch: `AddTaskInput.tsx`, `TaskItem.tsx`, `TaskList.tsx`, `App.tsx`, `e2e/pwa.spec.ts`, manifest/SW config; no `where('priority')`/sorting (S6). test: new `describe` in `src/test/syncProvider.test.ts` — add/round-trip, absent-on-no-priority, update set/change/clear, partial-merge, out-of-range throw, **v1→v2 migration via raw `Dexie('LifeOS')` opened at version(1) only**. | Sonnet | batch-1 (status:ready) |
| #17 — S3b: priority UI (Low/Med/High + badge) | 3-way Low/Med/High + none control in `AddTaskInput` (default none) + inline edit in `TaskItem`; weight badge (not color-alone, aria-labeled); widen `TaskItem`/`TaskList` patch prop types. | files: `src/components/AddTaskInput.tsx`, `src/components/TaskItem.tsx`, `src/components/TaskList.tsx`. PRD #15. blocked by: **#16**. do NOT touch: `useTasks.ts` + all S3a files (seam/model/db/test), `App.tsx`, `e2e/pwa.spec.ts`, manifest/SW config; never show raw 1/2/3 in UI. test: app builds + e2e green; control is keyboard-operable labeled radiogroup. | Sonnet | batch-2 (unlocks when #16 closes → flips status:ready) |

## HITL-flagged

None. All design judgment was resolved in the P1 grill (seed-0→unset, Low/Med/High labels, default-none + clearable, S3a/S3b split — all confirmed by the operator). Both slices passed the Sonnet-readiness check.

## Deploy hint

Run **#16 alone first** (batch-1). When its PR is green and merged, #17 flips `status:blocked → status:ready` (batch-2) — deploy it then. Each agent's prompt = the issue body + its Context cell. At dispatch, also launch a **CI Build Supervisor** scoped to the PRs: this repo's known flake is the "Validate Gradle wrapper" network timeout (fails <60s, `ETIMEDOUT`/`ENETUNREACH`) → rerun; a real failure gets into build/test/offline-gate (multi-minute) → report. **Do not merge until CI is green.**
