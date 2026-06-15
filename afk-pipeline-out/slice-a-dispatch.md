# Dispatch — Issue #2 (Slice A: Local-first task loop)

Model: Sonnet. Batch-1 (no blockers). Pair with a CI Build Supervisor.
Agent prompt below is self-contained — paste as-is.

---

You are implementing GitHub issue #2 on Deepak-Lakshmipathi/LifeOS. Work
autonomously, open a PR, do not merge.

# Task
Build the LifeOS Slice 1 "local-first task loop": a working add / list /
complete / delete task app, persisted locally through a no-op sync seam,
polished to an Apple feel. Runs in a browser tab. Installability and offline
are a SEPARATE issue (#3) — do not touch that.

# Repo state
Fresh, near-empty repo (only seed JSON + planning HTML + docs on the
afk/slice1-docs branch). You are scaffolding the app from scratch.
Read CONTEXT.md, docs/adr/0001-pwa-over-native.md,
docs/adr/0002-local-first-sync-deferred.md for the decisions — do not
re-litigate them.

Prerequisite: ensure a base branch exists on origin. If origin has no
default branch yet, push the current master first. Then create your work
branch `feat/slice-a-task-loop` off it. Open the PR against that base.

# Stack (decided — ADR-0001)
- Vite + React + TypeScript
- Tailwind CSS for styling
- Framer Motion for motion
- Dexie over IndexedDB for persistence

# Entity (the only one — no more)
Task { id: string (uuid), title: string, done: boolean, created_at: number }
No updated_at / deleted_at — sync fields come in a later slice (ADR-0002).

# Build
1. Scaffold Vite + React + TS; configure Tailwind.
2. Define the Task type.
3. Dexie DB with a `tasks` table, reached ONLY through a `SyncProvider`
   interface { add, list, toggleDone, delete }. Provide a no-op `LocalOnly`
   implementation backing it with Dexie. UI/components must never import
   Dexie directly — they depend on SyncProvider.
4. Reactive list: render all tasks, newest-first.
5. Add (single text field, Enter to commit; reject empty title),
   toggle done, delete.
6. Apple-feel polish (this is acceptance, not optional): SF system font
   stack, generous whitespace, spring animation on complete (transform/
   opacity only), haptic via navigator.vibrate on mobile complete, calm
   empty state ("All clear").

# Write-set (only these)
package.json, vite.config.ts, tsconfig.json, tailwind.config.*,
index.html, src/** (entry, App, components, db, sync seam, types),
test files.

# Do NOT touch
Any PWA / manifest / service-worker config (vite-plugin-pwa) — that is
issue #3. Projects, priority, tags, done_when, Today view, sync fields,
seed import, settings — all out of scope.

# Acceptance criteria (must all pass; add as automated tests where marked)
- TEST (Vitest): create two tasks via SyncProvider, read back, toggle one
  done, delete one — final state matches expectation.
- TEST: grep/assert no component imports Dexie directly; only the
  LocalOnly seam does.
- TEST: adding a task with empty/whitespace title creates nothing.
- TEST: after re-instantiating the DB (simulating reload), previously
  added tasks are still present.
- TEST: completing a task invokes navigator.vibrate when available (mock
  and assert called) and triggers the spring animation.
- `npm run build` succeeds with zero type errors.

# Done
Open a PR titled "Slice A — local-first task loop" against the base
branch, body linking issue #2 ("Closes #2"). Do not merge — CI must be
green and a human reviews. Report the PR URL.
