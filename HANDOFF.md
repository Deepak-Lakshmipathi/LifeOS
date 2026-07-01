# LifeOS — Handoff

Last updated: 2026-07-01. Picks up after Wave 7 shipped **S15 vault write** (S15a AFK + S15b HITL, both merged to `master`). **Groups A + B + C + D all COMPLETE — MVP + full Obsidian vault sync done.** The app is a tab-navigated, glass-skinned command center: bottom tab bar (Now / Domains / Pulse / + ), tap-the-dot completion with undo, derived domain warmth, a balance-brain NOW queue, smart shorthand capture, and a light Pulse trends surface — all behind a frosted glass / time-of-day-gradient look. Behind `VITE_VAULT=1` the **Obsidian vault is now the real source of truth** (git-as-transport read **and** write). **Next is Group E — S16 Telegram bot (text → create), a new-transport slice: likely a HUMAN GATE (grill + PRD before dispatch, like S14 was).**

> Run note: slices ran as parallel/solo Sonnet implementer agents in isolated git worktrees, each branched off fresh `origin/master`, driven to a **dual-green** merge gate (CI green **AND** ponytail-review). Wave 5 ran S12 → S13 **serially** (S13 depends on S12, and both wire a view into `App.tsx` — shared hotspot, so serialized rather than parallelized). Earlier waves: Wave 2 ran S8 ∥ S9 concurrently on disjoint write-sets; S10/S11 solo.

## What LifeOS is
A personal, Apple-feel life tracker for a single user (the repo owner), built local-first as an installable PWA that runs offline on Windows and Android. Restarting after a full teardown; seed data in `seed_tasks_detailed.json` captures the long-term intent (folders → projects → tasks across 7 life domains). Read `CONTEXT.md` for the glossary, `docs/slices/README.md` for the slice backbone + product vision, and `memory/lifeos-vision-2026-06-22.md` for the full design rationale (Obsidian-vault backend; three faces: PWA dashboard, Telegram bot, Obsidian).

## Current state (on `master`)
**Slices S1–S15 are complete and merged — MVP (Groups A + B + C) + vault sync (Group D) done.** A working, installable, offline task app with a real navigation shell, the glass look, smart capture, a Pulse surface, and a live Obsidian-vault backend behind a flag:

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
- **Vault read (S14, ADR-0009), git-as-transport:** `GitTransport` in-browser shallow-clones the vault repo into an IndexedDB-backed lightning-FS (isomorphic-git + CORS proxy), behind the `VaultTransport` interface. Pure `parseVault`/`parseTaskLine` turn markdown task lines into `Task[]` (52 fixtures). `VaultSync` is the provider body swapped at the seam when `VITE_VAULT=1` (else `LocalOnly` stays default). Read-only in S14; **no `Task` shape change, schema stays v2.**
- **Vault write (S15, ADR-0010), vault is the real truth:** turns `VaultSync`'s throwing mutations into real writes.
  - **S15a (AFK, PR #59):** pure `serializeTaskLine` (inverse of `parseTaskLine`, round-trip fixture-tested) + `VaultSync` real `add`/`update`/`toggleDone`/`delete`. Identity is an **in-memory source-map** (`Map<id,{path,rawLine}>` built during `list()`); a mutation finds the **exact verbatim `rawLine`** and splices/removes just that one line (never a whole-file rewrite — `parseVault` is lossy, would destroy the owner's hand-authored notes). Match-count ≠ 1 → throw + force refresh. Writes serialized through an in-memory promise-chain FIFO queue. **No durable `id::`, no `updated_at`/`deleted_at`, no LWW, schema stays v2** (those land with the S16 bot / a real second mutator, per ADR-0010 §2).
  - **S15b (HITL, PR #61):** real `GitTransport.writeFile` — mkdir-recursive → `git.add` → **local-authoritative `git.commit`** (always succeeds offline) → **best-effort `git.push`** (swallow offline/non-ff; the unpushed commit *is* the queue). Fixed the **wipe-reclone data-loss hazard**: `readFiles()` now pushes pending commits and only wipes-and-reclones when nothing is ahead of origin. `readFiles()` also scans a top-level `Inbox/` folder; `parseVault` maps filename `Inbox` → `project = undefined` (domain-less/project-less home). **Not CI-verifiable (no remote in CI) — owner hand-verified** against the live vault with a Contents:Read+Write PAT.
- **First run on an empty DB seeds** from `seed_tasks_detailed.json` (107 tasks) via `seedIfEmpty` — idempotent empty-check, `?noseed` test hook (ADR-0006).
- Persists locally; survives reload; fully offline; installs as a PWA.

Repo: `Deepak-Lakshmipathi/LifeOS` (public), default branch `master`. Ship via branch + PR — direct push to `master` is gated.

**Open issues/PRs:** none. Wave 6–7: S14 (PR #54, docs #55), S15a (PR #59, docs #60), S15b (issue #58 → PR #61) — all squash-merged. S15b was **HITL by construction**: CI covers only the parser/build (git write path is behind the `VaultTransport` interface, no remote in CI), so the owner hand-verified the live add/toggle/update/delete-lands-as-commit, offline-commit-survives, and Inbox-round-trip cases before merge.
**Stale local branches/worktrees:** merged slice branches auto-deleted; S14/S15 worktrees pruned. Any remaining `.claude/worktrees/` agent dirs are safe to prune.

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
src/sync/VaultSync.ts       vault-backed impl (S14 read + S15a write): source-map identity, single-line splice, FIFO write-queue; active when VITE_VAULT=1
src/vault/transport.ts      VaultTransport interface + GitTransport (S14 readFiles / S15b writeFile): isomorphic-git + lightning-FS, local-authoritative commit + best-effort push, non-destructive wipe-fix, Inbox/ scan
src/vault/parseVault.ts     pure parseVault/parseTaskLine — markdown → Task[]; filename Inbox → project undefined (S15b)
src/vault/serialize.ts      pure serializeTaskLine(task) — inverse of parseTaskLine, round-trip fixture-tested (S15a)
src/db/LifeOSDb.ts          Dexie schema (only Dexie import); v2 (priority indexed; project/domain/completed_at NOT)
src/hooks/useTasks.ts       reactive-ish hook; fetch-based (list once + refresh); fires navigator.vibrate on complete
src/App.tsx                 tab state + view switching; time-of-day gradient; provider instantiated here (sync swap point)
src/index.css, tailwind.config.js  glass tokens (--glass-*, shadow-glass-*) (S11)
e2e/pwa.spec.ts             Playwright PWA tests (navigates via tab bar; asserts 7 domain tiles)
docs/adr/0007..0008         NOW dumb brain → balance brain
docs/adr/0009..0010         vault read transport (git-as-transport) → vault write (splice/source-map/no-sync-fields)
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

## Next vertical — Wave 8: S16 Telegram bot (text → create) is a HUMAN GATE ⛔
Group D (vault sync) is shipped. The next slice opens **Group E (Telegram bot)** and is **NOT for `auto` dispatch** — it introduces a whole new transport (a bot service, Claude NLU) and wants a grill + PRD + ADR first, exactly as S14 did for git-as-transport.
- **S16 — bot text → create** — new `services/bot/` pipeline: Telegram text → Claude intent/extract → vault write (reuses S15's `serializeTaskLine` + `GitTransport.writeFile`). This is where the *concept* of S12's capture is reused, but via **Claude NLU, not the regex `parseCapture`** — don't couple them. **Open design questions to grill before dispatch:** where the bot runs (serverless vs. long-poll worker) and how it authenticates to the vault repo (its own write-scoped PAT, separate from the PWA's). No issue/PRD exists yet.
- Then the three modality slices parallelize off S16: **S17 confirm update/delete ∥ S18 voice ∥ S19 photo** (all extend the S16 intent pipeline; same `services/bot/` dir, so coordinate the intent-router merge).
- **`id::` durable identity lands with S16, not before** (ADR-0010 §2 upgrade path): the bot is the first *second live mutator* editing tasks it did not author in-session, so in-memory source-map identity becomes insufficient — S16 is the slice that pays for stamped `id::`.

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
- **A HITL slice splits its gate: CI green covers only what runs without a remote.** S15b's git write path lives behind the `VaultTransport` interface — CI (`build-test` + `pwa-e2e`) verified the parser Inbox fixture + build, but the actual add/commit/push against a real repo cannot run in CI. The gate became *dual-green CI **plus** an owner hand-verify* (live add-lands-as-commit, offline-commit-survives-wipe, Inbox round-trip). When slicing, isolate the non-CI-verifiable part (here S15b) from the fully-testable part (S15a, fake-transport unit tests) so only the minimum needs a human.
- **The wipe-reclone fallback is a data-loss trap once writes exist.** `readFiles()` originally wiped+recloned the FS on any pull failure — harmless read-only, catastrophic once there are unpushed local commits (the offline queue). Fix pushed pending commits first and only wipes when nothing is ahead of origin. Any "reset local cache on error" path needs the same audit the moment that cache holds unsynced local writes.
- **The Obsidian vault (`LifeOS-Vault/`) is graphify OUTPUT, not source — never hand-edit it, and exclude it from re-graphifying.** It is regenerated from the real sources (code + `docs/` + `HANDOFF.md` + `kanban.html`). A `graphify --update` over the repo root re-ingests those ~300 generated markdown files as if they were input (a feedback loop that pollutes the graph and burns subagents); filter `LifeOS-Vault/`, `graphify-out/`, and `.obsidian/` out of the changed-file set before extraction.
