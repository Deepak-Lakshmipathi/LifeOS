# Slice S3 — Task gains `priority` (1–3)

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** A · **Depends on:** S2 · **Status:** planned

## Why
Priority is what the balance brain (S6/S10) ranks on. The seed data already carries `priority` 1–3. Capturing it now means NOW has signal to work with later.

## Scope — this slice only
- Add optional `priority: 1 | 2 | 3` to `Task` (3 = highest, matching seed).
- Set it on create + edit (simple 3-way control: P1/P2/P3, default unset or 2).
- Show a small weight indicator on the card (e.g. a colored dot or P-badge).

## Out of scope
- Sorting/ranking by priority (that's the NOW view, S6). This slice only stores + displays.

## Data / model change
- `src/types/task.ts`: add `priority?: 1 | 2 | 3`.
- Reuse `update(id, patch)` from S2; extend `add(input)` to accept `priority`.
- Add `priority` to the Dexie index in `LifeOSDb.ts` (NOW will query/sort by it) → **bump schema to version(2)** with the new index string.

## Vertical
- UI: priority control in `AddTaskInput` + edit; weight indicator in `TaskItem`.
- Seam/store: `add`/`update` carry `priority`; Dexie indexed.
- PWA: offline unaffected (Dexie upgrade runs locally).

## Acceptance criteria (done_when)
- [ ] A task can be created/edited with priority 1–3; persists across reload.
- [ ] Priority shows as a clear weight indicator on the card.
- [ ] Dexie schema bumped to v2; existing tasks (no priority) survive the upgrade.
- [ ] Unit tests cover `priority` round-trip via the seam.
- [ ] PWA e2e green.

## Relevant files
`src/types/task.ts`, `src/db/LifeOSDb.ts`, `src/sync/LocalOnly.ts`, `src/sync/SyncProvider.ts`, `src/hooks/useTasks.ts`, `src/components/AddTaskInput.tsx`, `src/components/TaskItem.tsx`, `src/test/syncProvider.test.ts`.

## Notes for executor
Test the Dexie v1→v2 upgrade path: a task stored before the index exists must still load. Keep `priority` optional so legacy/un-prioritized tasks are valid.
