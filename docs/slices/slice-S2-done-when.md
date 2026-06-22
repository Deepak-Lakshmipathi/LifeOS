# Slice S2 — Task gains `done_when`

> Read `docs/slices/README.md` + `CONTEXT.md` first. This is a tracer-bullet vertical slice.

**Group:** A · **Depends on:** Slice 1 (shipped) · **Status:** ✅ shipped (PRs #11 seam + #12 UI; PRD #8, ADR-0004)

## Why
A Task's real finish line is its `done_when` — *how you know it's truly done* — not just a checkbox. It's core domain language (`CONTEXT.md`) and the first step toward the vault shape. Without it a task is just a title.

## Scope — this slice only
- Add optional `done_when` to the `Task` model.
- Let the user set/edit it when adding a task and on an existing task.
- Show it on the task card, secondary to the title (small, beneath it).

## Out of scope
- Priority (S3), project/domain (S4/S5), NOW view, styling overhaul. Keep current Apple-feel.

## Data / model change
- `src/types/task.ts`: add `done_when?: string`.
- `LocalOnly.add` grows to accept an optional `done_when`. **Seam decision:** change `add(title: string)` → `add(input: { title: string; done_when?: string })` OR add `update(id, patch)` for editing. Recommended: introduce `add(input)` + a generic `update(id, patch: Partial<Pick<Task,'title'|'done_when'>>)` now — future field slices reuse `update`.
- No Dexie index needed (`done_when` is not queried); no schema version bump.

## Vertical
- UI: `AddTaskInput` gains an optional second line/field for `done_when`; `TaskItem` renders it under the title.
- Hook: `useTasks.addTask` signature follows the seam; add `updateTask(id, patch)`.
- Seam: `SyncProvider.add` + new `update`.
- Store: `LocalOnly` persists/patches the field.
- PWA: no change; still offline.

## Acceptance criteria (done_when)
- [ ] A task can be created with a `done_when`; it persists across reload (IndexedDB).
- [ ] `done_when` renders on the card beneath the title when present, hidden when absent.
- [ ] An existing task's `done_when` can be edited and the change persists.
- [ ] Unit tests cover seam `add` with/without `done_when` and `update`.
- [ ] PWA install/offline e2e still green.

## Relevant files
`src/types/task.ts`, `src/sync/SyncProvider.ts`, `src/sync/LocalOnly.ts`, `src/hooks/useTasks.ts`, `src/components/AddTaskInput.tsx`, `src/components/TaskItem.tsx`, `src/test/syncProvider.test.ts`.

## Notes for executor
Maintain seam discipline — components never touch Dexie. Prefer the generic `update(id, patch)` so S3–S5 don't each invent their own setter.
