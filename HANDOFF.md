# LifeOS — Handoff

Last updated: 2026-06-23. Picks up after Slice S3 shipped + a ponytail repo audit.

## What LifeOS is
A personal, Apple-feel life tracker for a single user (the repo owner), built local-first as an installable PWA that runs offline on Windows and Android. Restarting after a full teardown; seed data in `seed_tasks_detailed.json` captures the long-term intent (folders → projects → tasks across 7 life domains). Read `CONTEXT.md` for the glossary, `docs/slices/README.md` for the slice backbone + product vision, and `memory/lifeos-vision-2026-06-22.md` for the full design rationale (Obsidian-vault backend, three faces: PWA dashboard, Telegram bot, Obsidian).

## Current state (on `master`)
**Slices S1–S3 are complete and merged.** A working, installable, offline task app:
- One flat list of tasks: add / list / complete / delete, with inline edit.
- Each Task carries an optional `done_when` (acceptance criterion, S2) and `priority` (1–3, S3).
- Persists locally; survives reload; works fully offline; installs as a PWA.
- Apple-feel polish (SF type, spring on complete, haptic on mobile, calm empty state).

Repo: `Deepak-Lakshmipathi/LifeOS` (public), default branch `master`. Ship via branch + PR — direct push to `master` is gated.

**Open issues:** #15 (PRD: Slice S3) — S3a + S3b both shipped, so it's effectively done; verify against its acceptance criteria and close.
**Stale local branches:** `slice/s3a-priority-seam`, `slice/s3b-priority-ui` (old pre-rebase) — superseded in master, safe to delete.

## Architecture (decided — do not re-litigate)
- **Stack:** Vite + React + TypeScript, Tailwind, Framer Motion, Dexie/IndexedDB. ADR-0001 (PWA over Tauri/native).
- **Data access goes through a seam:** `src/sync/SyncProvider.ts` is the interface; `src/sync/LocalOnly.ts` is the only impl (no-op beyond local Dexie). UI/components/hooks never import Dexie — only `SyncProvider` + `src/types`. ADR-0002.
- **Mutation is generic** (ADR-0004): `add(input)` + one `update(id, patch)` setter. New Task fields widen the patch type, they do NOT add new mutation methods.
- **Sync deferred:** Task has NO `updated_at`/`deleted_at` yet. They get added — with a migration — in the slice that turns on real sync (last-write-wins per record). The Obsidian vault becomes the real truth as a `VaultSync` provider body, swapped at the seam (Group D). ADR-0002.
- **Testing:** CI gates `build-test` (Vitest) + `pwa-e2e` (Playwright SW/offline/persistence + installability audit). ADR-0003 + `docs/testing/pwa-emulation-protocol.md`.

## Key files
```
src/types/index.ts         Task { id, title, done, created_at, done_when?, priority? }  (single file; import from '../types')
src/sync/SyncProvider.ts   the seam (add, update, list, toggleDone, delete)
src/sync/LocalOnly.ts      Dexie-backed impl (only DB toucher); ids via crypto.randomUUID()
src/db/LifeOSDb.ts         Dexie schema (only Dexie import); v2 adds `priority` index
src/hooks/useTasks.ts      reactive hook; fires navigator.vibrate on complete
src/components/            AddTaskInput, TaskItem, TaskList, PriorityControl (shared, keyed 1|2|3|undefined)
src/App.tsx                <h1>Tasks</h1> + list; provider instantiated here (swap point for sync)
e2e/pwa.spec.ts            Playwright PWA tests
scripts/lh-pwa.mjs         installability audit (Playwright/CDP, not Lighthouse)
.github/workflows/ci.yml   build-test + pwa-e2e jobs
kanban.html                live board (data + UI in one file; edit the #board-data JSON)
```

## Run it locally
```
npm install
npm run dev            # dev server
npm test               # Vitest (38 tests)
npm run build && npm run preview   # prod build to install/offline-test
npx playwright install chromium && npm run test:e2e   # PWA e2e
npm run test:pwa-audit # installability audit
```

## Next vertical — Slice S4 (recommended)
Continue Group A (grow the Task). **S4 project:** add `project?: string` to `src/types/index.ts`; thread it through the seam's `add`/`update` patch type, `useTasks`, and the components. No Dexie index needed unless you sort/filter by it. Brief: `docs/slices/slice-S4-project.md`. After S4: S5 (domain + seed import), then Group B daily-driver (NOW view, tab bar, warmth, balance brain). Full order + MVP line in `docs/slices/README.md`.

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
