# Slice S4 — Task belongs to a Project

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** A · **Depends on:** S3 · **Status:** planned

## Why
A Project is a named effort that holds related Tasks (`CONTEXT.md`). Grouping tasks under their project is the first structural shape of the vault (Project = note). Until now tasks are a flat list.

## Scope — this slice only
- Add optional `project?: string` (project name) to `Task`.
- Set it on create + edit (free-text or pick from existing project names).
- Group the task list by project (section header per project; unparented tasks under an "Inbox" group).

## Out of scope
- Domain (S5), project color, project-as-its-own-entity. Keep Project denormalized as a string on the Task for thinness — Projects are *derived* by grouping.

## Data / model change
- `src/types/index.ts`: add `project?: string`.
- Reuse `update`/`add`. Optionally index `project` in Dexie (cheap; helps grouping) → schema version(3) if added.

## Vertical
- UI: project field in add/edit; `TaskList` renders grouped sections by project.
- Seam/store: field carried + persisted.
- PWA: offline unaffected.

## Acceptance criteria (done_when)
- [ ] A task can be assigned a project name on create/edit; persists.
- [ ] The list groups tasks under project headers; unparented tasks appear under "Inbox".
- [ ] Existing project names are offered when assigning (derived from current tasks).
- [ ] Unit tests cover `project` round-trip + grouping helper.
- [ ] PWA e2e green.

## Relevant files
`src/types/index.ts`, `src/sync/LocalOnly.ts`, `src/db/LifeOSDb.ts`, `src/hooks/useTasks.ts`, `src/components/AddTaskInput.tsx`, `src/components/TaskList.tsx`, `src/components/TaskItem.tsx`.

## Notes for executor
Keep grouping logic in a pure, testable helper (`groupByProject(tasks)`), not buried in JSX. Project names are plain strings; no separate table.
