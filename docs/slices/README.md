# LifeOS — Slice Backbone

Each `slice-SN-*.md` here is a self-contained tracer-bullet brief, sized to hand to the **afk-pipeline** for execution. A Slice is a vertical increment that pierces every layer it touches (UI → local data → sync seam → PWA shell) and is shippable on its own (see `CONTEXT.md`).

Read this file + `CONTEXT.md` (domain language) before executing any slice.

## Product vision (the target)

LifeOS = a single-user, Apple-feel life tracker. **One source of truth (an Obsidian markdown vault), three faces:** a PWA dashboard, a Telegram bot, and Obsidian itself. The dashboard home is a **command center** ("what do I do now?"). See `memory/lifeos-vision-2026-06-22.md` for the full design rationale.

- **Domains** (7): Building Things, Career, Growth, Life Admin, Body & Mind, Finance, Relationship.
- **Hierarchy:** Domain → Project → Task. A Task carries a `done_when` (real finish line) and a `priority` (1–3).
- **Vault shape (eventual contract):** Domain = folder, Project = note, Task = a `- [ ]` checkbox line inside the Project note with inline fields (`done_when::`, `priority::`).
- **Balance brain:** NOW is ranked by priority but capped ~2 tasks/domain and injects 1 task from the *coldest* domain. **Warmth is derived, never logged** — completing a task heats its domain, silence cools it.
- **Look:** evolving from current Apple-feel toward **Glass/depth** (frosted panels, time-of-day gradient, domain-color glow) in Slice 11.
- **Capture:** manual on the `+` tab; Telegram bot (text/voice/photo, Claude-parsed, **confirm-destructive**) is the finale.

## Architecture invariants (do not break)

- **The sync seam** (`src/sync/SyncProvider.ts`, ADR-0002): UI, components and hooks depend **only** on the `SyncProvider` interface and `src/types`. They never import Dexie or the db.
- Only `src/db/LifeOSDb.ts` imports Dexie. Only `src/sync/LocalOnly.ts` imports `../db`. The provider is swapped in one place: `src/App.tsx`.
- **Interim truth = IndexedDB** via `LocalOnly`. The Obsidian vault becomes the real truth in Group D as a new `SyncProvider` body (`VaultSync`) — swapped at the seam, call sites unchanged.
- Growing the `Task` model = update `src/types/index.ts` **and** bump the Dexie schema version in `LifeOSDb.ts` when an indexed field changes.
- Every slice must keep the PWA **installable + offline** (no regression). CI gates build/test + emulated PWA install/offline checks (`docs/testing/pwa-emulation-protocol.md`).

## Current waterline — Slice S4 (shipped)

`Task { id, title, done, created_at, done_when?, priority?, project? }`. Seam mutation-generic (ADR-0004): `add(input: { title, done_when?, priority?, project? }) / update(id, patch: Partial<Pick<Task,'title'|'done_when'|'priority'|'project'>>) / list() / toggleDone(id) / delete(id)`. `priority` is `1 | 2 | 3`, the first Dexie-indexed field (schema **v2**). `project` is a denormalized free-text string — consumed only by in-memory grouping, so **no index, no schema bump** (still v2; ADR-0005). The list renders **grouped by project** via the pure helper `src/lib/groupByProject.ts` (Inbox-first for unparented); project-name suggestions come from `src/lib/distinctProjects.ts` feeding a native `<datalist>`. UI: shared `PriorityControl`, plus a native `<input list>` for project on create + inline edit. `LocalOnly` over IndexedDB. Installable offline PWA, Apple-feel UI.

**Shipped slices:** S1 (PRs #4/#6) · S2 (PRD #8 → #11 seam + #12 UI) · S3 (PRD #15 → #18 seam + #21 UI) · S4 (PRD #24 → single atomic slice #25 / PR #26; ADR-0005). **Next:** S5 domain + seed — `domain?: string` on the Task + seed import (Group A finale).

> Repo hygiene: `src/types` is a single `index.ts` (the old `task.ts` was folded in); ids use native `crypto.randomUUID()` (no `uuid` dep); the dead `src/sync/index.ts` barrel was removed (ponytail audit, PR #20). Import `Task` from `'../types'`.

## Target Task model (assembled across Group A + S9)

```ts
export interface Task {
  id: string
  title: string
  done: boolean
  created_at: number
  done_when?: string      // S2
  priority?: 1 | 2 | 3    // S3
  project?: string        // S4  (project name)
  domain?: string         // S5  (one of the 7 domains)
  completed_at?: number   // S9  (set when done flips true; cleared on un-done)
}
```

## Order & MVP line

```
Group A  S2–S5    grow the Task (done_when, priority, project, domain + seed)
Group B  S6–S10   daily driver: NOW view, tab bar, tap-dot, warmth, balance brain
Group C  S11–S13  the skin: Glass pass, smart capture, Pulse
──────── MVP ──────── (S2–S13: complete local dashboard, ship & live on it)
Group D  S14–S15  Obsidian vault becomes the truth (forces deferred transport decision)
Group E  S16–S19  Telegram bot (text → confirm edits → voice → photo)
```

## Conventions for executors

- TypeScript + React + Vite + Tailwind + Dexie + framer-motion. Tests: Vitest unit (see `src/test/syncProvider.test.ts`), Playwright e2e (`e2e/pwa.spec.ts`).
- Each slice adds/updates unit tests for new seam behaviour and keeps the e2e PWA suite green.
- Keep changes scoped to the slice. Push deferred concerns to the named later slice.
- Update `kanban.html` when a slice ships.
