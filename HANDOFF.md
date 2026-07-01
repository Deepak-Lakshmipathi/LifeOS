# LifeOS — Handoff

Last updated: 2026-06-30. Picks up after Wave 5 shipped **S12 + S13** (both dual-green merged to `master`). **MVP COMPLETE — Groups A + B + C all done.** The app is a tab-navigated, glass-skinned command center: bottom tab bar (Now / Domains / Pulse / + ), tap-the-dot completion with undo, derived domain warmth, a balance-brain NOW queue, smart shorthand capture, and a light Pulse trends surface — all behind a frosted glass / time-of-day-gradient look. **Next is Group D — S14 vault read, a HUMAN GATE (transport decision + ADR before any dispatch).**

> Run note: slices ran as parallel/solo Sonnet implementer agents in isolated git worktrees, each branched off fresh `origin/master`, driven to a **dual-green** merge gate (CI green **AND** ponytail-review). Wave 5 ran S12 → S13 **serially** (S13 depends on S12, and both wire a view into `App.tsx` — shared hotspot, so serialized rather than parallelized). Earlier waves: Wave 2 ran S8 ∥ S9 concurrently on disjoint write-sets; S10/S11 solo.

## What LifeOS is
A personal, Apple-feel life tracker for a single user (the repo owner), built local-first as an installable PWA that runs offline on Windows and Android. Restarting after a full teardown; seed data in `seed_tasks_detailed.json` captures the long-term intent (folders → projects → tasks across 7 life domains). Read `CONTEXT.md` for the glossary, `docs/slices/README.md` for the slice backbone + product vision, and `memory/lifeos-vision-2026-06-22.md` for the full design rationale (Obsidian-vault backend; three faces: PWA dashboard, Telegram bot, Obsidian).

## Current state (on `master`)
**Slices S1–S13 are complete and merged — MVP done (Groups A + B + C).** A working, installable, offline task app with a real navigation shell, the glass look, smart capture, and a Pulse surface:

- **Tasks:** add / complete / delete + inline edit. Each Task carries optional `done_when` (S2), `priority` 1–3 (S3), `project` name (S4), `domain` one-of-7 (S5), and `completed_at` (S9, set when `done` flips true, cleared on un-done).
- **Tab bar (S7):** bottom nav with 4 tabs — **Now** / **Domains** / **Pulse** / **+** — fixed, safe-area aware. Replaced (and deleted) the throwaway S6 `Now | All` toggle. The `+` opens a spring bottom-sheet add flow.
  - **Now** → the **NOW** balance-brain queue (S6 + S10).
  - **Domains** → the **warmth map** (S9): one tile per domain, glow + one-word state. (This replaced the old grouped Domain→Project→Task list, which was deleted — `TaskList.tsx` is gone.)
  - **Pulse** → the light **trends surface** (S13): done-this-week count, 7-day completions sparkline, per-domain warmth standings.
  - **+** → the **smart capture sheet** (S12): one field that parses shorthand into a structured task.
- **Tap-the-dot complete + undo (S8):** tap the ● → fills to ✓ with a ring pulse, card fades + folds away, a 3 s Undo toast appears (Undo re-issues `toggleDone`). Haptic on mobile; respects `prefers-reduced-motion`.
- **Domain warmth (S9), derived never logged:** `computeWarmth(tasks, now)` (pure, injected clock) buckets each domain hot/warm/ok/stale/cold from the most recent `completed_at`. `completed_at` is **denormalized, non-indexed** — no Dexie index, schema stays **v2**, no migration (ADR-0005 extension).
- **Balance brain (S10):** `rankNow(tasks, warmth, opts?)` — priority desc / age asc, **caps ~2 tasks/domain** (inbox uncapped), **injects 1 rescue task** from the coldest (cold/stale) domain, flagged for a distinct ❄ rescue card. Pure; returns `RankedTask[]` (`{ task, rescue }`). ADR-0008.
- **Glass / depth look (S11):** `GlassPanel` primitive + centralized glass tokens (Tailwind + CSS vars), a **time-of-day gradient** background (pure `getTimeOfDay` helper), domain-color edge glow on NOW cards, frosted tab bar + header. Honors `prefers-reduced-transparency` **and** `prefers-reduced-motion` (solid/still fallbacks). PWA installability audit stays green.
- **Smart capture (S12):** pure `parseCapture(text) -> TaskInput` mini-syntax — `#domain` (fuzzy-match to 7, unmatched → Inbox), `!1/!2/!3` priority, `when …`/`~ …` → `done_when` (capture-to-end), `/project`, rest → title; tokens in any order. `CaptureSheet` shows a live parsed preview before commit; commits via the seam `add(input)`. Deterministic local regex — NOT the bot's Claude NLU (don't couple them).
- **Pulse (S13), read-only / derived:** pure `doneThisWeek(tasks, now)` + `completionsByDay(tasks, now, 7)` (oldest→newest buckets, injected clock); `PulseView` renders count + plain-div sparkline (no chart lib) + warmth standings (reuses `computeWarmth`, sorted hot→cold). No data/model change.
- **First run on an empty DB seeds** from `seed_tasks_detailed.json` (107 tasks) via `seedIfEmpty` — idempotent empty-check, `?noseed` test hook (ADR-0006).
- Persists locally; survives reload; fully offline; installs as a PWA.

Repo: `Deepak-Lakshmipathi/LifeOS` (public), default branch `master`. Ship via branch + PR — direct push to `master` is gated.

**Open issues/PRs:** none. Wave 5: S12 (PR #49), S13 (PR #50) — both squash-merged. (S12 needed a one-line follow-up: e2e locator `getByLabel('New task title')` was stale after the field's aria-label became `Capture task` — fixed and re-greened. Lesson: a UI relabel must update `e2e/` selectors.)
**Stale local branches/worktrees:** merged slice branches auto-deleted; S12/S13 worktrees pruned. Any remaining `.claude/worktrees/` agent dirs are safe to prune.

## Architecture (decided — do not re-litigate)
- **Stack:** Vite + React + TypeScript, Tailwind, Framer Motion, Dexie/IndexedDB. ADR-0001 (PWA over native).
- **Data access goes through a seam:** `src/sync/SyncProvider.ts` interface; `src/sync/LocalOnly.ts` is the only impl. UI/components/hooks never import Dexie — only `SyncProvider` + `src/types`. ADR-0002.
- **Mutation is generic** (ADR-0004): `add(input)` + one `update(id, patch)`. New fields widen the patch type; they do not add mutation methods. (`toggleDone` now also sets/clears `completed_at`.)
- **Not every field is indexed** (ADR-0005): `project`, `domain`, and `completed_at` are denormalized strings/numbers consumed only by in-memory grouping/derivation — **no** Dexie index, schema stays **v2**. Index/bump only when a field gets a real seam query (as `priority` did → v2).
- **Ranking + warmth are pure seams, never in the view:** `rankNow` (ADR-0007 → ADR-0008) and `computeWarmth` take injected inputs (`warmth`, `now`); the view computes `computeWarmth(tasks, Date.now())` and passes it down.
- **Sync deferred:** Task has NO `updated_at`/`deleted_at` yet — added (with migration) in the slice that turns on real sync. The Obsidian vault becomes the real truth as a `VaultSync` provider body swapped at the seam (Group D, S14). ADR-0002.
- **Testing:** CI gates `build-test` (Vitest) + `pwa-e2e` (Playwright SW/offline/persistence + installability audit). ADR-0003 + `docs/testing/pwa-emulation-protocol.md`.

## Key files
```
src/types/index.ts          Task { id, title, done, created_at, done_when?, priority?, project?, domain?, completed_at? }
src/data/domains.ts         DOMAINS (7) + Domain union + isDomain + DOMAIN_COLORS palette
src/data/seed.ts            seedIfEmpty(provider) — idempotent empty-DB import; ?noseed skip
src/now/rankNow.ts          pure rankNow(tasks, warmth, opts?) -> RankedTask[]: priority order + ~2/domain cap + 1 cold-domain rescue (S10, ADR-0008)
src/warmth/computeWarmth.ts pure computeWarmth(tasks, now) -> Record<Domain, WarmthState> (hot/warm/ok/stale/cold) (S9)
src/capture/parseCapture.ts pure parseCapture(text) -> TaskInput: #domain/!priority/when~/​/project shorthand, any order (S12)
src/pulse/metrics.ts        pure doneThisWeek(tasks, now) + completionsByDay(tasks, now, days) (oldest→newest) (S13)
src/lib/timeOfDay.ts        pure getTimeOfDay(now) + TIME_GRADIENTS / TIME_SOLID_BG buckets (S11)
src/components/NowView.tsx  NOW surface: computes warmth, calls rankNow, renders top live cards + Up next/Later folds + ❄ rescue card
src/components/DomainsMap.tsx  Domains tab: warmth tiles (glow + word), glass (S9/S11)
src/components/PulseView.tsx  Pulse tab: done-this-week count + 7-day sparkline + warmth standings (S13)
src/components/CaptureSheet.tsx  + tab: smart-capture field + live parsed preview, commits via seam (S12)
src/components/TabBar.tsx    bottom nav Now/Domains/Pulse/+ (S7), frosted (S11)
src/components/TaskItem.tsx  tap-the-dot complete + ring pulse + rescue marker (S8/S10); glass card (S11)
src/components/UndoToast.tsx 3 s undo pill (S8)
src/components/GlassPanel.tsx  frosted-glass primitive, 4 elevations (S11)
src/components/AddTaskInput.tsx  legacy add flow — superseded by CaptureSheet in App.tsx; kept only because doneWhenUi/priorityUi unit tests still target it (delete with those tests when convenient)
src/sync/SyncProvider.ts    the seam (add, update, list, toggleDone, delete)
src/sync/LocalOnly.ts       Dexie-backed impl (only DB toucher); toggleDone sets/clears completed_at
src/db/LifeOSDb.ts          Dexie schema (only Dexie import); v2 (priority indexed; project/domain/completed_at NOT)
src/hooks/useTasks.ts       reactive-ish hook; fetch-based (list once + refresh); fires navigator.vibrate on complete
src/App.tsx                 tab state + view switching; time-of-day gradient; provider instantiated here (sync swap point)
src/index.css, tailwind.config.js  glass tokens (--glass-*, shadow-glass-*) (S11)
e2e/pwa.spec.ts             Playwright PWA tests (navigates via tab bar; asserts 7 domain tiles)
docs/adr/0007..0008         NOW dumb brain → balance brain
kanban.html                 live board (data + UI in one file; #board-data JSON) — blockedBy reflects TRUE deps + wave labels
```

## Run it locally
```
npm install
npm run dev
npm test                # Vitest
npm run build && npm run preview
npx playwright install chromium && npm run test:e2e
npm run test:pwa-audit  # installability audit
```

## Next vertical — Wave 6: S14 vault read is a HUMAN GATE ⛔
MVP (Groups A–C) is shipped. The next slice opens **Group D (sync)** and is **NOT for `auto` dispatch.**
- **S14 — vault read** — transport **DECIDED (ADR-0009): git-as-transport** (in-browser clone of the vault repo into IndexedDB; isomorphic-git + CORS proxy). Chosen over bridge/FSA because offline-on-Android-away-from-home is a hard requirement. **Read-only slice: NO `Task` shape change, NO `updated_at`/`deleted_at`, NO tombstones, NO Dexie migration — schema stays v2.** (Earlier drafts over-scoped this; the sync fields + migration + LWW land in S15 write, per ADR-0002/0005.) Grill done, ADR written — gate cleared.
- After S14: **S15 vault write** (Obsidian vault becomes the real truth via a `VaultSync` provider body swapped at the seam — ADR-0002).
- Then **Group E — Telegram bot:** S16 text → S17 confirm-edits ∥ S18 voice ∥ S19 photo (the three modality slices parallelize off S16). S16 is where the *concept* of S12's capture is reused — but via Claude NLU, not the regex parser.

## How work gets shipped here (afk-pipeline workflow)
- Plan/grill → PRD/slice issues → Sonnet implementer agents (isolated worktrees, branch off fresh `origin/master`) → PR → **dual-green** (CI green AND ponytail-review ultra) → orchestrator merges → next wave.
- Dispatch waves are **derived batches**: `status:ready` slices with pairwise-disjoint write-sets run concurrently; chained/hotspot-sharing slices serialize. Update `kanban.html` (the `#board-data` JSON) when a slice ships.
- Each slice is a vertical tracer bullet; polish is its definition-of-done, not a later phase.

## Lessons / gotchas
- **Pull local `master` (or branch off `origin/master`) before dispatching the next slice.** Stale-base branches cause add/add conflicts + missing CI. Disjoint write-sets let a sibling slice merge cleanly even when branched off the pre-sibling tip (S9 merged clean over S8).
- **Resolve design judgment up-front so slices stay Sonnet-readable.** This run pre-decided the non-indexed `completed_at` (ADR-0005 pattern) and the `rankNow(tasks, warmth, opts)` signature inside the issues — implementers carried decisions, not questions.
- **Cross-slice cleanup belongs in a solo slice.** Deleting `TaskList.tsx` + the dead Domains-undo portal was folded into S10 (solo), not a separate chore PR, to avoid a parallel-conflict.
- **Direct push to `master` is gated; `git push --force*` is blocked.** Squash-merges delete the slice branch; branch the next slice off updated `origin/master`.
- **`useTasks` is fetch-based, not a Dexie `liveQuery`** — `list()`s once and refreshes after its own mutations; `App.tsx` calls `refresh()` after a non-zero seed. Switch to `liveQuery` if a future slice needs reactivity, rather than scattering `refresh()` calls.
- **A UI relabel breaks Playwright selectors.** S12 renamed the add field's aria-label (`New task title` → `Capture task`); the `e2e/pwa.spec.ts` `getByLabel` locator went stale and `pwa-e2e` went red while `build-test` stayed green. When a slice renames an accessible label/text, grep `e2e/` for the old string in the same diff. (Vitest unit tests targeting the old `AddTaskInput.tsx` directly are unaffected — they still use the old label.)
- **Local `npm test` exit-1 ≠ CI red.** A 600 ms `TaskItem` timer firing post-unmount throws an unhandled error in jsdom locally (exit 1) while all assertions pass; CI `build-test` is green. Trust CI as the gate. (A future tidy: clear that timer on unmount.)
- Lighthouse v10+ has no PWA category — installability is checked via Playwright/CDP (ADR-0003).
