# Seed the vault shape on first run via an empty-DB import

Slice S5 adds `domain?: string` to `Task` and imports `seed_tasks_detailed.json` (folders → projects → tasks across the 7 domains) so there is a realistic dataset to design NOW/warmth against. Two decisions arose: how `domain` is stored, and how/when the seed runs.

## `domain` follows ADR-0005 — unindexed, denormalized string

`domain` is consumed only by the in-memory `groupByDomain(tasks)` helper; no `SyncProvider` method issues a domain-scoped Dexie query, and none is planned in S5 scope. Like `project` (ADR-0005) and `done_when`, it carries **no Dexie index and no schema bump** — `LifeOSDb.ts` is unchanged, the store stays `tasks: 'id, created_at, done, priority'` (v2). The seam widens types only (ADR-0004): `add` input and the `update` Pick gain `domain`. The 7 domains are a typed `const`/union (`src/data/domains.ts`); a value not in that set is normalized to unset at the seam, mirroring the empty/whitespace unset of `done_when`/`project`.

## Seed runs once, on an empty DB, idempotent by empty-check

The importer (`src/data/seed.ts` → `seedIfEmpty(provider)`) reads `list()`; if it returns any tasks it is a **no-op** (returns 0). On an empty store it maps every seed task through the existing seam `add()` — `folder` → `domain`, project `name` → `project`, carrying `priority` and `done_when`. It runs in the `App.tsx` mount effect; the reactive `useTasks` live query renders the inserted rows.

Idempotency is the **empty-check alone** — no `seeded` flag table, no import-version record. A user who clears their DB gets a fresh seed; a user with any task is never re-seeded. This is the smallest mechanism that satisfies "runs only when empty, never duplicates"; a flag table would add migration surface for a guarantee the empty-check already gives. Seed `color`/`sort_order` are **ignored** (project styling is out of S5 scope; project stays a derived string, ADR-0005).

## Test escape hatch: `?noseed`

Auto-import changes first-run behavior, which would break the existing empty-state / deterministic-count e2e tests (Playwright starts each run with an empty IndexedDB). `seedIfEmpty` skips when the URL carries `?noseed`; the existing e2e suite navigates with `?noseed` to preserve its empty-DB assumptions, and one new e2e test loads without it to assert the seeded Domain → Project grouping. This is a one-line guard justified by test determinism, not a product surface.

## Consequences

- First run on a real install now shows the seeded 7-domain dataset, not an empty list; the calm empty state only appears after the user deletes everything.
- **Revisit when:** Group D lands the Obsidian vault as the real truth (`VaultSync`) — seeding then becomes "import the vault", and the empty-check may move behind the vault contract; or when a domain-filtered/sorted seam query appears (then index `domain`, bump to v3).
