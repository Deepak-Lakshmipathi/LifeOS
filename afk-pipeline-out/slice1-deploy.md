# LifeOS Slice 1 — Deploy Tables

Parent PRD: [#1](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/1). Ready to deploy, NOT auto-dispatched.

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| [#2](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/2) — Local-first task loop | Working add/list/complete/delete task app, persisted locally via a no-op sync seam, Apple-feel polish. | files: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.*`, `index.html`, `src/**`; PRD #1 + ADR-0001/0002; blocked by: none; do NOT touch: PWA/manifest/service-worker config (that is #3); test: Vitest CRUD-through-`SyncProvider` round-trip + no-direct-Dexie grep + persist-after-reload. | Sonnet | batch-1 (status:ready) |
| [#3](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/3) — PWA shell: installable + offline | Add vite-plugin-pwa, manifest, icons, service-worker precache; app installs + runs offline. | files: `vite.config.ts` (PWA config), `public/manifest.webmanifest`, `public/icons/**`, `index.html`; PRD #1 + ADR-0001; blocked by: #2 (shares `vite.config.ts` — must run after); do NOT touch: `src/**` task-loop logic; test: build emits SW + valid manifest, manifest-shape assertion. | Sonnet | batch-2 (after #2 closes) |

## HITL-flagged

| Issue | Why HITL | What the human must decide / do | Assumption made |
|-------|----------|----------------------------------|------------------|
| [#3](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/3) — final acceptance | Two of its acceptance criteria (install to home screen on Android + Windows; cold-start offline) can only be confirmed on the user's real devices — not in CI. | Run the install + airplane-mode check on the actual phone and laptop, record the result, then close. The code work itself is AFK. | — (interactive run) |

## Deploy hint

Run batch-1 (#2) first as its own Sonnet agent — prompt = issue #2 body + its Context cell. When #2 is closed and #3 flips to `status:ready`, run batch-2 (#3). Resolve #3's device-verification HITL step on the real phone + laptop before closing it. At dispatch, also launch a CI Build Supervisor scoped to these PRs; do not merge a PR until it reports green CI.
