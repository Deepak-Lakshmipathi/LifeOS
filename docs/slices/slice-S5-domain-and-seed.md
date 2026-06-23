# Slice S5 — Domains + seed the vault shape

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** A · **Depends on:** S4 · **Status:** planned

## Why
A Domain is a top-level area of life; a Project lives in a Domain (`CONTEXT.md`). This completes the Domain → Project → Task shape the whole product hangs off. Seeding from `seed_tasks_detailed.json` gives a realistic dataset to design NOW/warmth against.

## Scope — this slice only
- Add optional `domain?: string` to `Task`, constrained to the 7 domains (Building Things, Career, Growth, Life Admin, Body & Mind, Finance, Relationship).
- Set it on create/edit; when a project is chosen, default its domain from existing tasks in that project.
- Group the list Domain → Project → Task.
- **Seed importer:** a one-shot import of `seed_tasks_detailed.json` (note `folder` → `domain`, `name` → `project`, plus `color`, `priority`, `done_when`) into the local store when the DB is empty.
- Define a static **domain color palette** (constant) for later glow/warmth use.

## Out of scope
- NOW view, warmth, glass, tab bar. Project color may be read from seed but UI styling stays minimal.

## Data / model change
- `src/types/index.ts`: add `domain?: string`.
- Seed mapping: JSON `folder` is the storage key for Domain (resolved ambiguity in `CONTEXT.md`).
- Optional Dexie index on `domain` → schema bump if added.

## Vertical
- UI: domain field in add/edit; `TaskList` renders Domain → Project → Task hierarchy.
- Data: seed importer (idempotent, runs only when empty).
- Seam/store: field persisted.
- PWA: offline unaffected; seed runs locally.

## Acceptance criteria (done_when)
- [ ] A task carries one of the 7 domains; persists; invalid domains rejected/normalized.
- [ ] On first run with an empty DB, the seed imports all projects/tasks from `seed_tasks_detailed.json` with correct domain/project/priority/done_when.
- [ ] Re-running does not duplicate (idempotent).
- [ ] List shows Domain → Project → Task grouping.
- [ ] Domain color palette constant exists and is exported for reuse.
- [ ] Unit tests cover the seed mapping (`folder`→domain) and grouping.
- [ ] PWA e2e green.

## Relevant files
`src/types/index.ts`, `src/sync/LocalOnly.ts`, `src/db/LifeOSDb.ts`, `src/hooks/useTasks.ts`, `src/components/*`, new `src/data/seed.ts` (+ import of `seed_tasks_detailed.json`), new `src/data/domains.ts` (palette + domain list).

## Notes for executor
Treat the 7 domains as a typed union/const. Seed JSON keys: top-level `projects[]`, each has `name`, `folder`, `color`, `sort_order`, `tasks[]` with `title`, `done_when`, `priority`. Keep the importer idempotent and pure where possible.
