# LifeOS — Handoff

Last updated: 2026-06-29. Picks up after Slice S5 shipped via the `afk-pipeline auto` run (headless: grill → PRD #29 → slice #30 → PR #31 → dual-green auto-merge `eac5ed1`). **Group A is complete.**

## What LifeOS is
A personal, Apple-feel life tracker for a single user (the repo owner), built local-first as an installable PWA that runs offline on Windows and Android. Restarting after a full teardown; seed data in `seed_tasks_detailed.json` captures the long-term intent (folders → projects → tasks across 7 life domains). Read `CONTEXT.md` for the glossary, `docs/slices/README.md` for the slice backbone + product vision, and `memory/lifeos-vision-2026-06-22.md` for the full design rationale (Obsidian-vault backend, three faces: PWA dashboard, Telegram bot, Obsidian).

## Current state (on `master`)
**Slices S1–S5 are complete and merged (Group A done).** A working, installable, offline task app:
- Tasks: add / list / complete / delete, with inline edit. The list is **nested Domain → Project → Task** (domain header → project subheader → tasks; domain-less under an "Inbox" domain, project-less under "Inbox", both sort first).
- Each Task carries an optional `done_when` (acceptance criterion, S2), `priority` (1–3, S3), `project` name (string, S4), and `domain` (one of 7, string, S5).
- **First run on an empty DB seeds** the local store from `seed_tasks_detailed.json` (107 tasks across the 7 domains) via `seedIfEmpty` — idempotent by empty-check, `?noseed` test hook (ADR-0006). `src/data/domains.ts` holds the typed `DOMAINS`/`Domain` + `DOMAIN_COLORS` palette (reserved for later glow/warmth).
- Persists locally; survives reload; works fully offline; installs as a PWA.
- Apple-feel polish (SF type, spring on complete, haptic on mobile, calm empty state).

Repo: `Deepak-Lakshmipathi/LifeOS` (public), default branch `master`. Ship via branch + PR — direct push to `master` is gated.

**Open issues:** none. PRD #29 + slice #30 (S5) closed; PR #31 merged (squash `eac5ed1`). Earlier: PRD #24 + slice #25 (S4), PR #26 (`4452220`).
**Docs branch awaiting PR:** `afk/s5-domain-and-seed-docs` (ADR-0006 + CONTEXT domain/seed terms + kanban + deploy table) — never auto-merged (pipeline hard rule); PR it to land the docs on master.
**Stale local branches/worktrees:** `slice/s4-project`, `slice/s5-domain-and-seed` (merged) + their agent worktrees under `.claude/worktrees/` — safe to prune.

## Architecture (decided — do not re-litigate)
- **Stack:** Vite + React + TypeScript, Tailwind, Framer Motion, Dexie/IndexedDB. ADR-0001 (PWA over Tauri/native).
- **Data access goes through a seam:** `src/sync/SyncProvider.ts` is the interface; `src/sync/LocalOnly.ts` is the only impl (no-op beyond local Dexie). UI/components/hooks never import Dexie — only `SyncProvider` + `src/types`. ADR-0002.
- **Mutation is generic** (ADR-0004): `add(input)` + one `update(id, patch)` setter. New Task fields widen the patch type, they do NOT add new mutation methods.
- **Not every new field is indexed** (ADR-0005): `project` (S4) is a denormalized free-text string, consumed only by in-memory grouping — so it carries **no** Dexie index and did **not** bump the schema (stays v2). Index/bump only when a field gets a real seam query (as `priority` did). Empty/whitespace string fields unset (never stored as `''`), mirroring `done_when`.
- **Sync deferred:** Task has NO `updated_at`/`deleted_at` yet. They get added — with a migration — in the slice that turns on real sync (last-write-wins per record). The Obsidian vault becomes the real truth as a `VaultSync` provider body, swapped at the seam (Group D). ADR-0002.
- **Testing:** CI gates `build-test` (Vitest) + `pwa-e2e` (Playwright SW/offline/persistence + installability audit). ADR-0003 + `docs/testing/pwa-emulation-protocol.md`.

## Key files
```
src/types/index.ts         Task { id, title, done, created_at, done_when?, priority?, project?, domain? }  (single file; import from '../types')
src/data/domains.ts        DOMAINS (7) const + Domain union + isDomain + DOMAIN_COLORS palette (S5)
src/data/seed.ts           seedIfEmpty(provider) — idempotent empty-DB import of seed_tasks_detailed.json; ?noseed skip (S5)
src/lib/groupByDomain.ts   nests groupByProject inside DOMAINS-ordered domain buckets + domainForProject (S5)
src/sync/SyncProvider.ts   the seam (add, update, list, toggleDone, delete)
src/sync/LocalOnly.ts      Dexie-backed impl (only DB toucher); ids via crypto.randomUUID()
src/db/LifeOSDb.ts         Dexie schema (only Dexie import); v2 adds `priority` index (project is NOT indexed — ADR-0005)
src/hooks/useTasks.ts      reactive hook; fires navigator.vibrate on complete
src/lib/                   groupByProject (Inbox-first sections) + distinctProjects (datalist suggestions) — pure, testable
src/components/            AddTaskInput, TaskItem, TaskList, PriorityControl (shared, keyed 1|2|3|undefined)
src/App.tsx                <h1>Tasks</h1> + list; derives `projects` via distinctProjects(tasks); provider instantiated here (swap point for sync)
e2e/pwa.spec.ts            Playwright PWA tests
scripts/lh-pwa.mjs         installability audit (Playwright/CDP, not Lighthouse)
.github/workflows/ci.yml   build-test + pwa-e2e jobs
kanban.html                live board (data + UI in one file; edit the #board-data JSON)
```

## Run it locally
```
npm install
npm run dev            # dev server
npm test               # Vitest (68 tests)
npm run build && npm run preview   # prod build to install/offline-test
npx playwright install chromium && npm run test:e2e   # PWA e2e
npm run test:pwa-audit # installability audit
```

## Next vertical — Slice S6 (recommended)
Group A is done. **S6 NOW view (dumb brain):** the first command-center surface — a flat priority-ranked NOW list (no balance/warmth logic yet; that's S9/S10). Now that the store seeds 107 real tasks across 7 domains, there is a realistic dataset to rank against. Brief: `docs/slices/slice-S6-*.md` (write it if absent). After S6, Group B continues: tab bar (S7), tap-the-dot complete (S8), warmth (S9), balance brain (S10). Full order + MVP line in `docs/slices/README.md`.

## How work gets shipped here (afk-pipeline workflow)
- Plan/grill → PRD issue → tracer-bullet slice issues → Sonnet agents implement → PR → CI green → merge. Dispatch prompt pattern in `afk-pipeline-out/` (historical records — point-in-time, not kept current).
- Each slice is a vertical tracer bullet (pierces UI→data→shell→seam), not a horizontal layer.
- Polish is the definition-of-done for every slice, not a separate phase.
- Update `kanban.html` (the `#board-data` JSON) when a slice ships.

## Lessons / gotchas
- **Pull local `master` before dispatching the next slice / cutting a branch.** Stale-base branches cause add/add conflicts + missing CI. Always `git pull --ff-only origin master` first.
- **Direct push to `master` is gated**, and **`git push --force*` is blocked** in this environment. For a rebased branch already on origin, push under a new branch name + open a fresh PR rather than force-pushing.
- Squash-merges create a fresh commit on master with no link to the slice branch history; branch the next slice off the updated master, not the old branch.
- Lighthouse v10+ has no PWA category — installability is checked via Playwright/CDP instead (ADR-0003).
- Growing the `Task` model that adds an **indexed** field = update `src/types/index.ts` **and** bump the Dexie schema version in `LifeOSDb.ts` (priority was the first, → v2).
- **`useTasks` is fetch-based, not a Dexie `liveQuery`** — it `list()`s once and refreshes after its own mutations. Writes made *outside* the hook (e.g. `seedIfEmpty` firing async on mount) do NOT auto-render; S5 added a `refresh()` to `UseTasksResult` that `App.tsx` calls after a non-zero seed. If a future slice wants reactivity, switch to `liveQuery` rather than scattering `refresh()` calls.
