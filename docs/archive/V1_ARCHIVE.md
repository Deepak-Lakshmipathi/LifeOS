# LifeOS V1 — Archived Docs

> Collapsed archive of all V1 (slices S1–S19) planning docs + pipeline run artifacts.
> Archived 2026-07-14 when V2 (Glass Cockpit) work started. Originals deleted; full history in git.
> NOT archived (still live): docs/adr/ (permanent decisions), afk-pipeline-out/LESSONS.md (active ledger), afk-pipeline-out/s16c-verify-checklist.md (open HITL gate), HANDOFF.md.

## Contents
- `docs/slices/README.md`
- `docs/slices/slice-S10-balance-brain.md`
- `docs/slices/slice-S11-glass-pass.md`
- `docs/slices/slice-S12-smart-capture.md`
- `docs/slices/slice-S13-pulse.md`
- `docs/slices/slice-S14-vault-read.md`
- `docs/slices/slice-S15-vault-write.md`
- `docs/slices/slice-S16-bot-text-create.md`
- `docs/slices/slice-S17-bot-confirm-edits.md`
- `docs/slices/slice-S18-bot-voice.md`
- `docs/slices/slice-S19-bot-photo.md`
- `docs/slices/slice-S2-done-when.md`
- `docs/slices/slice-S3-priority.md`
- `docs/slices/slice-S4-project.md`
- `docs/slices/slice-S5-domain-and-seed.md`
- `docs/slices/slice-S6-now-view.md`
- `docs/slices/slice-S7-tab-bar.md`
- `docs/slices/slice-S8-tap-dot-complete.md`
- `docs/slices/slice-S9-warmth.md`
- `afk-pipeline-out/slice1-deploy.md`
- `afk-pipeline-out/slice-a-dispatch.md`
- `afk-pipeline-out/slice-b-dispatch.md`
- `afk-pipeline-out/s2-done-when-deploy.md`
- `afk-pipeline-out/s4-project-deploy.md`
- `afk-pipeline-out/s5-domain-and-seed-deploy.md`
- `afk-pipeline-out/s6-now-view-deploy.md`
- `afk-pipeline-out/s15-vault-write-deploy.md`
- `afk-pipeline-out/telegram-bot-text-create-deploy.md`
- `afk-pipeline-out/s17-confirm-edits-deploy.md`
- `afk-pipeline-out/s18-voice-prd.md`
- `afk-pipeline-out/s18-voice-issue.md`
- `afk-pipeline-out/s18-voice-deploy.md`
- `afk-pipeline-out/s19-bot-photo-deploy.md`
- `afk-pipeline-out/_prd.md`
- `afk-pipeline-out/_prd_post.md`
- `afk-pipeline-out/_issueA.md`
- `afk-pipeline-out/_issueA_post.md`
- `afk-pipeline-out/_issueB.md`
- `afk-pipeline-out/_issueB_post.md`

---

# ARCHIVED FILE: docs/slices/README.md

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

## Current waterline — Slice S5 (shipped — Group A complete)

`Task { id, title, done, created_at, done_when?, priority?, project?, domain? }`. Seam mutation-generic (ADR-0004): `add(input: { title, done_when?, priority?, project?, domain? }) / update(id, patch: Partial<Pick<Task,'title'|'done_when'|'priority'|'project'|'domain'>>) / list() / toggleDone(id) / delete(id)`. `priority` is `1 | 2 | 3`, the only Dexie-indexed field (schema **v2**). `project` and `domain` are denormalized free-text strings — consumed only by in-memory grouping, so **no index, no schema bump** (still v2; ADR-0005/ADR-0006). `domain` is constrained to the 7 `DOMAINS` (`src/data/domains.ts`, with `DOMAIN_COLORS` palette); empty/invalid normalizes to unset at the seam. The list renders **nested Domain → Project → Task** via `src/lib/groupByDomain.ts` (nests the existing `groupByProject`; domain-less under "Inbox", DOMAINS-ordered domains); project suggestions via `distinctProjects.ts` + `<datalist>`, domain via a native `<select>`. On first run with an empty DB, `src/data/seed.ts` `seedIfEmpty` imports `seed_tasks_detailed.json` (107 tasks; idempotent empty-check; `?noseed` test hook). `LocalOnly` over IndexedDB. Installable offline PWA, Apple-feel UI.

**Shipped slices:** S1 (PRs #4/#6) · S2 (PRD #8 → #11 seam + #12 UI) · S3 (PRD #15 → #18 seam + #21 UI) · S4 (PRD #24 → #25 / PR #26; ADR-0005) · S5 (PRD #29 → single atomic slice #30 / PR #31; ADR-0006). **Group A done. Next:** S6 NOW view (dumb brain) — first command-center surface, flat priority-ranked list (Group B).

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

---

# ARCHIVED FILE: docs/slices/slice-S10-balance-brain.md

# Slice S10 — Balance brain v1

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** B · **Depends on:** S9 · **Status:** planned

## Why
The command center lives or dies on *how NOW is chosen*. Upgrade the dumb ranking (S6) to the balance brain: keep it loud where it matters but force life-balance, and surface the domain going cold so nothing rots in silence.

## Scope — this slice only
- Replace/extend `rankNow` with the balance algorithm:
  1. Order open tasks by priority (desc), age (asc).
  2. **Cap ~2 tasks per domain** in the live NOW set so no single domain floods it.
  3. **Inject 1 "rescue" task** from the **coldest** domain (from `computeWarmth`, S9), marked distinctly (the ❄ rescue card).
- NOW card for the rescue task shows its cold state.

## Out of scope
- Momentum/streak weighting, nightly hand-pick, glass styling. Per-domain cap count is a tunable constant.

## Data / model change
- None. Pure logic over tasks + warmth.

## Vertical
- Logic: `rankNow(tasks, warmth, opts)` — pure, unit-tested: caps, rescue injection, tie-breaks, edge cases (no cold domain, fewer tasks than slots).
- UI: `NowView` consumes the new ranking; rescue card styled distinctly (reuse warmth word/glow).
- Seam/store: read-only.
- PWA: offline unaffected.

## Acceptance criteria (done_when)
- [ ] NOW never shows more than the cap per domain in the live set.
- [ ] Exactly one rescue task from the coldest domain is injected when one exists; none if all domains warm/empty.
- [ ] Rescue card is visually distinct (cold marker).
- [ ] `rankNow` fully unit-tested incl. edge cases; deterministic given inputs.
- [ ] PWA e2e green.

## Relevant files
`src/now/rankNow.ts` (+ test), `src/warmth/computeWarmth.ts`, `src/components/NowView.tsx`.

## Notes for executor
Cap and bucket thresholds are named constants. Keep `rankNow` pure (inject warmth + now). This is the product's soul — invest in the test matrix.

---

# ARCHIVED FILE: docs/slices/slice-S11-glass-pass.md

# Slice S11 — Glass / depth visual pass

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** C · **Depends on:** S10 · **Status:** planned

## Why
The chosen identity: **Glass/depth** (visionOS-ish). Translucent frosted panels, a soft time-of-day gradient behind everything, domain-color glow on card edges and warmth tiles. This is the emotional payoff that turns a task list into "a mirror."

## Scope — this slice only
- Establish the glass design system: frosted card material (blur + translucency), elevation, a background gradient that shifts by time of day.
- Apply to NOW cards (domain-color glow on the left edge), the Domains warmth tiles (glow intensity = warmth), tab bar (frosted), top bar.
- Tune the domain palette for glass (colors readable through frost).
- Honor `prefers-reduced-motion` and `prefers-reduced-transparency` (fallback to solid).

## Out of scope
- New features. This is purely visual. No model or seam change.

## Data / model change
- None.

## Vertical
- UI/CSS: Tailwind config + `index.css` for glass tokens (backdrop-blur, layered backgrounds, gradient); shared `GlassPanel` primitive; restyle existing components.
- PWA: ensure blur/gradient don't hurt offline or Lighthouse PWA score.

## Acceptance criteria (done_when)
- [ ] Frosted glass material applied consistently across NOW, Domains, tab bar, top bar.
- [ ] Time-of-day gradient background renders and shifts (morning/day/evening/night).
- [ ] Domain-color glow on NOW cards + warmth tiles reads clearly.
- [ ] Reduced-transparency / reduced-motion fallbacks render solid + still.
- [ ] PWA install/offline e2e + Lighthouse PWA check still green.

## Relevant files
`tailwind.config.js`, `src/index.css`, new `src/components/GlassPanel.tsx`, all view/components, `src/data/domains.ts` (palette tuning), `scripts/lh-pwa.mjs` (verify score).

## Notes for executor
Keep it tasteful, not neon. Centralize glass tokens so future screens inherit them. Verify backdrop-blur performance on a mid Android device.

---

# ARCHIVED FILE: docs/slices/slice-S12-smart-capture.md

# Slice S12 — Smart capture on the `+` tab

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** C · **Depends on:** S11 · **Status:** planned

## Why
Manual capture is one of the two channels (the bot is the other, later). Make it fast and forgiving: one field that parses natural shorthand into a structured task, defaulting to Inbox when unsorted.

## Scope — this slice only
- Single capture field on `+` that parses inline tokens from free text:
  - `#domain` → domain (fuzzy-match to one of the 7)
  - `!1`/`!2`/`!3` → priority
  - `when …` (to end) or `~ …` → `done_when`
  - `/project` or chosen project → project
  - remaining text → title
- Live preview of the parsed task before commit; unmatched → Inbox (no domain).
- Commit creates the task via the seam.

## Out of scope
- Voice/photo/NLU via Claude (that's the Telegram bot, Group E). This is deterministic local parsing only.

## Data / model change
- None (uses `add(input)` from Group A).

## Vertical
- Logic: pure `parseCapture(text): TaskInput` helper, heavily unit-tested (tokens in any order, missing tokens, fuzzy domain match).
- UI: capture field + live parsed preview; reuses glass styling.
- Seam/store: `add(input)`.
- PWA: offline unaffected (parsing is local).

## Acceptance criteria (done_when)
- [ ] `parseCapture` extracts domain/priority/done_when/project/title from shorthand in any order; pure + unit-tested.
- [ ] Unmatched domain → task lands in Inbox.
- [ ] Live preview shows the parsed result before commit.
- [ ] Committing persists a correct task.
- [ ] PWA e2e green.

## Relevant files
New `src/capture/parseCapture.ts` (+ test), new/updated `src/components/CaptureSheet.tsx`, `src/components/TabBar.tsx`, `src/hooks/useTasks.ts`.

## Notes for executor
Keep parsing rules in the pure helper and document the mini-syntax in a comment. The Telegram bot (S16) will later reuse the *concept* but via Claude, not this regex parser — don't couple them.

---

# ARCHIVED FILE: docs/slices/slice-S13-pulse.md

# Slice S13 — Pulse tab (light)

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** C · **Depends on:** S12 · **Status:** planned — **closes the MVP**

## Why
A light trends surface — not a quantified-self dashboard (the user chose command-center over data-first). Just enough reflection: what got done, which domains are warm/cold. Everything derived, nothing to maintain.

## Scope — this slice only
- Pulse tab content:
  - **Done this week** count (from `completed_at`).
  - **Per-domain warmth** summary (reuse `computeWarmth`, S9) — the warm/cold standings.
  - A small completions-per-day sparkline for the last 7 days.
- Read-only; derived entirely from existing task data.

## Out of scope
- Streaks, goals, per-project analytics, configurable ranges. Keep it light by design.

## Data / model change
- None.

## Vertical
- Logic: pure helpers `doneThisWeek(tasks, now)`, `completionsByDay(tasks, now, 7)` — unit-tested with injected clock.
- UI: `PulseView` with count, warmth standings, sparkline (glass styled).
- Seam/store: read-only.
- PWA: offline unaffected.

## Acceptance criteria (done_when)
- [ ] Pulse shows done-this-week count, per-domain warmth standings, 7-day sparkline.
- [ ] All metrics derived from task data; deterministic with injected `now`; unit-tested.
- [ ] Replaces the S7 placeholder; glass-styled.
- [ ] PWA e2e green.
- [ ] **MVP complete** — update `kanban.html` marking Groups A–C shipped.

## Relevant files
New `src/pulse/metrics.ts` (+ test), new `src/components/PulseView.tsx`, `src/warmth/computeWarmth.ts`, `src/components/TabBar.tsx`, `kanban.html`.

## Notes for executor
Resist scope creep — Pulse stays light intentionally. Inject `now` everywhere; no `Date.now()` in pure helpers.

---

# ARCHIVED FILE: docs/slices/slice-S14-vault-read.md

# Slice S14 — Obsidian vault read (VaultSync)

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** D · **Depends on:** S13 (MVP) · **Status:** planned · **⚠ Forces the deferred transport decision**

## Why
The vault is the product's promised source of truth. This slice swaps the seam's body from `LocalOnly` to a `VaultSync` that **reads** the Obsidian vault, so the dashboard reflects what's on disk and in Obsidian. Read-only first to de-risk parsing before writing back.

## ⚠ Gate — decide before building
The vault is files; the PWA is sandboxed. Pick the transport (was deferred in design):
- **Bridge service** (a small Node service co-located with the vault, exposes a read API; vault synced across devices via Syncthing/Obsidian Sync), **or**
- **File System Access API** (PWA opens a vault folder on desktop; no mobile), **or**
- **Git-as-transport** (PWA pulls a vault repo).
**DECIDED (ADR-0009): git-as-transport** — in-browser clone of the vault repo into IndexedDB (isomorphic-git + CORS proxy). Chosen over the bridge because offline-on-Android-away-from-home is a hard requirement the bridge fails on mobile. FS Access API rejected (desktop-only). See `docs/adr/0009-vault-read-transport.md`.

## Scope — this slice only
- Markdown parser: read Domain folders → Project notes → `- [ ]`/`- [x]` task lines with inline `done_when::` and `priority::` fields → `Task[]`.
- `VaultSync implements SyncProvider` — `list()` reads the vault via the chosen transport; `add/toggleDone/delete` may throw "read-only" this slice (write is S15).
- Feature-flag the provider swap in `App.tsx` (env/flag) so MVP `LocalOnly` stays default until vault is solid.

## Out of scope
- Writing back to the vault (S15). Bot (Group E). Conflict resolution beyond read.

## Data / model change
- No `Task` shape change — the markdown is parsed *into* the existing model. Map `- [x]` → `done`, inline fields → `done_when`/`priority`, folder → `domain`, note → `project`.

## Vertical
- Logic: pure `parseVault(files): Task[]` + `parseTaskLine(line)` helpers, unit-tested against markdown fixtures.
- Seam: new `src/sync/VaultSync.ts`; transport adapter behind an interface.
- Config: provider selection flag in `App.tsx`.
- PWA: offline behavior depends on transport — document it in the ADR.

## Acceptance criteria (done_when)
- [ ] ADR written capturing the transport choice.
- [ ] `parseVault`/`parseTaskLine` parse the documented vault shape incl. checked/unchecked, missing inline fields, multiple projects/domains; unit-tested via fixtures.
- [ ] With the flag on, the dashboard lists tasks read from a sample vault.
- [ ] `LocalOnly` remains default when flag off; no MVP regression.
- [ ] Seam discipline intact (UI unchanged; only the provider body swapped).

## Relevant files
New `src/sync/VaultSync.ts`, new `src/vault/parseVault.ts` (+ fixtures + test), new transport adapter, `src/App.tsx`, new `docs/adr/0005-vault-transport.md`.

## Notes for executor
The parser is the risky part — fixture-test it hard, including malformed lines (skip gracefully). Keep transport behind an interface so it can change without touching the parser.

---

# ARCHIVED FILE: docs/slices/slice-S15-vault-write.md

# Slice S15 — Obsidian vault write (VaultSync write)

> Read `docs/slices/README.md` + `CONTEXT.md` + `docs/adr/0010-vault-write.md` first.

**Group:** D · **Depends on:** S14 (vault read) · **Status:** planned · **All design locked in ADR-0010 — carry it, don't reopen.**

## Why
S14 made `VaultSync` read the vault; its mutations still throw `'vault is read-only until S15'`. S15 makes them real writes so the vault becomes the source of truth for writes too — and exports the serializer + `writeFile` transport that the S16 Telegram bot reuses.

## Scope — split by AFK/HITL verifiability (ADR-0010 §Slicing)
- **S15a (AFK):** pure `serializeTaskLine` + `VaultSync` real mutations (single-line splice, in-memory source-map identity, promise-chain write-queue), tested against a **fake transport** (no git/network). Extends the `VaultTransport` interface with `writeFile` + a throwing `GitTransport` stub.
- **S15b (HITL):** real `GitTransport.writeFile` (add/commit/best-effort push) + the wipe-reclone hazard fix + `Inbox/` folder scan + `parseVault` Inbox-filename rule. Needs write-PAT + live vault → hand-verify.

## Out of scope (ADR-0010 scope fence)
Sync fields / `updated_at` / `deleted_at` / tombstones / LWW / Dexie migration; durable `id::` identity (S16); `completed_at`/`created_at` persistence (warmth/pulse stay degraded, inherited from S14); git merge / conflict UI; dual-write; file-watch/polling.

## Data / model change
**None.** No `Task` shape change, schema stays v2, no migration (ADR-0010 §1).

## Acceptance criteria (done_when)
**S15a:**
- [ ] `src/vault/serialize.ts`: pure `serializeTaskLine(task): string`, inverse of `parseTaskLine`, `done_when` before `priority`, emit-only-when-present, no `id::`.
- [ ] Round-trip test: `parseTaskLine(serializeTaskLine(t))` ≡ `t` over modeled fields (title/done/done_when/priority), for checked/unchecked, both fields either presence, neither.
- [ ] `VaultSync` mutations real: `add` appends a serialized line at the resolved path (ADR-0010 §5); `update`/`toggleDone`/`delete` splice/remove the matched raw line; non-unique match → throw. All other bytes of the file preserved.
- [ ] `VaultSync.list()` builds the source-map snapshot; mutations go through the promise-chain write-queue (FIFO).
- [ ] Tested against a **fake transport** that captures `writeFile(path, content)` — assert committed content, no network. `npm test` green.
- [ ] `VaultTransport` interface gains `writeFile(path, content, message)`; `GitTransport.writeFile` throws `'not implemented until S15b'` (VITE_VAULT off by default).

**S15b:**
- [ ] `GitTransport.writeFile`: FS write → `git.add` + `git.commit` (authoritative) → best-effort `git.push` (swallow failure).
- [ ] Wipe-reclone hazard fixed: never wipe when local commits are ahead of origin (ADR-0010 §Must-fix).
- [ ] `readFiles()` also scans top-level `Inbox/`; `parseVault` maps filename `Inbox` → `project = undefined`.
- [ ] Hand-verified against the real vault with a write-scoped PAT: a PWA mutation lands as a commit on the vault repo and re-reads correctly.

## Relevant files
`src/vault/serialize.ts` (new), `src/vault/serialize.test.ts` (new), `src/sync/VaultSync.ts`, `src/sync/VaultSync.test.ts` (new), `src/vault/transport.ts`, `src/vault/parseVault.ts` (S15b Inbox rule).

## Notes for executor
The splice must be byte-preserving on every non-target line — that is the load-bearing correctness property; test it. Keep all git/network behind the `VaultTransport` interface exactly as S14 did; S15a proves correctness with a fake transport, S15b wires the real git and is hand-verified. Do NOT touch `src/types/index.ts`, `src/db/`, `src/sync/SyncProvider.ts`, or `App.tsx`.

---

# ARCHIVED FILE: docs/slices/slice-S16-bot-text-create.md

# Slice S16 — Telegram bot: text → create

> Read `docs/slices/README.md` + `CONTEXT.md` first. For Claude API usage, consult the `claude-api` skill.

**Group:** E · **Depends on:** S15 · **Status:** planned

## Why
The capture-from-anywhere payoff. Thinnest bot first: text a task, Claude parses it, it's created in the vault and shows up on the dashboard. No media, no edits yet.

## Scope — this slice only
- A Telegram bot (separate deployable, e.g. `services/bot/`, Node/TS) using the official Telegram Bot API.
- **Auth:** only the owner's Telegram chat id is accepted; all others ignored.
- On a text message → call Claude to classify intent (this slice handles **create** only) and extract `{ title, domain, project, done_when, priority }`.
- Write the task to the vault via the same vault layer as S15 (share the parser/serializer + transport; do not duplicate).
- Reply with a confirmation: `✓ added '<title>' · <domain> · P<priority>`.

## Out of scope
- update/delete (S17, with confirm-destructive), voice (S18), photo (S19). Non-create intents → reply "not yet supported".

## Data / model change
- None (writes existing model to the vault).

## Vertical
- Service: Telegram webhook/long-poll handler; owner-id guard; Claude call (intent + extraction with a structured output schema); vault write.
- Shared: reuse `serializeTaskLine`/transport from S15 (extract to a shared module if needed).
- Dashboard: no change — it already reflects the vault (S14/S15).

## Acceptance criteria (done_when)
- [ ] Only the owner's chat id is served; others ignored/denied.
- [ ] A free-text message creates a correctly-parsed task in the vault; dashboard shows it.
- [ ] Bot replies with the created task summary.
- [ ] Claude extraction uses a structured schema (latest Claude model per `claude-api`); ambiguous domain → Inbox.
- [ ] Secrets (bot token, Claude key) via env, never committed; owner id configurable.
- [ ] Unit/integration test for the intent→task mapping with mocked Claude.

## Relevant files
New `services/bot/` (handler, Claude client, config), shared vault write module from S15, repo README/deploy notes.

## Notes for executor
Keep the model's job narrow this slice: classify + extract for **create**. Use the latest Claude model. Treat the bot as a separate process from the PWA; they meet only at the vault.

---

# ARCHIVED FILE: docs/slices/slice-S17-bot-confirm-edits.md

# Slice S17 — Telegram bot: confirm update/delete

> Read `docs/slices/README.md` + `CONTEXT.md` first. Claude usage → `claude-api` skill.

**Group:** E · **Depends on:** S16 · **Status:** planned

## Why
Capture isn't enough — the bot must edit and remove tasks conversationally. But edits are destructive, so the trust model is **confirm-destructive**: create fires instantly (S16); update/delete echo the intended change and wait for a yes.

## Scope — this slice only
- Extend intent handling to **update** and **delete**.
- **Find the target task** from a fuzzy reference ("the GST thing") by searching vault tasks; if multiple plausible matches, ask the user to pick.
- **Confirm before acting:** reply with the exact change ("Delete 'GST registration' from Finance? (y/n)" / "Set 'call CA' to P3? (y/n)") and only commit on confirmation.
- Apply via the vault write layer (S15); reply with the result.

## Out of scope
- Voice (S18), photo (S19). Multi-step batch edits.

## Data / model change
- None.

## Vertical
- Service: intent classification now covers create/update/delete; a lightweight per-chat conversation state to hold a pending confirmation; disambiguation prompt; vault mutate.
- Matching: a task-search helper (title/project/domain fuzzy match) — unit-tested.
- Dashboard: reflects changes via the vault.

## Acceptance criteria (done_when)
- [ ] "mark X done" / "delete X" / "change X priority" are classified and resolved to a specific task.
- [ ] Ambiguous reference → bot lists candidates and waits for a pick.
- [ ] update/delete are **not** applied until the user confirms; "n"/timeout cancels.
- [ ] create still fires instantly (no regression).
- [ ] Confirmation state is per-chat and owner-guarded.
- [ ] Tests cover matching + the confirm gate (mocked Claude).

## Relevant files
`services/bot/` (intent handler, conversation state, task-search helper + test), vault write module (S15).

## Notes for executor
Keep confirmation state minimal and expiring. Never mutate on a low-confidence match without confirmation. Mirror the dashboard's tap-dot Undo philosophy: reversible, explicit.

---

# ARCHIVED FILE: docs/slices/slice-S18-bot-voice.md

# Slice S18 — Telegram bot: voice notes

> Read `docs/slices/README.md` + `CONTEXT.md` first. Claude usage → `claude-api` skill.

**Group:** E · **Depends on:** S17 · **Status:** planned

## Why
The most natural capture: talk to it from the car. A voice note → transcript → the same intent pipeline (create/update/delete with confirm-destructive).

## Scope — this slice only
- Handle Telegram voice messages: download the audio file (Telegram media API).
- Transcribe to text (speech-to-text service).
- Feed the transcript into the **existing** intent pipeline (S16/S17) — no new task logic.
- Echo the transcript in the reply so the user can see what was heard ("heard: '…' → ✓ added …").

## Out of scope
- Photo (S19). Multi-language tuning beyond the user's language. Long-audio chunking unless trivial.

## Data / model change
- None.

## Vertical
- Service: voice download → transcription adapter (behind an interface) → existing intent handler.
- Reply includes the recognized transcript for transparency.

## Acceptance criteria (done_when)
- [ ] A voice note is downloaded, transcribed, and routed through the intent pipeline.
- [ ] Create fires; update/delete still confirm (S17 behavior preserved).
- [ ] Reply shows the transcript + the action taken.
- [ ] Transcription is behind an interface (swappable provider); owner-guarded.
- [ ] Integration test with a fixture audio/mock transcriber.

## Relevant files
`services/bot/` (voice handler, transcription adapter), reuse intent pipeline (S16/S17).

## Notes for executor
Don't fork the intent logic — voice only adds a transcription front-end. Show the transcript so mis-hears are caught before acting (especially for destructive intents, which still confirm).

---

# ARCHIVED FILE: docs/slices/slice-S19-bot-photo.md

# Slice S19 — Telegram bot: photos (vision)

> Read `docs/slices/README.md` + `CONTEXT.md` first. Claude usage → `claude-api` skill.

**Group:** E · **Depends on:** S18 · **Status:** planned — **completes the vision**

## Why
The richest capture: photograph a whiteboard, a receipt, a handwritten list, a screenshot — and have it become tasks. Closes the "one software to rule them all" loop.

## Scope — this slice only
- Handle Telegram photo messages: download the image (+ any caption).
- Use Claude vision to read the image and extract **one or more** tasks with `{ title, domain, project, done_when, priority }`.
- Multiple tasks → present the parsed set and **confirm before creating** (batch confirm, consistent with confirm-destructive ethos for bulk creation).
- Caption text augments/guides extraction.

## Out of scope
- Anything beyond task extraction (e.g. storing the image as an attachment) unless trivial. PDF/multi-page.

## Data / model change
- None.

## Vertical
- Service: photo download → Claude vision (image + caption) → structured task list → batch-confirm → vault writes via S15.
- Reuse confirmation/conversation state from S17 for the batch case.

## Acceptance criteria (done_when)
- [ ] A photo is downloaded and read by Claude vision into a structured task list.
- [ ] Multiple extracted tasks are shown for confirmation before creation; user can accept/reject the set.
- [ ] Caption guides extraction when present.
- [ ] Owner-guarded; uses the latest vision-capable Claude model.
- [ ] Integration test with a fixture image/mocked vision response.
- [ ] **Vision complete** — update `kanban.html`; the three faces (dashboard, bot, Obsidian) all operate over one vault.

## Relevant files
`services/bot/` (photo handler, Claude vision client), reuse confirmation state (S17) + vault write (S15), `kanban.html`.

## Notes for executor
Bulk creation is effectively destructive-by-volume — confirm the set before writing. Use the latest vision-capable Claude model per `claude-api`. Keep extraction prompt-driven and testable with a mocked response.

---

# ARCHIVED FILE: docs/slices/slice-S2-done-when.md

# Slice S2 — Task gains `done_when`

> Read `docs/slices/README.md` + `CONTEXT.md` first. This is a tracer-bullet vertical slice.

**Group:** A · **Depends on:** Slice 1 (shipped) · **Status:** ✅ shipped (PRs #11 seam + #12 UI; PRD #8, ADR-0004)

## Why
A Task's real finish line is its `done_when` — *how you know it's truly done* — not just a checkbox. It's core domain language (`CONTEXT.md`) and the first step toward the vault shape. Without it a task is just a title.

## Scope — this slice only
- Add optional `done_when` to the `Task` model.
- Let the user set/edit it when adding a task and on an existing task.
- Show it on the task card, secondary to the title (small, beneath it).

## Out of scope
- Priority (S3), project/domain (S4/S5), NOW view, styling overhaul. Keep current Apple-feel.

## Data / model change
- `src/types/index.ts`: add `done_when?: string`.
- `LocalOnly.add` grows to accept an optional `done_when`. **Seam decision:** change `add(title: string)` → `add(input: { title: string; done_when?: string })` OR add `update(id, patch)` for editing. Recommended: introduce `add(input)` + a generic `update(id, patch: Partial<Pick<Task,'title'|'done_when'>>)` now — future field slices reuse `update`.
- No Dexie index needed (`done_when` is not queried); no schema version bump.

## Vertical
- UI: `AddTaskInput` gains an optional second line/field for `done_when`; `TaskItem` renders it under the title.
- Hook: `useTasks.addTask` signature follows the seam; add `updateTask(id, patch)`.
- Seam: `SyncProvider.add` + new `update`.
- Store: `LocalOnly` persists/patches the field.
- PWA: no change; still offline.

## Acceptance criteria (done_when)
- [ ] A task can be created with a `done_when`; it persists across reload (IndexedDB).
- [ ] `done_when` renders on the card beneath the title when present, hidden when absent.
- [ ] An existing task's `done_when` can be edited and the change persists.
- [ ] Unit tests cover seam `add` with/without `done_when` and `update`.
- [ ] PWA install/offline e2e still green.

## Relevant files
`src/types/index.ts`, `src/sync/SyncProvider.ts`, `src/sync/LocalOnly.ts`, `src/hooks/useTasks.ts`, `src/components/AddTaskInput.tsx`, `src/components/TaskItem.tsx`, `src/test/syncProvider.test.ts`.

## Notes for executor
Maintain seam discipline — components never touch Dexie. Prefer the generic `update(id, patch)` so S3–S5 don't each invent their own setter.

---

# ARCHIVED FILE: docs/slices/slice-S3-priority.md

# Slice S3 — Task gains `priority` (1–3)

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** A · **Depends on:** S2 · **Status:** planned

## Why
Priority is what the balance brain (S6/S10) ranks on. The seed data already carries `priority` 1–3. Capturing it now means NOW has signal to work with later.

## Scope — this slice only
- Add optional `priority: 1 | 2 | 3` to `Task` (3 = highest, matching seed).
- Set it on create + edit (simple 3-way control: P1/P2/P3, default unset or 2).
- Show a small weight indicator on the card (e.g. a colored dot or P-badge).

## Out of scope
- Sorting/ranking by priority (that's the NOW view, S6). This slice only stores + displays.

## Data / model change
- `src/types/index.ts`: add `priority?: 1 | 2 | 3`.
- Reuse `update(id, patch)` from S2; extend `add(input)` to accept `priority`.
- Add `priority` to the Dexie index in `LifeOSDb.ts` (NOW will query/sort by it) → **bump schema to version(2)** with the new index string.

## Vertical
- UI: priority control in `AddTaskInput` + edit; weight indicator in `TaskItem`.
- Seam/store: `add`/`update` carry `priority`; Dexie indexed.
- PWA: offline unaffected (Dexie upgrade runs locally).

## Acceptance criteria (done_when)
- [ ] A task can be created/edited with priority 1–3; persists across reload.
- [ ] Priority shows as a clear weight indicator on the card.
- [ ] Dexie schema bumped to v2; existing tasks (no priority) survive the upgrade.
- [ ] Unit tests cover `priority` round-trip via the seam.
- [ ] PWA e2e green.

## Relevant files
`src/types/index.ts`, `src/db/LifeOSDb.ts`, `src/sync/LocalOnly.ts`, `src/sync/SyncProvider.ts`, `src/hooks/useTasks.ts`, `src/components/AddTaskInput.tsx`, `src/components/TaskItem.tsx`, `src/test/syncProvider.test.ts`.

## Notes for executor
Test the Dexie v1→v2 upgrade path: a task stored before the index exists must still load. Keep `priority` optional so legacy/un-prioritized tasks are valid.

---

# ARCHIVED FILE: docs/slices/slice-S4-project.md

# Slice S4 — Task belongs to a Project

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** A · **Depends on:** S3 · **Status:** ✅ shipped (PRD #24 → slice #25 / PR #26, 2026-06-29; ADR-0005)

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
- Reuse `update`/`add`. **Decided (ADR-0005): NOT indexed** — grouping is in-memory over `list()`, no project-scoped query exists, so no Dexie index and schema stays **v2** (`LifeOSDb.ts` untouched).

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

---

# ARCHIVED FILE: docs/slices/slice-S5-domain-and-seed.md

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

---

# ARCHIVED FILE: docs/slices/slice-S6-now-view.md

# Slice S6 — NOW view (dumb brain)

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** B · **Depends on:** S5 · **Status:** planned

## Why
The home screen's job is to answer "what do I do now?" (command center). Start with the simplest honest ranking — pure priority — so the surface exists and is trusted before the balance brain (S10) makes it smart.

## Scope — this slice only
- A **NOW** view: a ranked, cross-domain queue of open (not done) tasks.
- Ranking v0: priority 3 → 2 → 1, ties by oldest `created_at`. Domain-blind.
- Show top 3–5 as live cards; fold the rest under "Up next" / "Later" (collapsed counts).
- Card shows title + `done_when` + project chip (reuse S2/S4 rendering).

## Out of scope
- Per-domain cap, coldest-domain injection, warmth (S9/S10). Tab bar (S7) — for now NOW can be the default view or a toggle next to the full list.

## Data / model change
- None. Pure selection/sort over existing tasks.

## Vertical
- UI: new `NowView` component rendering ranked cards + collapsible Up next/Later.
- Logic: pure `rankNow(tasks): Task[]` helper (priority desc, created_at asc), fully unit-tested.
- Seam/store: read-only via `list()`.
- PWA: offline unaffected.

## Acceptance criteria (done_when)
- [ ] NOW shows open tasks ordered by priority then age; done tasks excluded.
- [ ] Top 3–5 are live; remainder folded under Up next/Later with counts.
- [ ] `rankNow` is a pure, unit-tested function.
- [ ] Completing a task removes it from NOW and the next rises.
- [ ] PWA e2e green.

## Relevant files
New `src/now/rankNow.ts` (+ test), new `src/components/NowView.tsx`, `src/App.tsx`, reuse `src/components/TaskItem.tsx`.

## Notes for executor
Keep ranking logic out of the component. `rankNow` is the seam the balance brain (S10) will replace/extend — design its signature to later accept warmth data.

---

# ARCHIVED FILE: docs/slices/slice-S7-tab-bar.md

# Slice S7 — Tab bar navigation

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** B · **Depends on:** S6 · **Status:** planned

## Why
The app needs its navigation shape: a bottom tab bar (Now / Domains / Pulse / +), thumb-reachable, Apple-native. This is the frame every later screen plugs into.

## Scope — this slice only
- Bottom tab bar with 4 tabs: **Now**, **Domains**, **Pulse**, **+**.
- **Now** → `NowView` (S6). **Domains** → the Domain→Project→Task grouped list (from S5, moved here). **Pulse** → placeholder ("coming soon"). **+** → the add flow (current `AddTaskInput`, modal or sheet).
- Active-tab state; mobile-first layout, safe-area aware.

## Out of scope
- Warmth tiles on Domains (S9), Pulse content (S13), smart capture (S12), glass styling (S11).

## Data / model change
- None.

## Vertical
- UI: `TabBar` component + view switching in `App.tsx` (simple state or a light router; no new heavy dep preferred).
- PWA: tabs must work offline; no regression to install/offline.

## Acceptance criteria (done_when)
- [ ] Four tabs render; tapping switches views; active state visible.
- [ ] Now/Domains/+ are functional; Pulse is a labeled placeholder.
- [ ] Layout respects mobile safe areas; tab bar fixed at bottom.
- [ ] PWA install/offline e2e green; e2e updated to navigate via tabs.

## Relevant files
New `src/components/TabBar.tsx`, `src/App.tsx`, existing views (`NowView`, the grouped list), `e2e/pwa.spec.ts`.

## Notes for executor
Prefer simple local state over adding a router unless deep-linking is needed. Keep each tab's view a standalone component so later slices edit one screen without touching navigation.

---

# ARCHIVED FILE: docs/slices/slice-S8-tap-dot-complete.md

# Slice S8 — Tap-the-dot complete + undo

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** B · **Depends on:** S7 · **Status:** planned

## Why
Completing a task is the action you do most. The chosen gesture: tap the ● → it fills to ✓ with a ring pulse, the card fades and folds away, and a 3-second Undo toast appears. Precise, no accidental completes, identical on desktop + mobile.

## Scope — this slice only
- Replace the current toggle UI with a tappable status dot on each card (NowView + Domains list).
- Completion animation: dot fills → ✓, ring pulse, card fades to ~40% then collapses out (framer-motion).
- **Undo toast** for 3s: tapping Undo reverts the completion (re-toggle).
- Keep existing haptic (`navigator.vibrate`).

## Out of scope
- `completed_at` timestamp + warmth (S9) — this slice keeps toggling `done` only. Glass styling (S11).

## Data / model change
- None (still `toggleDone`).

## Vertical
- UI: dot control in `TaskItem`; completion animation; `UndoToast` component + a small dismiss-timer hook.
- Hook: `useTasks.toggleDone` already exists; add transient "recently completed" state to drive Undo.
- PWA: offline unaffected.

## Acceptance criteria (done_when)
- [ ] Tapping the dot completes the task with the fill→✓→fade→fold animation.
- [ ] An Undo toast shows for 3s; Undo reverts; after 3s it auto-dismisses.
- [ ] Works in NowView and the Domains list; haptic fires on mobile.
- [ ] Completing in NOW lets the next task rise (integrates with S6).
- [ ] PWA e2e green.

## Relevant files
`src/components/TaskItem.tsx`, new `src/components/UndoToast.tsx`, `src/hooks/useTasks.ts`, `src/components/NowView.tsx`.

## Notes for executor
Undo = re-issue `toggleDone(id)` within the window; don't invent a separate "undo" seam method. Respect `prefers-reduced-motion`.

---

# ARCHIVED FILE: docs/slices/slice-S9-warmth.md

# Slice S9 — Domain warmth (derived) + Domains map

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** B · **Depends on:** S8 · **Status:** planned

## Why
The core feedback loop: **warmth is derived, never logged.** Completing a task heats its domain; silence cools it. The Domains tab becomes a map of glowing/frosting tiles so you *feel* neglect before it's a problem. This also feeds the balance brain (S10).

## Scope — this slice only
- Record `completed_at` on a Task when `done` flips true (cleared when un-done).
- Compute per-domain warmth from the most recent `completed_at` in that domain, bucketed by age into states: **hot / warm / ok / stale / cold** (define thresholds, e.g. ≤2d / ≤5d / ≤10d / ≤20d / older or never).
- Domains tab: a tile per domain showing **glow intensity (domain color) + a one-word state**. No raw numbers.

## Out of scope
- Using warmth to rank NOW (that's S10). Glass material (S11) — tiles can be styled-but-simple now. Pulse trends (S13).

## Data / model change
- `src/types/index.ts`: add `completed_at?: number`.
- `LocalOnly.toggleDone`: set `completed_at = Date.now()` when completing, unset when un-completing.
- Dexie: index `completed_at` if needed for the "latest per domain" query → schema bump.

## Vertical
- UI: `DomainsMap` with warmth tiles (glow + word), reusing the domain palette (S5).
- Logic: pure `computeWarmth(tasks, now): Record<domain, WarmthState>` helper + thresholds, unit-tested with fixed clock.
- Seam/store: `completed_at` persisted.
- PWA: offline unaffected.

## Acceptance criteria (done_when)
- [ ] Completing a task sets `completed_at`; un-completing clears it.
- [ ] `computeWarmth` is pure, deterministic with an injected `now`, and unit-tested across all buckets incl. "never".
- [ ] Domains tab shows one tile per domain with glow + state word; coldest visibly frosted.
- [ ] Dexie upgrade preserves existing tasks.
- [ ] PWA e2e green.

## Relevant files
`src/types/index.ts`, `src/sync/LocalOnly.ts`, `src/db/LifeOSDb.ts`, new `src/warmth/computeWarmth.ts` (+ test), new `src/components/DomainsMap.tsx`, `src/data/domains.ts`.

## Notes for executor
Inject `now` for testability; never call `Date.now()` inside the pure helper. Thresholds live in one named constant so they're tunable.

---

# ARCHIVED FILE: afk-pipeline-out/slice1-deploy.md

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

---

# ARCHIVED FILE: afk-pipeline-out/slice-a-dispatch.md

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

---

# ARCHIVED FILE: afk-pipeline-out/slice-b-dispatch.md

# Dispatch — Issue #3 (Slice B: PWA shell — installable + offline)

Model: Sonnet. Batch-2 — BLOCKED BY #2, dispatch only after #2's PR is
merged. Pair with a CI Build Supervisor. Includes a HITL device checklist
(human-only). Agent prompt below is self-contained — paste as-is.

---

You are implementing GitHub issue #3 on Deepak-Lakshmipathi/LifeOS. Work
autonomously, open a PR, do not merge.

# Precondition (hard)
This slice is BLOCKED BY #2. Start only after #2's PR is merged. Branch
off the merged base (the branch containing the Slice A task loop), not off
an empty repo. If #2 is not merged yet, stop and report.

# Task
Turn the working Slice A task-loop app into an installable PWA that runs
fully offline on Windows and Android. Code only — do not change task-loop
logic.

# Context (decided — do not re-litigate)
Read CONTEXT.md and docs/adr/0001-pwa-over-native.md. Stack is Vite +
React + TS (already scaffolded by #2). This slice adds the PWA shell on
top.

# Build
1. Add `vite-plugin-pwa`; configure it in vite.config.ts.
2. Web app manifest: name "LifeOS", short_name "LifeOS", start_url "/",
   display "standalone", theme + background colors matching the app,
   icons 192px + 512px + a maskable icon.
3. Service worker via the plugin (Workbox): precache the app shell so a
   cold start works with no network.
4. Provide the icon assets under public/icons/.
5. Wire manifest + theme-color tags into index.html.

# Write-set (only these)
vite.config.ts (PWA plugin config block only — do NOT alter Slice A's
build/test config), public/manifest.webmanifest, public/icons/**,
index.html (manifest/theme tags), test files.

Note: vite.config.ts is shared with #2 — that is why this slice runs
AFTER #2 (serialized to avoid conflict). Touch only the PWA additions.

# Do NOT touch
src/** task-loop logic, the SyncProvider seam, the Task entity. No real
sync / backend, no push notifications, no background sync.

# Acceptance criteria
- TEST: `npm run build` emits a service worker file and a web app
  manifest into dist/ (assert both exist).
- TEST: manifest has name, start_url, display "standalone", and both
  192px and 512px icons.
- `npm run build` succeeds, zero type errors, Slice A's tests still pass.
- HITL (human, cannot run in CI — flag in PR, do not self-close on it):
    * App installs to home screen on Android (Chrome) AND to desktop on
      Windows (Edge/Chrome).
    * With network disabled, a cold start loads the app and existing
      tasks are readable.
  Document these as a manual checklist in the PR body for the user to run
  on their real phone + laptop.

# Done
Open a PR titled "Slice B — PWA shell: installable + offline" against the
base, body "Closes #3" plus the manual install/offline checklist. Do not
merge — CI green + human runs the device checklist + reviews. Report the
PR URL.

---

# ARCHIVED FILE: afk-pipeline-out/s2-done-when-deploy.md

# Deploy — Slice S2: Task gains `done_when`

PRD: [#8](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/8) · ADR-0004 (generic `update` at the seam) · CONTEXT.md (done_when, Sync seam)

Pipeline stops here. Tables ready to deploy; agents NOT dispatched.

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| [#9](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/9) — S2a done_when seam + model + hook | Grow seam to `add(input)` + generic `update(id,patch)`, add `Task.done_when?`, wire `useTasks`; verify by unit tests only | files: `src/types/task.ts`, `src/sync/SyncProvider.ts`, `src/sync/LocalOnly.ts`, `src/hooks/useTasks.ts`, `src/App.tsx` (call-site), `src/test/syncProvider.test.ts`; PRD #8 + ADR-0004; blocked by: none; do NOT touch: `TaskItem.tsx`, `AddTaskInput.tsx` beyond minimal `onAdd` sig fix, no Dexie schema bump; test: `src/test/syncProvider.test.ts` (Vitest) — add/update/unset/empty-title-throw/bad-id-throw/partial-merge; e2e `e2e/pwa.spec.ts` stays green | Sonnet | **batch-1** (status:ready) |
| [#10](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/10) — S2b done_when UI | Add always-visible `"Done when…"` create field, tap-title inline edit, secondary card render — consuming S2a seam unchanged | files: `src/components/AddTaskInput.tsx`, `src/components/TaskItem.tsx`; PRD #8; blocked by: #9; do NOT touch: `SyncProvider.ts`, `LocalOnly.ts`, `types/task.ts`, `LifeOSDb.ts` (frozen by S2a), no new seam/hook methods; render: small+dim under title, follows done-fade ~38% no strike, hidden when absent; test: e2e `e2e/pwa.spec.ts` green | Sonnet | **batch-2** (unlocks when #9 closes) |

## HITL-flagged

None. Every slice passed the Sonnet-readiness check (fully pre-resolved in the P1 grill: seam shape B, tap-title inline edit, single-line always-visible field, `update` semantics, card render rules — all literal).

## Deploy hint

Run **batch-1** (#9) as one Sonnet agent, prompt = issue #9 body + its Context cell. When #9's PR is green and merged, #10 flips `status:blocked → status:ready` (batch-2); dispatch it then. Both serial (#10 needs the seam) — no concurrency this slice.

At dispatch, launch a **CI Build Supervisor** scoped to the PRs #9/#10 open: triage flake-vs-real CI failures, rerun the known wrapper-validation network flake, alert on green. **Do not merge until CI is green** — local tests are necessary, not sufficient.

---

# ARCHIVED FILE: afk-pipeline-out/s4-project-deploy.md

# S4 — Task belongs to a Project · Deploy Tables

Parent PRD: **#24** · Slice: **#25** · Repo: `Deepak-Lakshmipathi/LifeOS` · Generated 2026-06-29.

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| #25 — Task belongs to a Project | Add `project?: string` to Task, set on create/inline-edit (native datalist), render task list grouped by project ("Inbox" first); persist; offline + e2e green. | files: `src/types/index.ts`, `src/sync/SyncProvider.ts`, `src/sync/LocalOnly.ts`, `src/hooks/useTasks.ts`, `src/components/AddTaskInput.tsx`, `src/components/TaskItem.tsx`, `src/components/TaskList.tsx`, `src/App.tsx`, `src/lib/groupByProject.ts` (new), `src/lib/distinctProjects.ts` (new), `src/test/syncProvider.test.ts`, `src/test/groupByProject.test.ts` (new), `src/test/distinctProjects.test.ts` (new); PRD #24 / ADR-0004 / ADR-0005; blocked by: none; do NOT touch: `src/db/LifeOSDb.ts` (no index, schema stays v2), `e2e/pwa.spec.ts`; tests: `syncProvider.test.ts` (project round-trip), `groupByProject.test.ts`, `distinctProjects.test.ts` (Vitest) + `npm run test:e2e` green. | Sonnet | batch-1 (status:ready) |

## HITL-flagged

None. All design judgment was resolved up-front in the grill (ADR-0005). Inbox-first ordering is a documented default decision, not an open question.

## Dispatch
Single-slice batch. Dispatch #25 as one Sonnet implementer + one CI Build Supervisor. Drive to dual-green (CI green + ponytail-review ultra), then merge to master.

---

# ARCHIVED FILE: afk-pipeline-out/s5-domain-and-seed-deploy.md

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

---

# ARCHIVED FILE: afk-pipeline-out/s6-now-view-deploy.md

# S6 — NOW view (dumb brain) · Deploy Tables

Pipeline run: `afk-pipeline auto`. Repo `Deepak-Lakshmipathi/LifeOS`. PRD #34. Single tracer-bullet slice — no parallelism.

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| #35 — NOW view (dumb brain) | Add a priority-ranked NOW surface: pure `rankNow` + `NowView` + a `Now\|All` header toggle | files (new): `src/now/rankNow.ts`, `src/now/rankNow.test.ts`, `src/components/NowView.tsx`; (edit): `src/App.tsx`. PRD #34 / ADR-0007 / brief `docs/slices/slice-S6-now-view.md`. Blocked by: none (S5 merged). do NOT touch: `src/types`, `src/sync/*`, `src/db/*`, `src/data/*`, `src/hooks/useTasks.ts`, `TaskItem.tsx`, `TaskList.tsx`, `src/lib/*`, Dexie schema (stays v2); no new dep; read-only via `list()`. Tests: `rankNow.test.ts` (Vitest — priority desc, undefined sinks, created_at tie, done excluded, empty, no-mutate) + existing `e2e/pwa.spec.ts` green (click `All` first only if the seeded-grouping e2e defaults to Now). | Sonnet | batch-1 (status:ready) |

## HITL-flagged

None. All design calls resolved up-front in P1 (ADR-0007): rankNow semantics, top-3 live + Up next(5)/Later layout, throwaway Now/All toggle. No business/product unknowns; no `auto` assumptions.

## Dispatch

batch-1 = {#35} only. One implementer agent (Sonnet) + one CI Build Supervisor. Per-PR dual-green gate: CI green (Supervisor triages the wrapper-validation flake) AND ponytail-review (ultra) green-light → orchestrator merges to master. No downstream phase (S7 blocked by S6).

---

# ARCHIVED FILE: afk-pipeline-out/s15-vault-write-deploy.md

# S15 — Obsidian vault write — deploy tables

PRD: [#56](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/56) · ADR: `docs/adr/0010-vault-write.md` · Generated by afk-pipeline (auto).

## AFK-deployable (dispatch now)

| Task | Context | Model | Parallel group |
|------|---------|-------|----------------|
| **S15a — vault write core** ([#57](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/57)) | Pure `serialize.ts` (inverse of `parseTaskLine`) + `VaultSync` real mutations: single-line splice, in-memory source-map identity, promise-chain write-queue. Extends `VaultTransport` iface with `writeFile` + throwing `GitTransport` stub. Driven by a **fake transport** → fully Vitest-covered. NO `Task`-shape change (schema v2), NO `id::` in markdown, NO migration. Do NOT touch `types`, `db/`, `SyncProvider.ts`, `App.tsx`, `parseVault.ts`. Full spec: issue #57 + ADR-0010 §2/§3/§4/§8. | Sonnet | Phase 1 (solo) |

Write-set: `src/vault/serialize.ts`, `src/vault/serialize.test.ts`, `src/sync/VaultSync.ts`, `src/sync/VaultSync.test.ts`, `src/vault/transport.ts` (iface line + stub). No hotspot collision.

## HITL-flagged (do NOT auto-dispatch)

| Task | Why HITL | Blocked by |
|------|----------|-----------|
| **S15b — git write transport** ([#58](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/58)) | Real `GitTransport.writeFile` (add/commit/best-effort push) + wipe-reclone data-loss fix + `Inbox/` scan + `parseVault` Inbox rule. **Not CI-verifiable** — needs a write-scoped PAT + hand-verify against the live vault repo. Auto pipeline has no live vault + write credentials. | #57 (S15a) |

### HITL documented assumptions (confirm with owner before/when running S15b)
- **(A) Inbox layout:** top-level `Inbox/` folder + `Inbox.md` files for domain-less/project-less tasks; PWA may create folders/files in the vault. *Assumed yes.*
- **(B) Commit identity/message:** author `LifeOS PWA <noreply>`, message `lifeos: <op> <title>`. *Assumed.*
- **(C) Timestamp persistence:** whether a later slice writes `completed_at::`/`created_at::` to make warmth/pulse truthful (markdown legibility cost). *Deferred — owner's call.*

## Dispatch plan (auto)
1. **Phase 1:** dispatch S15a (Sonnet) + one CI Build Supervisor. Drive to dual-green (CI green + ponytail-review ultra), merge to master.
2. **Stop.** S15b is HITL — hand back for the owner to run with real vault + write PAT. Do not auto-dispatch.

---

# ARCHIVED FILE: afk-pipeline-out/telegram-bot-text-create-deploy.md

# Deploy tables — S16: Telegram bot: text → create

Pipeline: `afk-pipeline auto` (headless self-grill; zero human pauses). Per explicit run instructions, this run stops at labeled, dependency-ordered issues + tables — **implementer agents were NOT dispatched**. Hand these off for manual/next-session dispatch.

- **PRD:** [#63 — PRD: S16 — Telegram bot: text → create](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/63)
- **ADR:** `docs/adr/0011-bot-transport-identity-router.md` (bot runtime, own PAT, durable `id::`, intent-router seam — all 4 previously-open grill questions resolved here)
- **CONTEXT.md:** new glossary entries — Bot, Intent, `id:: (durable identity)`
- **kanban.html:** `s16` placeholder row replaced with `s16a` / `s16b` / `s16c`; S17/S18/S19 `blockedBy` repointed from `s16` → `s16c`

## AFK-deployable table

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| [#64 — S16a: vault id:: durable identity](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/64) | Extend `parseTaskLine`/`serializeTaskLine` for an optional `id::` inline field | files: `src/vault/parseVault.ts`, `src/vault/parseVault.test.ts`, `src/vault/serialize.ts`, `src/vault/serialize.test.ts`; ADR-0011 §3; blocked by: none; do NOT touch: `src/sync/VaultSync.ts`, `src/vault/transport.ts`, `services/**`; test: extended Vitest fixture suites in `parseVault.test.ts` + `serialize.test.ts` (52 existing S14 fixtures stay green + new id-present/id-absent/round-trip fixtures) | Sonnet | batch-1 (status:ready) |
| [#65 — S16b: bot core — Telegram intent pipeline](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/65) | Build `services/bot/` core: owner guard, Claude NLU (claude-sonnet-5, structured output), self-registering intent router, create handler against an injected fake `VaultTransport` | files: new `services/bot/**` (index.ts, config.ts, telegramClient.ts, claudeClient.ts/nlu.ts, ownerGuard.ts, router.ts, vaultTransport.ts [throwing stub], intents/{types,registry,create,index}.ts, tests, `.env.example`); PRD §Implementation Decisions; ADR-0011 §2/§4; blocked by: #64; do NOT touch: `src/vault/parseVault.ts`, `src/vault/serialize.ts`, `src/vault/transport.ts`, `src/sync/VaultSync.ts`, anything under `src/` or `e2e/`; test: owner-guard/intent-mapping/router/create-handler Vitest unit tests, all against mocks/fakes (no live network) | Sonnet | batch-2 (status:blocked → ready once #64 merges) |

## HITL-flagged section

Design work is **not** the reason here — all 4 design decisions were resolved this session (ADR-0011). This is flagged HITL for the same reason S15b was: the git-network write path and the live Telegram loop cannot be exercised in CI (no remote, no live bot token/Anthropic key available to the CI runner).

| Issue | Why HITL | What the human must decide | Assumption made (auto mode) |
|-------|----------|----------------------------|-----------------------------|
| [#66 — S16c: bot real vault transport + live Telegram wiring](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/66) | Not CI-verifiable — real `isomorphic-git`+Node-`fs` clone/commit/push and the real Telegram `getUpdates` loop need a live vault repo, a live bot token, and a live Anthropic key; CI has none of those (same constraint that made S15b HITL) | Owner hand-verify after merge-candidate: real message → vault commit lands → dashboard shows it → confirmation reply; a non-owner message stays a no-op | Bot hosting target (VM/always-on container) is left to the owner (ADR-0011 HITL flag A) — not blocking S16c's code, only its *deployment*. Claude model pin `claude-sonnet-5` (ADR-0011 HITL flag B) — assumed sufficient for extraction accuracy; revisit if quality proves insufficient in practice. |

## Design decisions made this run (recorded in ADR-0011, all final — do not re-open)

1. **Bot runtime:** long-poll worker (Node/TS process polling Telegram `getUpdates`), not a serverless webhook — keeps the local git clone warm across messages; no public HTTPS endpoint needed for a single-owner bot; avoids serverless execution-time ceilings for git+Claude round trips.
2. **Bot auth:** its own write-scoped fine-grained GitHub PAT (`BOT_VAULT_PAT`, Contents Read+Write on the vault repo), separate from the PWA's `VITE_VAULT_PAT`. All secrets via env, never committed.
3. **Durable `id::` identity:** lands in S16 per ADR-0010 §2's own upgrade trigger (bot = first "second live mutator"). `parseTaskLine` reads an optional `id::`; `serializeTaskLine` always emits it. No `Task`/Dexie schema change — vault-markdown-format addition only, with lazy on-next-write backfill for legacy lines.
4. **Intent router seam:** `services/bot/intents/` — one file per intent, each self-registers into a shared `Map`; the only per-slice shared touchpoint is one append-only `import` line in `intents/index.ts`. Carved now so S17/S18/S19 don't collide on a shared registry.

## Deploy hint (for the human / follow-up session)

Dispatch #64 now (no blockers). Once merged, #65 flips `status:blocked` → `status:ready` and can dispatch. #66 is HITL — pick it up only when ready to hand-verify against the real vault/Telegram; do not auto-dispatch it as a Sonnet AFK agent. Pair any dispatch with a CI Build Supervisor per the pipeline's standard runbook, and merge only on dual-green (CI + ponytail-review ultra) for #64/#65; #66 additionally needs the owner hand-verify checklist above before merge.

---

# ARCHIVED FILE: afk-pipeline-out/s17-confirm-edits-deploy.md

# Deploy table — S17: Telegram bot confirm-destructive update/delete

PRD: [#74](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/74). ADR: [`docs/adr/0013-bot-confirm-destructive.md`](../docs/adr/0013-bot-confirm-destructive.md) (this branch, `afk/s17-confirm-edits-docs`). Pipeline run in `auto` mode per operator override: **self-grilled headlessly (architect + engineer persona agents), stops at this table — no implementer agents dispatched.**

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| [#75](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/75) — S17: Telegram bot confirm-destructive update/delete | Add update + delete intents with a fuzzy task matcher and a per-chat pending-confirmation gate that commits only on an explicit "y" | Files (new): `services/bot/taskMatch.ts`, `services/bot/confirm/store.ts`, `services/bot/confirm/gate.ts`, `services/bot/intents/update.ts`, `services/bot/intents/delete.ts` (+ each `.test.ts`); files (extend, additive): `services/bot/intents/index.ts` (2 import lines), `services/bot/intents/types.ts` (`IntentName`/`BotContext` widen), `services/bot/router.ts` (~5-line pending-check gate before NLU), `services/bot/nlu.ts` (intent enum + `target_reference`/`mark_done` fields); ADR-0013 (all decisions); PRD #74; blocked by: none (S16 fully merged); do NOT touch: `services/bot/intents/registry.ts`, `services/bot/intents/create.ts`, `src/vault/serialize.ts`, `src/vault/parseVault.ts`, `src/sync/VaultSync.ts`, `src/vault/transport.ts`, `kanban.html`, `CONTEXT.md`; tests: `taskMatch.test.ts`, `confirm/store.test.ts`, `confirm/gate.test.ts`, `update.test.ts`, `delete.test.ts`, `router.test.ts`, `nlu.test.ts` (Vitest, mocked Claude/Telegram/vaultTransport) | Sonnet | batch-1 (status:ready) — **but see hotspot flag below before dispatching alongside #72** |

Single tracer-bullet slice, not split further — see ADR-0013's "Slicing" section: the matcher, confirm-state store/gate, and the two intent handlers are mutually load-bearing (the gate can't be tested meaningfully without the matcher's `PendingAction` shape; the handlers can't be tested meaningfully without the gate consuming what they produce), so splitting into two tickets would just recreate the same `router.ts`/`intents/types.ts` write-set across both — no real parallelism gained.

Passes the Sonnet-readiness check: fully pre-resolved (ADR-0013 makes every design call — state model, matching thresholds, confirm UX, router diff shape), literal file paths/function signatures/thresholds given, testable acceptance criteria naming the exact test files, explicit "do NOT touch" fence.

## Parallel-group derivation

- **Batch 1 (status:ready now):** #75 only, from S17's own perspective — no Blocked-by edge, and it's the only slice in this PRD.
- **Cross-pipeline hotspot — `services/bot/router.ts`:** S19's #72 (`docs/adr/0012-bot-photo-vision.md`, sibling branch `afk/s19-photo-docs`) independently adds its own photo/confirm branches to the *same* `handleIncomingMessage` function in `router.ts`, and its own deploy table already flags this collision from the S19 side. Both diffs are small, additive, and non-conflicting in *intent* (they check different things before the same NLU call), but as literal same-file hunks from two branches they will conflict if dispatched in the same batch or merged out of order without a rebase. **Do not dispatch #75 and #72 in the same parallelism phase.** Resolution options for the orchestrator, in order of preference: (a) serialize — dispatch one, merge it, rebase the other's `router.ts` hunk, then dispatch; (b) extract a tiny shared prerequisite (e.g. a single `earlyIntercepts: Array<(msg, deps) => Promise<string | null>>` list `router.ts` iterates, that both S17's `resolvePending` and S19's photo/confirm branches register into) as its own prerequisite slice both depend on. Not resolved unilaterally by this pipeline.
- S18 (voice) has not yet reached this phase (no `afk/s18-*` branch or ADR observed in this working tree as of this run) — if/when it lands, check whether its transcript-reentry design also touches `router.ts`; if so it joins the same hotspot resolution above.

## HITL-flagged section

None. Every open design question in the S17 brief was resolved in ADR-0013 (auto-mode self-grill, architect + engineer persona agents) and recorded as either a firm decision or an explicitly flagged, non-blocking assumption (ADR-0013's HITL flags A–C: 2-minute confirm TTL, match thresholds 0.6/0.5, candidate cap of 5). None are business/product unknowns a model cannot invent — each is a bounded implementation default with a stated fallback ("revisit if insufficient in practice"), consistent with ADR-0011/ADR-0012's own precedent. Flag (D) — the `router.ts` cross-pipeline hotspot — is a coordination point for the orchestrator, not a design question for a human product owner, and does not block #75 from being independently correct and dispatchable once sequenced relative to #72.

## Deploy hint (operator instruction — per top-level override, this run does NOT auto-dispatch)

This pipeline invocation was told explicitly to stop here: *"Stop at labeled tracer-bullet issues + agent deployment tables — DO NOT dispatch implementer agents."* That overrides `auto` mode's normal PIPELINE.md#p5-dispatch behavior (which would otherwise proceed to dispatch + dual-green merge). Hand-off for a follow-up session or manual dispatch:

1. Resolve the `router.ts` hotspot against #72 first (see above) — decide dispatch order or extract the shared prerequisite.
2. Dispatch #75 (batch 1, `status:ready`) once sequenced.
3. Pair any dispatch with a CI Build Supervisor per `PIPELINE.md#ci-build-supervisor`; merge only on dual-green (CI + ponytail-review ultra).
4. After #75 merges, `kanban.html` and `CONTEXT.md` reconciliation is a separate, centrally-owned change — see this pipeline's final report for the exact card/glossary edits needed (not performed by this run, per explicit operator instruction to leave those files untouched).

---

# ARCHIVED FILE: afk-pipeline-out/s18-voice-prd.md

## Problem Statement

S16 let the owner capture a task by texting the bot from anywhere — but typing is still friction, and the whole point of a bot-in-the-pocket is capturing a thought the instant it occurs, often hands-busy (driving, walking, cooking). "Call the CA about GST" thought of at a red light gets lost by the time the owner can type it. The intent pipeline (Claude NLU → structured task → vault write) already exists and works from text; nothing yet gets a spoken thought into that pipeline.

## Solution

Add Telegram **voice notes** as a second way to reach the exact same intent pipeline S16 built (and S17 extends, if merged). The owner sends a voice message instead of typing; the bot downloads the audio via Telegram's file API, transcribes it to text via a hosted speech-to-text API (Groq's Whisper endpoint — ADR-0014 Decision 1), and feeds the transcript into the **unmodified** `classifyAndExtract` → `dispatchIntent` router exactly as if it had been typed. No new intent type, no fork of the create/update/delete logic — voice is purely a new front door on the message-ingest layer. Because it reuses the router's existing dispatch by name, whatever intents happen to be registered when this ships (today: `create`; `update`/`delete` too, if S17 has landed) are reachable by voice for free.

Telegram voice notes are already OGG/Opus — the same format Groq's transcription API accepts natively, so no audio transcoding step is needed (ADR-0014 Decision 2). Because a mis-heard word could silently trigger the wrong action (especially dangerous once S17's destructive update/delete land), the transcript is only handed to the NLU pipeline when the transcription API reports it's confident; a low-confidence or empty transcription instead gets a friendly "try typing that" reply with **no** Claude call and **no** vault write (ADR-0014 Decision 3). Every successful voice-triggered action echoes the transcript in the reply ("heard: '…' → ✓ added …") so the owner can catch a mis-hear before trusting the result.

## User Stories

1. As the owner, I want to send a voice note to the bot and have it become a task, so that I can capture a thought hands-free.
2. As the owner, I want the bot to show me what it heard before/alongside confirming the action, so that I can catch a mis-transcription immediately.
3. As the owner, if the bot couldn't transcribe clearly, I want it to ask me to retype rather than guess and act, so that a bad transcription never silently creates or (once S17 lands) edits/deletes the wrong thing.
4. As the owner, I want voice notes to go through the exact same rules text messages do (owner guard, domain/Inbox fallback, confirm-destructive once S17 ships), so that the bot behaves consistently regardless of how I talk to it.
5. As a maintainer, I want the transcription provider hidden behind a small interface, so that swapping providers later (cost, quality, self-hosted) touches one file, not the router or intent handlers.
6. As a maintainer, I want voice handling added without touching `services/bot/intents/**` or `nlu.ts`, so that S18 cannot conflict with S17's parallel work on those same files.
7. As the owner, I want create to still fire instantly from a confident voice transcript (no extra confirmation beyond what text already requires), so that voice capture is exactly as fast as the text path once heard correctly.

## Implementation Decisions

See [ADR-0014](../docs/adr/0014-bot-voice-transcription.md) for full rationale; summary:

- **Transcription provider: Groq's hosted Whisper API** (`whisper-large-v3-turbo`, OpenAI-compatible `/v1/audio/transcriptions` endpoint), called via native `fetch`/`FormData` — no new SDK dependency, matching `telegramClient.ts`'s existing raw-fetch style. New env var `GROQ_API_KEY` (config.ts, `.env.example`, README). Behind a new `Transcriber` interface (`services/bot/transcription.ts`) mirroring `nlu.ts`'s `ClaudeClient`/`createClaudeClient` split — tests inject a fake, never the real network call.
- **No audio transcoding.** Telegram voice notes are OGG/Opus; Groq's API accepts `ogg` natively. Raw bytes downloaded via a new `TelegramClient.downloadVoiceFile(fileId)` (Telegram's `getFile` → file URL fetch, two calls) are POSTed unmodified.
- **Confidence-gated routing.** `Transcriber.transcribe` never throws (mirrors `classifyAndExtract`'s contract) — any error maps to `{ text: '', confident: false }`. Confident = non-empty trimmed text AND mean Whisper `no_speech_prob` (verbose_json) `<= 0.5`. Not confident → fixed retype reply, no NLU call, no vault write. Confident → transcript flows into the existing `classifyAndExtract`/`dispatchIntent` pipeline unchanged; reply is prefixed `heard: '<transcript>' → <normal reply>`.
- **Message shape:** `TelegramMessage` gains an optional `voice: { fileId: string }` alongside the now-optional `text`. `router.ts`'s `handleIncomingMessage` branches on `msg.voice` right after the existing owner guard.
- **Ships AFK, not HITL.** Unlike S16c (first live vault git write, HITL by construction), S18 adds only read-only network calls (Telegram file download, Groq transcription) — any resulting vault write reuses S16/S16c's already-hand-verified `create.ts` → `VaultTransport` path unchanged. A non-blocking README note recommends the owner smoke-test transcript quality against real audio after deploy.
- **Depends on S16 only, not S17** (deliberate decoupling — the three Group-E modality slices, S17/S18/S19, are running in parallel; S18 reuses the router's existing dispatch-by-name so it works whether or not S17's `update`/`delete` handlers are registered yet).
- **Write-set:** `services/bot/telegramClient.ts`, `services/bot/transcription.ts` (new), `services/bot/router.ts`, `services/bot/reply.ts`, `services/bot/config.ts`, `services/bot/index.ts`, plus each file's test, `.env.example`, `README.md`. **Do NOT touch** `services/bot/intents/**` or `services/bot/nlu.ts` (S17's territory / unchanged S16 logic respectively).

## Out of Scope

- Photo capture (S19). Multi-language transcription tuning beyond the owner's language. Long-audio chunking (Telegram's own file-size ceiling applies; a file it can't serve surfaces as the same "couldn't transcribe" reply). Any change to intent classification logic, the intent-router registry, or the create/update/delete handlers themselves.

---

# ARCHIVED FILE: afk-pipeline-out/s18-voice-issue.md

Parent: #77 (PRD: S18 — Telegram bot: voice notes)
Blocked by: none (S16 is merged to master; S18 does not depend on S17)

## Task
Add Telegram voice-note support to the bot's message-ingest layer: download the voice file, transcribe it via Groq's Whisper API, and route a confident transcript through the **existing, unmodified** `classifyAndExtract` → `dispatchIntent` pipeline. See [ADR-0014](../docs/adr/0014-bot-voice-transcription.md) for full design rationale — every decision below is pre-resolved there; do not re-derive it.

## Files to touch (write-set)
- `services/bot/telegramClient.ts` — extend `TelegramMessage` to `{ chatId: string; text?: string; voice?: { fileId: string } }`; add `downloadVoiceFile(fileId: string): Promise<Buffer>` to the `TelegramClient` interface; implement it on `RealTelegramClient` (Telegram's two-step file API: `GET /bot<token>/getFile?file_id=<id>` → `file_path`, then `GET https://api.telegram.org/file/bot<token>/<file_path>` → body as `Buffer`); parse `update.message?.voice?.file_id` in the existing update loop alongside `update.message?.text` (a message needs at least one of the two to reach `onMessage`).
- `services/bot/transcription.ts` (**new**) — `TranscriptionResult { text: string; confident: boolean }`; `Transcriber { transcribe(audio: Buffer, mimeType: string): Promise<TranscriptionResult> }`; `createTranscriber(apiKey: string): Transcriber` returning a `GroqTranscriber` that POSTs to `https://api.groq.com/openai/v1/audio/transcriptions` (`model: 'whisper-large-v3-turbo'`, `response_format: 'verbose_json'`, multipart `FormData` with the audio as `voice.ogg` / `audio/ogg`) via native `fetch`. `confident = text.trim().length > 0 && meanNoSpeechProb <= 0.5` where `meanNoSpeechProb` is the mean of `segments[].no_speech_prob` (empty/missing `segments` ⇒ not confident). **Never throws** — any fetch error, non-2xx response, or JSON-parse failure is caught and returns `{ text: '', confident: false }`.
- `services/bot/transcription.test.ts` (**new**) — unit tests against a fake `fetch` (module-level `vi.stubGlobal('fetch', ...)` or an injected fetch param — match whichever DI style `nlu.ts`/`nlu.test.ts` uses for its client seam). Cases: confident transcript (low mean `no_speech_prob`, non-empty text) → `confident: true`; high mean `no_speech_prob` → `confident: false`; empty/whitespace-only `text` → `confident: false`; empty/missing `segments` → `confident: false`; fetch throws/network error → `{ text: '', confident: false }`, no throw; non-2xx response → `{ text: '', confident: false }`, no throw.
- `services/bot/router.ts` — add `transcriber: Transcriber` to `RouterDeps`. In `handleIncomingMessage`, after the existing owner guard (unchanged): if `msg.voice` is set, call `deps.telegramClient.downloadVoiceFile(msg.voice.fileId)` then `deps.transcriber.transcribe(buffer, 'audio/ogg')`. If `confident === false`, `sendMessage(chatId, RETYPE_PROMPT)` and return — do **not** call `classifyAndExtract` or touch `vaultTransport`. If `confident === true`, call the *existing* `classifyAndExtract(deps.claudeClient, transcript)` → `dispatchIntent(...)` exactly as the text path does, then `sendMessage(chatId, buildHeardPrefix(transcript) + innerReply)`. The `msg.text` branch (no `msg.voice`) is byte-for-byte unchanged from today. Export `RETYPE_PROMPT = "Couldn't quite catch that — mind typing it instead?"` as a named constant (mirrors `NOT_YET_SUPPORTED`'s existing export pattern).
- `services/bot/router.test.ts` — extend with: a fake `TelegramClient` exposing `downloadVoiceFile` (`vi.fn()`), a fake `Transcriber`. Cases: owner-guard still blocks a voice message from a non-owner chat id (no download, no transcribe, no send) exactly like it blocks text; confident voice transcript → `classifyAndExtract` called with the transcript text, vault written, reply is `heard: '<transcript>' → ✓ added ...`; non-confident voice transcript → `classifyAndExtract` NOT called, `vaultTransport.writeFileCalls` empty, reply is exactly `RETYPE_PROMPT`; existing text-path tests remain green unmodified (regression guard).
- `services/bot/reply.ts` — add `buildHeardPrefix(transcript: string): string` returning `heard: '${transcript}' → ` (used by `router.ts` to prepend to the inner reply; `buildCreateReply` and its format are unchanged).
- `services/bot/reply.test.ts` — extend: `buildHeardPrefix('call the CA')` → `"heard: 'call the CA' → "`.
- `services/bot/config.ts` — add `groqApiKey: string` to `BotConfig`; add `'GROQ_API_KEY'` to `REQUIRED_VARS`.
- `services/bot/config.test.ts` — extend the existing missing-vars test to include `GROQ_API_KEY` in the "missing" and "present" cases (mirror the existing pattern for the other required vars).
- `services/bot/index.ts` — `import { createTranscriber } from './transcription'`; build `const transcriber = createTranscriber(config.groqApiKey)`; pass `transcriber` into the `handleIncomingMessage` deps object alongside `claudeClient`/`telegramClient`/`vaultTransport`/`ownerChatId`.
- `services/bot/.env.example` — add a `GROQ_API_KEY` line with a one-line comment (mirror the existing `ANTHROPIC_API_KEY` comment style).
- `services/bot/README.md` — add `GROQ_API_KEY` to the required-env-vars table; add a short "Voice notes" subsection under "What it does" describing the download → transcribe → confidence-gate → existing-pipeline flow (2-3 sentences, link ADR-0014); add the non-blocking manual-smoke-test note from ADR-0014's HITL-vs-AFK section (send a couple of real voice notes post-deploy and confirm transcript/confidence behave as expected).

## Do NOT touch
`services/bot/intents/**` (registry.ts, types.ts, create.ts, index.ts — S17's territory per ADR-0011 Decision 4; S18 needs zero changes here since it dispatches by the same existing intent name), `services/bot/nlu.ts` (classification/extraction logic unchanged — voice only supplies the input string), `src/vault/**`, `src/sync/**`, `src/types/**`, `src/data/domains.ts`, `kanban.html`, `CONTEXT.md`.

## Acceptance criteria (done_when)
- [ ] `npm test` (in `services/bot/`) passes, including all new/extended test files listed above, with zero changes to existing S16b/S16c test assertions' expected values (only additive test cases).
- [ ] A fake voice message (`msg.voice.fileId` set) with a confident fake transcript: `downloadVoiceFile` and `transcribe` are called once each, `classifyAndExtract` is called with the transcript, the vault-transport fake records exactly one `writeFile` call, and the reply sent equals `heard: '<transcript>' → <the same reply text S16's create handler already produces for that extraction>`.
- [ ] A fake voice message with a non-confident fake transcript: `classifyAndExtract` is never called, no `writeFile` call, reply sent equals `RETYPE_PROMPT` exactly.
- [ ] A fake voice message from a non-owner chat id: complete no-op — `downloadVoiceFile`, `transcribe`, `classifyAndExtract`, and `sendMessage` are all never called (mirrors the existing text-path owner-guard test).
- [ ] Every existing S16b test in `router.test.ts`, `nlu.test.ts`, `reply.test.ts`, `config.test.ts` still passes unmodified (no regression on the text path).
- [ ] `services/bot/intents/**` and `services/bot/nlu.ts` have zero diff lines in this PR.

## Test names to add
`transcription.test.ts`: `describe('createTranscriber / GroqTranscriber')` with the six cases listed above. `router.test.ts`: extend `describe('handleIncomingMessage — owner guard')` with a voice no-op case, and add `describe('handleIncomingMessage — voice')` with the confident/non-confident cases. `reply.test.ts`: extend with a `buildHeardPrefix` case. `config.test.ts`: extend the required-vars table-driven case(s) with `GROQ_API_KEY`.

---

# ARCHIVED FILE: afk-pipeline-out/s18-voice-deploy.md

# S18 — Telegram bot: voice notes — deploy tables

PRD: [#77](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/77) · ADR: [0014](../docs/adr/0014-bot-voice-transcription.md) · Slice brief: `docs/slices/slice-S18-bot-voice.md`

Mode: `afk-pipeline auto`, scoped to S18. **Stopped at this table per operator instruction — no implementer agents dispatched.**

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| [#78](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/78) — S18: voice notes (transcription ingest + confidence gate) | Add a voice branch to the Telegram message-ingest layer: download → transcribe (Groq Whisper) → confidence gate → route confident transcripts through the existing, unmodified `classifyAndExtract`/`dispatchIntent` pipeline; echo the transcript in the reply. | Files: `services/bot/telegramClient.ts`, `services/bot/transcription.ts` (new), `services/bot/router.ts`, `services/bot/reply.ts`, `services/bot/config.ts`, `services/bot/index.ts`, `.env.example`, `README.md`, + each file's test (`transcription.test.ts` new, `router.test.ts`/`reply.test.ts`/`config.test.ts` extended). Full field-level spec + acceptance criteria + test names in issue #78 body. Design fully resolved in ADR-0014 (Groq Whisper `whisper-large-v3-turbo`, `GROQ_API_KEY` env, no transcoding — Telegram's OGG/Opus passes straight to Groq, confidence = non-empty transcript + mean `no_speech_prob` <= 0.5). Blocked by: none (S16 merged; S18 explicitly does not depend on S17). Do NOT touch: `services/bot/intents/**`, `services/bot/nlu.ts`, `src/vault/**`, `src/sync/**`, `src/types/**`, `kanban.html`, `CONTEXT.md`. Test: `npm test` in `services/bot/` — new `transcription.test.ts` + extended `router.test.ts`/`reply.test.ts`/`config.test.ts`, zero existing-assertion changes. | Sonnet | batch-1 (status:ready) |

Single-issue slice — no internal parallel batching needed. Nothing currently blocks it (S16 is merged to master).

## HITL-flagged section

None. See ADR-0014 "HITL vs AFK" section for the explicit reasoning: S18 adds only read-only network calls (Telegram voice download, Groq transcription); any resulting vault write reuses S16/S16c's already hand-verified `create.ts` → `VaultTransport` path unchanged, so it does not meet the bar S16c's live-git-write slice did. One **non-blocking documented assumption** carried instead (not a merge gate): real transcription *quality* against live audio (accents, background noise, Opus compression artifacts) can't be verified by a fixture-audio unit test — the README gets a short manual-smoke-test note asking the owner to send a couple of real voice notes post-deploy and eyeball the transcript/confidence behavior. Does not block merge or dispatch.

## Cross-slice hotspot note (for central reconciliation, not resolved here)

S18's write-set is disjoint from S16's shipped files, but **may** overlap S17's in-flight write-set on two files if S17 is dispatched/merged concurrently: `services/bot/router.ts` (S17 adds confirm-state + update/delete dispatch branches; S18 adds a voice branch — same file, different regions) and possibly `services/bot/config.ts` (S17 likely adds no new env var, but worth checking at merge time). Per the pipeline's hotspot rule this is a **serialize, don't same-batch** case: whichever of S17/S18 merges second should rebase against the first rather than the two landing as a single concurrent PR pair against the same file. Flagging for the orchestrator's central reconciliation — not resolved unilaterally here since S17's actual diff isn't visible from this branch.

## Deploy hint

Dispatch issue #78 as a single Sonnet-seeded implementer agent using the issue body as its full context (nothing else needed — every design call is pre-resolved in ADR-0014). Pair with a CI Build Supervisor per the pipeline's standard dispatch runbook if/when this is deployed. Merge gate: dual-green (CI + ponytail-review ultra) per the pipeline's standard rule — this run stopped before dispatch, so no PR exists yet to gate.

---

# ARCHIVED FILE: afk-pipeline-out/s19-bot-photo-deploy.md

# Deploy table — S19: Telegram bot photos (vision)

PRD: [#70](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/70). ADR: [`docs/adr/0012-bot-photo-vision.md`](../docs/adr/0012-bot-photo-vision.md) (this branch, `afk/s19-photo-docs`). Pipeline run in `auto` mode per operator override: **self-grilled headlessly, stops at this table — no implementer agents dispatched.**

## AFK-deployable

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| [#71](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/71) — S19a: Bot photo ingest | Extend `telegramClient.ts` with photo detection + `downloadPhoto`; add new `visionExtract.ts` (Claude vision, `claude-sonnet-5`, structured multi-task output, capped at 20, domain/priority normalization reused from `nlu.ts`) | Files: `services/bot/telegramClient.ts`, `services/bot/visionExtract.ts` (new), `services/bot/telegramClient.test.ts`, `services/bot/visionExtract.test.ts` (new); ADR-0012 §1/§2/§5; PRD #70; blocked by: none; do NOT touch: `services/bot/router.ts`, `services/bot/intents/*`, `services/bot/index.ts`, `src/vault/*`, `src/sync/*`; tests: `telegramClient.test.ts`, `visionExtract.test.ts` (Vitest, mocked fetch + mocked ClaudeClient) | Sonnet | batch-1 (status:ready) |
| [#72](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/72) — S19b: Bot photo batch-confirm + router wiring | Add `photoConfirm.ts` (10-min-expiring per-chat pending state) + a photo branch and confirm-check branch in `router.ts`'s `handleIncomingMessage`, reusing `intents/create.ts`'s `handleCreate` per confirmed task | Files: `services/bot/photoConfirm.ts` (new), `services/bot/router.ts`, `services/bot/photoConfirm.test.ts` (new), `services/bot/router.test.ts`; ADR-0012 §3/§4; PRD #70; blocked by: #71 (needs `downloadPhoto` + `extractTasksFromImage`); do NOT touch: `services/bot/intents/registry.ts`, `services/bot/intents/types.ts`, `services/bot/intents/create.ts`, `services/bot/intents/index.ts`, `services/bot/nlu.ts`, `services/bot/vaultTransport.ts`, `src/vault/*`, `kanban.html`, `CONTEXT.md`; tests: `photoConfirm.test.ts`, `router.test.ts` (Vitest, mocked telegramClient/ClaudeClient/vaultTransport) | Sonnet | dependency phase (after #71 merges) |

Both slices pass the Sonnet-readiness check: fully pre-resolved (ADR-0012 makes every design call), literal file paths and function signatures given, testable acceptance criteria naming the exact test files, explicit "do NOT touch" fences (write-sets are disjoint — `#71` never touches `router.ts`; `#72` never touches `telegramClient.ts`/`visionExtract.ts`, only imports from them).

## Parallel-group derivation

- **Batch 1 (status:ready now):** #71 only. No Blocked-by edge, and its write-set (`telegramClient.ts`, new `visionExtract.ts`) is disjoint from every other in-flight slice in this repo's currently-known open work.
- **Dependency phase:** #72, serially after #71 merges (real dependency — #72 imports `downloadPhoto` and `extractTasksFromImage` by name, not a hotspot-avoidance serialization).

No batching conflict with the sibling S17/S18 pipelines: #71's write-set is `telegramClient.ts` (extend, additive fields + one new method) + a new file; #72's write-set is `router.ts` (extend, two new branches) + a new file. S17's brief also touches "intent handler, conversation state" inside `services/bot/` and S18's brief touches "voice handler, transcription adapter" inside `services/bot/` — if S17 or S18 land a PR touching `router.ts` or `telegramClient.ts` before #71/#72 merge, that PR and #72 (or #71, for `telegramClient.ts`) become a same-file hotspot and must NOT be dispatched in the same batch; whichever merges first, the other rebases. This is flagged for the orchestrator's cross-pipeline coordination, not resolved unilaterally here (S19's own two slices are internally hotspot-free).

## HITL-flagged section

None. Every open design question in the S19 brief was resolved in ADR-0012 (auto-mode self-grill) and recorded as either a firm decision or an explicitly flagged, non-blocking assumption (ADR-0012's HITL-flags A–D: 20-task cap, 10-minute confirm TTL, `claude-sonnet-5` vision pin, single-pending-batch-per-chat). None of these are business/product unknowns a model cannot invent — each is a bounded implementation default with a stated fallback ("revisit if insufficient in practice"), consistent with ADR-0011's own precedent (its HITL flags (B) and (C) took the same shape). No slice in this PRD carries irreducible design judgment; both #71 and #72 are AFK-deployable.

## Deploy hint (operator instruction — per top-level override, this run does NOT auto-dispatch)

This pipeline invocation was told explicitly to stop here: *"Stop at labeled tracer-bullet issues + agent deployment tables — DO NOT dispatch implementer agents."* That overrides `auto` mode's normal PIPELINE.md#p5-dispatch behavior (which would otherwise proceed to dispatch + dual-green merge). Hand-off for a follow-up session or manual dispatch:

1. Dispatch #71 now (batch 1, `status:ready`).
2. On #71 merged-green, flip #72 to `status:ready` and dispatch it.
3. Pair any dispatch with a CI Build Supervisor per `PIPELINE.md#ci-build-supervisor`; merge only on dual-green (CI + ponytail-review ultra).
4. After #72 merges, the kanban (`kanban.html`) and `CONTEXT.md` reconciliation is a separate, centrally-owned change — see the pipeline's final report for the exact card/field edits needed (not performed by this run, per explicit operator instruction to leave those files untouched).

---

# ARCHIVED FILE: afk-pipeline-out/_prd.md

# LifeOS — Slice 1: Bare-bones local-first task tracker

**Type:** Feature / tracer-bullet Slice 1
**Status:** ready-for-agent

## Why

LifeOS is a personal, Apple-feel life tracker for one user, restarting after a full teardown. Before building structure (projects, domains, priority, sync), Slice 1 proves the riskiest assumptions at the lowest cost: that a single web codebase can be an installable, offline, local-persistent, polished app on both Windows and Android. If the core loop — add → complete → persist → install → offline — doesn't feel instant and trustworthy, nothing built on top will.

See `lifeos_plan.html` (full plan) and `lifeos_slice1.html` (this slice), plus ADR-0001 (PWA choice) and ADR-0002 (local-first, sync deferred).

## Scope (Slice 1)

A single flat list of tasks. No projects, folders, domains, priority, tags, done_when, Today view, real sync, seed import, habits, or settings.

**The one entity:**

```
Task { id: uuid, title: string, done: boolean, created_at: number }
```

No `updated_at` / `deleted_at` — sync fields are added in the Slice that turns on sync, with a migration (ADR-0002).

## Architecture

- **Shell:** Installable PWA — Vite + React + TypeScript (ADR-0001).
- **UI:** Tailwind + Framer Motion. Apple-feel: SF system fonts, generous whitespace, spring on complete, haptic on mobile, calm empty state.
- **Data:** Dexie over IndexedDB. All reads/writes go through a `SyncProvider` seam whose only implementation is a no-op `LocalOnly` (ADR-0002).
- **Offline/install:** vite-plugin-pwa (service worker + manifest).

## Capabilities

1. Add a task (single text field).
2. See all tasks in one flat list.
3. Tap to complete / un-complete.
4. Delete a task.
5. Tasks persist locally (survive reload / restart).
6. Installs as a PWA and runs fully offline on Windows + Android.
7. Apple-feel polish is the definition of done for every capability above.

## Out of scope (explicit)

projects · folders · domains · priority · tags · done_when · Today view · filtering/sort · real sync · backend · accounts · seed import · habits/cadence/streaks · onboarding · settings.

## Definition of done (validity — true on a real device, wifi off)

- Add a task, kill the app, reopen → still there.
- Installed to home screen on Android **and** Windows.
- Works fully with no internet connection.
- Completing a task feels good — spring + haptic, no lag.
- Adding a task beats opening a notes app.
- Sync seam exists; a later Slice swaps `LocalOnly` without touching call sites.

## Slices

- **#A — Local-first task loop** (status:ready)
- **#B — PWA shell: installable + offline** (status:blocked, blocked by #A)

---

# ARCHIVED FILE: afk-pipeline-out/_prd_post.md

# LifeOS — Slice 1: Bare-bones local-first task tracker

**Type:** Feature / tracer-bullet Slice 1
**Status:** ready-for-agent

## Why

LifeOS is a personal, Apple-feel life tracker for one user, restarting after a full teardown. Before building structure (projects, domains, priority, sync), Slice 1 proves the riskiest assumptions at the lowest cost: that a single web codebase can be an installable, offline, local-persistent, polished app on both Windows and Android. If the core loop — add → complete → persist → install → offline — doesn't feel instant and trustworthy, nothing built on top will.

See `lifeos_plan.html` (full plan) and `lifeos_slice1.html` (this slice), plus ADR-0001 (PWA choice) and ADR-0002 (local-first, sync deferred).

## Scope (Slice 1)

A single flat list of tasks. No projects, folders, domains, priority, tags, done_when, Today view, real sync, seed import, habits, or settings.

**The one entity:**

```
Task { id: uuid, title: string, done: boolean, created_at: number }
```

No `updated_at` / `deleted_at` — sync fields are added in the Slice that turns on sync, with a migration (ADR-0002).

## Architecture

- **Shell:** Installable PWA — Vite + React + TypeScript (ADR-0001).
- **UI:** Tailwind + Framer Motion. Apple-feel: SF system fonts, generous whitespace, spring on complete, haptic on mobile, calm empty state.
- **Data:** Dexie over IndexedDB. All reads/writes go through a `SyncProvider` seam whose only implementation is a no-op `LocalOnly` (ADR-0002).
- **Offline/install:** vite-plugin-pwa (service worker + manifest).

## Capabilities

1. Add a task (single text field).
2. See all tasks in one flat list.
3. Tap to complete / un-complete.
4. Delete a task.
5. Tasks persist locally (survive reload / restart).
6. Installs as a PWA and runs fully offline on Windows + Android.
7. Apple-feel polish is the definition of done for every capability above.

## Out of scope (explicit)

projects · folders · domains · priority · tags · done_when · Today view · filtering/sort · real sync · backend · accounts · seed import · habits/cadence/streaks · onboarding · settings.

## Definition of done (validity — true on a real device, wifi off)

- Add a task, kill the app, reopen → still there.
- Installed to home screen on Android **and** Windows.
- Works fully with no internet connection.
- Completing a task feels good — spring + haptic, no lag.
- Adding a task beats opening a notes app.
- Sync seam exists; a later Slice swaps `LocalOnly` without touching call sites.

## Slices

- **#2 — Local-first task loop** (status:ready)
- **#3 — PWA shell: installable + offline** (status:blocked, blocked by #A)

---

# ARCHIVED FILE: afk-pipeline-out/_issueA.md

## Slice A — Local-first task loop

Part of the LifeOS Slice 1 PRD (see parent issue). Build the working task loop as a Vite + React + TypeScript app, persisting locally through a no-op sync seam, polished to Apple-feel. Runs in a browser tab; installability/offline is Slice B.

### Stack
- Vite + React + TypeScript.
- Tailwind for styling; Framer Motion for motion.
- Dexie over IndexedDB.

### Build
1. Scaffold the Vite + React + TS project; Tailwind configured.
2. Define `Task { id: uuid, title: string, done: boolean, created_at: number }`.
3. Dexie DB with a `tasks` table, accessed **only** through a `SyncProvider` interface; provide a no-op `LocalOnly` implementation. The UI never calls Dexie directly.
4. Reactive list: render all tasks, newest-first.
5. Add (single text field, Enter to commit), toggle done, delete.
6. Apple-feel polish: SF system font stack, generous whitespace, spring animation on complete (transform/opacity only), haptic via `navigator.vibrate` on mobile complete, calm empty state ("All clear").

### Write-set
`package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.*`, `index.html`, `src/**` (entry, App, components, db, sync seam, types).

### Acceptance criteria (testable)
- A Vitest test creates two tasks via the `SyncProvider`, reads them back, toggles one done, deletes one — final state matches expectation.
- `SyncProvider` is an interface with a `LocalOnly` no-op impl; grep confirms no component imports Dexie directly.
- Adding a task with empty title is rejected (no blank task created).
- After reload (re-instantiating the DB), previously added tasks are still present.
- Completing a task triggers the spring animation; on a `navigator.vibrate`-capable env the vibrate call fires (assert it is invoked).
- `npm run build` succeeds with no type errors.

### Out of scope
Installability, service worker, offline caching (Slice B). Projects, priority, tags, sync fields, seed.

**Blocked by:** none

---

# ARCHIVED FILE: afk-pipeline-out/_issueA_post.md

> Parent PRD: #1

## Slice A — Local-first task loop

Part of the LifeOS Slice 1 PRD (see parent issue). Build the working task loop as a Vite + React + TypeScript app, persisting locally through a no-op sync seam, polished to Apple-feel. Runs in a browser tab; installability/offline is Slice B.

### Stack
- Vite + React + TypeScript.
- Tailwind for styling; Framer Motion for motion.
- Dexie over IndexedDB.

### Build
1. Scaffold the Vite + React + TS project; Tailwind configured.
2. Define `Task { id: uuid, title: string, done: boolean, created_at: number }`.
3. Dexie DB with a `tasks` table, accessed **only** through a `SyncProvider` interface; provide a no-op `LocalOnly` implementation. The UI never calls Dexie directly.
4. Reactive list: render all tasks, newest-first.
5. Add (single text field, Enter to commit), toggle done, delete.
6. Apple-feel polish: SF system font stack, generous whitespace, spring animation on complete (transform/opacity only), haptic via `navigator.vibrate` on mobile complete, calm empty state ("All clear").

### Write-set
`package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.*`, `index.html`, `src/**` (entry, App, components, db, sync seam, types).

### Acceptance criteria (testable)
- A Vitest test creates two tasks via the `SyncProvider`, reads them back, toggles one done, deletes one — final state matches expectation.
- `SyncProvider` is an interface with a `LocalOnly` no-op impl; grep confirms no component imports Dexie directly.
- Adding a task with empty title is rejected (no blank task created).
- After reload (re-instantiating the DB), previously added tasks are still present.
- Completing a task triggers the spring animation; on a `navigator.vibrate`-capable env the vibrate call fires (assert it is invoked).
- `npm run build` succeeds with no type errors.

### Out of scope
Installability, service worker, offline caching (Slice B). Projects, priority, tags, sync fields, seed.

**Blocked by:** none

---

# ARCHIVED FILE: afk-pipeline-out/_issueB.md

## Slice B — PWA shell: installable + offline

Part of the LifeOS Slice 1 PRD (see parent issue). Turn the working task-loop app (Slice A) into an installable PWA that runs fully offline on Windows and Android.

### Build
1. Add `vite-plugin-pwa` and configure the manifest (name, short_name, icons 192/512, theme/background color, display: standalone).
2. Service worker with precache of the app shell (Workbox via the plugin); app boots offline.
3. Provide app icons and a maskable icon.
4. Verify install + offline behavior on Windows (Edge/Chrome) and Android (Chrome).

### Write-set
`vite.config.ts` (PWA plugin config), `public/manifest.webmanifest`, `public/icons/**`, `index.html` (manifest/theme tags). Shares `vite.config.ts` with Slice A → must run after A (serialized).

### Acceptance criteria (testable)
- `npm run build` emits a service worker and a valid web app manifest (assert files exist in `dist/`).
- A test/assertion confirms the manifest has name, start_url, display: standalone, and 192px + 512px icons.
- Manual verification recorded: app installs to home screen on Android and to the desktop on Windows.
- Manual verification recorded: with network disabled, a cold start loads the app and existing tasks are readable.
- Lighthouse PWA "installable" criteria pass (or documented equivalent check).

### Out of scope
Real sync / backend. Push notifications. Background sync.

**Blocked by:** #A

---

# ARCHIVED FILE: afk-pipeline-out/_issueB_post.md

> Parent PRD: #1

## Slice B — PWA shell: installable + offline

Part of the LifeOS Slice 1 PRD (see parent issue). Turn the working task-loop app (Slice A) into an installable PWA that runs fully offline on Windows and Android.

### Build
1. Add `vite-plugin-pwa` and configure the manifest (name, short_name, icons 192/512, theme/background color, display: standalone).
2. Service worker with precache of the app shell (Workbox via the plugin); app boots offline.
3. Provide app icons and a maskable icon.
4. Verify install + offline behavior on Windows (Edge/Chrome) and Android (Chrome).

### Write-set
`vite.config.ts` (PWA plugin config), `public/manifest.webmanifest`, `public/icons/**`, `index.html` (manifest/theme tags). Shares `vite.config.ts` with Slice A → must run after A (serialized).

### Acceptance criteria (testable)
- `npm run build` emits a service worker and a valid web app manifest (assert files exist in `dist/`).
- A test/assertion confirms the manifest has name, start_url, display: standalone, and 192px + 512px icons.
- Manual verification recorded: app installs to home screen on Android and to the desktop on Windows.
- Manual verification recorded: with network disabled, a cold start loads the app and existing tasks are readable.
- Lighthouse PWA "installable" criteria pass (or documented equivalent check).

### Out of scope
Real sync / backend. Push notifications. Background sync.

**Blocked by:** #2

