# Deploy — Slice S5 (Domain + seed the vault shape)

PRD: #29 · Slice: #30 · Mode: `auto` (dispatch + dual-green auto-merge) · Repo: `Deepak-Lakshmipathi/LifeOS`

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| #30 — Domain + seed | Add `domain?: string` (one of 7) to Task, nested Domain→Project→Task list, idempotent seed import + `DOMAIN_COLORS` palette | files: `src/types/index.ts`, `src/data/domains.ts` (new), `src/data/seed.ts` (new), `src/sync/SyncProvider.ts`, `src/sync/LocalOnly.ts`, `src/hooks/useTasks.ts`, `src/lib/groupByDomain.ts` (new), `src/components/{AddTaskInput,TaskItem,TaskList}.tsx`, `src/App.tsx`, `tsconfig.json` (resolveJsonModule if needed), tests `src/test/{syncProvider,groupByDomain,seed}.test.ts`, `e2e/pwa.spec.ts`; PRD #29 / ADR-0006 + ADR-0005 + ADR-0004; blocked by: none; do NOT touch: `src/db/LifeOSDb.ts`, `src/lib/groupByProject.ts`, `src/lib/distinctProjects.ts`, ADR/CONTEXT docs; tests: `seed.test.ts` (mapping+idempotency, 107), `groupByDomain.test.ts`, `syncProvider.test.ts` (domain round-trip), Playwright `?noseed` + seeded-grouping | Sonnet | batch-1 (status:ready, sole slice) |

## HITL-flagged

_None._ No business/product unknowns. Domain set, seed file, and unindexed-string pattern are all given (ADR-0005/0006). The `DOMAIN_COLORS` hexes are a reversible cosmetic default chosen by the architect (Apple system palette), not a blocking decision.

## Dispatch plan

Single atomic slice (write-sets across types/seam/hook/App/TaskList/components/lib fully overlap → splitting would only force serialization). One Sonnet implementer + one CI Build Supervisor. Merge gate = dual-green (CI green AND ponytail-review ultra green-lights). No downstream phase — S6 unblocks after #30 merges.
