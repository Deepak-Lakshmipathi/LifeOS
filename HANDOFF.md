# LifeOS — Handoff

Last updated: 2026-06-16. Picks up after Slice 1 shipped.

## What LifeOS is
A personal, Apple-feel life tracker for a single user (the repo owner), built local-first as an installable PWA that runs offline on Windows and Android. Restarting after a full teardown; seed data in `seed_tasks_detailed.json` captures the long-term intent (folders → projects → tasks across 7 life domains). Read `CONTEXT.md` for the glossary, `lifeos_plan.html` for the full plan, `lifeos_slice1.html` for the Slice 1 design.

## Current state (on `master`)
**Slice 1 is complete and merged.** A working, installable, offline task app:
- One flat list of tasks: add / list / complete / delete.
- Persists locally; survives reload; works fully offline; installs as a PWA.
- Apple-feel polish (SF type, spring on complete, haptic on mobile, calm empty state).

Repo: `Deepak-Lakshmipathi/LifeOS` (public), default branch `master`. Only `master` exists — all slice branches/worktrees pruned. Issues #1 (PRD), #2, #3 closed. PRs #4 (Slice A) and #6 (Slice B) merged; #5 was discarded (stale-base mistake, see Lessons).

## Architecture (decided — do not re-litigate)
- **Stack:** Vite + React + TypeScript, Tailwind, Framer Motion, Dexie/IndexedDB. ADR-0001 (PWA over Tauri/native).
- **Data access goes through a seam:** `src/sync/SyncProvider.ts` is the interface; `src/sync/LocalOnly.ts` is the only Slice-1 impl (no-op beyond local Dexie). UI never imports Dexie directly. ADR-0002.
- **Sync deferred:** Task has NO `updated_at`/`deleted_at` yet. They get added — with a migration — in the slice that turns on real sync, which will use last-write-wins per record. ADR-0002.
- **Testing:** CI gates `build-test` (Vitest) + `pwa-e2e` (Playwright SW/offline/persistence + installability audit). ADR-0003 + `docs/testing/pwa-emulation-protocol.md`.

## Key files
```
src/types/task.ts          Task { id, title, done, created_at }
src/sync/SyncProvider.ts   the seam (add, list, toggleDone, delete)
src/sync/LocalOnly.ts      Dexie-backed impl (only DB toucher)
src/db/LifeOSDb.ts         Dexie schema (only Dexie import)
src/hooks/useTasks.ts      reactive hook; fires navigator.vibrate on complete
src/components/            AddTaskInput, TaskItem, TaskList
src/App.tsx                <h1>Tasks</h1> + list; empty state "All clear"
e2e/pwa.spec.ts            Playwright PWA tests
scripts/lh-pwa.mjs         installability audit (Playwright/CDP, not Lighthouse)
.github/workflows/ci.yml   build-test + pwa-e2e jobs
```

## Run it locally
```
npm install
npm run dev            # dev server
npm test               # Vitest (9 tests)
npm run build && npm run preview   # prod build to install/offline-test
npx playwright install chromium && npm run test:e2e   # PWA e2e
npm run test:pwa-audit # installability audit
```

## Next vertical — Slice 2 (recommended)
**Wire the `SyncProvider` seam to a real backend** (this is the deferred sync from ADR-0002):
1. Add `updated_at` + `deleted_at` to `Task` and migrate existing local rows.
2. Implement a `CloudSync` `SyncProvider` (or wrap `LocalOnly`) doing last-write-wins per record against a thin backend (Supabase or Turso/libSQL — pick in a new ADR).
3. Keep it offline-first: queue local writes, reconcile on reconnect.
4. Acceptance: a task added on one device appears on the other; offline edits reconcile by LWW; no UI call sites change (only the seam impl).

After sync, the plan's later slices: structure (projects/domains + seed import), Today/priority view, habits/cadence. See `lifeos_plan.html`.

## How work gets shipped here (afk-pipeline workflow)
- Plan/grill → PRD issue → tracer-bullet slice issues → Sonnet agents implement → PR → CI green → merge. Dispatch prompts pattern in `afk-pipeline-out/`.
- Each slice is a vertical tracer bullet (pierces UI→data→shell→seam), not a horizontal layer.
- Polish is the definition-of-done for every slice, not a separate phase.

## Lessons / gotchas
- **Pull local `master` before dispatching the next slice.** Slice B (#5) was cut from a stale local master (pre–Slice A merge) → add/add conflicts + missing CI; had to rebuild as #6. Always `git pull --ff-only origin master` first.
- **Direct push to `master` is gated** in this environment. Ship via a branch + PR; don't expect `git push origin master` to succeed.
- Lighthouse v10+ has no PWA category — installability is checked via Playwright/CDP instead (ADR-0003).
- Squash-merges create a fresh commit on master with no link to the slice branch history; branch the next slice off the updated master, not the old branch.

## Open items
- `KANBAN.md` "Slice 1 complete" commit may still be local/pending push.
- Tier 3 device check (Android AVD + Windows install) optional — not yet run on real hardware.
