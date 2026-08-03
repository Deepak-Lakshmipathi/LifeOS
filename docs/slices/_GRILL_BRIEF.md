# Grill brief — post-v2 wave 14 ticket authoring (2026-08-01)

You are authoring ONE robust slice ticket from ONE GitHub issue found during
the 2026-07-31 live-testing session of the deployed PWA.

**Your ticket is the only thing the next session gets.** It must be
implementable and testable by an agent that has never seen this conversation.

## Process (do all four steps, in order)

### 1. Ground yourself in reality — no guessing
- `gh issue view <N>` — read the whole issue. It contains measured evidence
  (timings, DOM state, network codes, commit hashes). Trust it, but verify the
  code references still say what the issue claims.
- Read every file and line the issue names. Read the *callers* too — a fix at
  one call site when siblings share the bug is a wrong fix.
- `docs/slices/slice-S62-transport-config-seam.md` is the format exemplar.
- `CONTEXT.md`, `docs/adr/` and `docs/DESIGN_LANGUAGE.md` are binding when
  relevant. `docs/agents/afk-pipeline.md` defines the merge gate.

### 2. GRILL — this is the point of the exercise
Load the `grilling` skill and interrogate the design decision hard. Generate
the real branching questions, not a checklist. Push on at minimum:
- What is the ACTUAL root cause, versus the symptom the issue names?
- Which sibling call sites share the bug shape and must be fixed in the same
  pass? (Name them, with file:line.)
- What is the smallest correct change? What is the tempting over-build?
- What breaks if this ships wrong? What is the blast radius?
- What must be DECIDED by a human vs. what the ticket can settle itself?
- How would a reviewer prove the fix works — and prove the test would FAIL
  without it?

### 3. Answers come from the Systems Architect
Every grill question must be ANSWERED by the `systems-architect` subagent.
Spawn it (Agent tool, `subagent_type: "systems-architect"`) with the question
set plus the grounding you gathered, and use its reasoning as the authority
for the ticket's design decisions. Iterate if its first pass leaves a branch
unresolved. Do NOT answer the grill yourself and attribute it to the architect.

### 4. Write the ticket
Path: `docs/slices/slice-S<NN>-<kebab-slug>.md` (your assigned number).
Match the S62 structure exactly:

```
# S<NN> — <imperative title> (closes #<issue>)

Post-v2 · Wave 14 · Deps: <slice or —> · Blocks: <slice or —>

Source: GitHub issue **#<N>**. Read it before starting. <one-line framing>

## Context          <- why this exists, root cause, what was measured live
## Write-set        <- MODIFY/ADD each path + what changes in it
## Subtasks         <- numbered, small
## Definition of Done  <- NUMBERED, each objectively verifiable
## Tests            <- what proves it, incl. the red-first check
## Design refs      <- DESIGN_LANGUAGE §, ADR, or "None"
## Dispatch         <- `/afk-pipeline auto` with this file. Model: <Sonnet|Opus>. <rebase/sequencing note>
```

## Hard requirements for the ticket

- **Every DoD item must be objectively checkable** — grep-verifiable, a named
  test, or a measured number. No "works correctly", no "looks right".
- **Name the red-first check**: the specific assertion that must fail against
  current `master`, so the test cannot be vacuous. (See the #120 lesson: a
  guard test that passes for the wrong reason is worse than no test.)
- **State the human decisions explicitly** in the ticket where the architect
  says an owner call is needed. Do not silently pick for the owner; present
  the recommendation and mark it as needing confirmation.
- **Call out cross-ticket ordering** (shared files = hotspots that must
  serialize). Wave-14 known hotspot overlaps:
  `src/hooks/useTasks.ts` (#174, #178) ·
  `src/App.tsx` (#173, #180, #183) ·
  `src/vault/transport.ts` (#176, #177) ·
  framer-motion exit audit (#173, #181).
  If your issue touches one, say which other ticket it must rebase on.
- Merge gate is **triple-green** (CI + review + eval-subagent DoD check). The
  ticket must be written so an eval subagent can check each DoD item.

## Output
Write the file, then report back: the path, the 3 sharpest things the grill
changed about your initial reading, and any human decision you surfaced.
Do not commit. Do not touch any file other than your own ticket.

---

# SALVAGED GROUNDING (2026-08-01, first dispatch)

A first attempt dispatched 11 agents at once; ALL died on "You've hit your
session limit". These findings were verified before they died — **do not
re-derive them, but do sanity-check any you depend on.**

**Vault reader fan-out (relevant to #176, #177, #178).**
There are **seven independent vault readers**, each constructing its own
`new GitTransport()` with its own per-instance in-flight guard, all over ONE
shared lightning-fs store:
`src/App.tsx:22` (VaultSync/useTasks) · `src/sync/selfLoadTasks.ts:30`
(VitalsRow + Aurora) · `TodayCard.tsx:92` · `AttentionCard.tsx:80` ·
`FleetStrip.tsx:66` · `HabitsCard.tsx:124` · `HomeView.tsx:130`.
Counted precisely for #176: **7** independent `LightningFS`-owning objects on
the read path (2 module-level `VaultSync` singletons + 5 per-card
`new GitTransport()`), plus an 8th on the habit-write path — which exactly
matches the "7 at a time, plus one on the write path" observed live. The
per-instance in-flight guard is therefore useless across instances; that is
the real root cause, not the wipe-reclone line alone.

**Why four upload-pack 401s (#177). — PARTLY REFUTED 2026-08-03, see TRIAGE below.**
isomorphic-git's `discover` sends the **first request anonymously**, then calls
`onAuth` and retries once. No `onAuthFailure` is supplied, so a second 401
throws. Four upload-pack 401s ≈ two read paths × (anon + authed). So the 401
asymmetry may be an auth-flow artifact, not purely a proxy defect — verify
before blaming `cors-proxy/`.

**Error-card scope (#177, #178).**
`App.tsx:75-99`'s error card replaces `<main>` **only** — `<Header/>` and
`<VitalsRow/>` (lines 66-67) render above it, outside the error branch. That is
mechanically why a confident-looking cockpit sits above a "couldn't load your
vault" card. Also: `useTasks.ts:23` `error` is set only by the initial-load
effect and `setError(null)` appears **nowhere**, so the card can never clear
without a reload. `refresh()` (`:35-39`) has no catch at all — confirms #178.
No vault-level staleness concept exists: grep for `lastSynced` in `src/`
returns zero hits.

**Third capture surface (#183).**
`AddTaskInput` is legacy v1 code referenced **only by tests** — not live. Do
not treat it as a capture surface to migrate; decide whether to delete it.

**Test-environment hazard (#173, #181) — REFUTED 2026-08-03, see TRIAGE below.**
Headless Chromium may report `prefers-reduced-motion: reduce`, which swaps
`TAB_FADE` for `TAB_STATIC` (no `exit` at all) and would **mask both bugs** in
CI. Any regression test for the orphaned-exit bugs must prove it runs with
motion enabled, or it is vacuous. This was flagged but never confirmed —
confirming it is the first task for whoever writes S63/S71.

---

# TRIAGE RULING (2026-08-03) — architect + engineer pass over the blocked set

Wave-14 issues #177–#183 were triaged by the `systems-architect` subagent
(design forks) and an engineer subagent (empirical unknowns). **This section
supersedes any conflicting statement above.** Owner answered the one open
question: **YES**, `docs/DESIGN_LANGUAGE.md` §6 may be amended so the header
note derives from `dayStats` with no calendar claim.

## Structural rulings

- **#179 folds into #180 → one ticket `S70`** ("One owner for cockpit mode;
  derive the header note from real data"). Both must break Header's zero-prop
  contract (`Header.tsx:12-13`) and both rewrite `Header.test.tsx:86-100`,
  which today asserts the fabricated strings verbatim. #179 cannot pick *which*
  note to show without owning `mode`, so shipping it first means calling
  `useTimeOfDay` inside Header — the exact bug #180 exists to delete.
- **#177 splits.** `S67a` = the persistent sync-status surface
  (`src/vault/syncStatus.ts` + `SyncStatus.tsx`, mounted in `App.tsx` OUTSIDE
  `<main>` so it survives the error branch) — authorable now. `S67b` = the 401
  itself — parked, needs one live HAR capture.
- **S71 (#181) MUST land before S73 (#183).** #183 *moves*
  `HomeView.tsx:199-237` into `TasksView`; #181 *edits* those same lines.
  Neither issue says so. S73's DoD must assert it carried S71's fix across.
- **No repo-wide exit audit.** S63 owns the shell protocol + ADR-0015; S71
  amends it for local presence blocks. `slice-S63:222` already lists a
  repo-wide audit under forbidden over-builds.
- **Fourth orphaned `exit`, unfiled:** `MissionCard.tsx:105-111` renders
  `UndoToast` (which declares `exit` at `UndoToast.tsx:47`) with no
  `AnimatePresence` ancestor. Benign today. Assigned to **S72**.

## Corrections — a ticket written against the old text would be WRONG

1. **The reduced-motion hazard does not exist.** Measured: Playwright 1.61
   defaults `reducedMotion: 'no-preference'` and *overrides the host OS*
   (`reduce: false`, with per-rAF opacity samples proving `TAB_FADE`'s exit
   runs). jsdom has no `window.matchMedia`, so framer-motion's
   `useReducedMotion()` takes its else-branch and returns `false`. Both merge-
   gate environments run with motion ON. A one-line guard assertion is enough.
2. **`test.use({ reducedMotion: … })` is silently ignored in Playwright
   1.61.0** — proven against a `colorScheme`/`viewport` control in the same
   block, which did apply. `e2e/zzrepro173b.spec.ts:7-37` never tested what it
   claimed. Use `browser.newContext({reducedMotion})` or `page.emulateMedia()`.
3. **#182's write-set is `TaskItem.handleDotTap` (`TaskItem.tsx:51-68`), not
   `NowView`.** `NowView.tsx:40-42` is synchronous; the await lives one level
   deeper. `TaskItem` is shared beyond NowView — wider blast radius.
   Also: moving `setPendingUndo` earlier is NOT enough — `UndoToast.tsx:26-29`
   starts its dismiss timer on mount, so a 3s timer at t=0 fires before an 8s
   write resolves. Needs a `settled` gate or the fix makes the bug worse.
4. **#178 has FOUR unguarded `await refresh()` sites** — `useTasks.ts:64, 72,
   84, 92` — not one. Fixing only `addTask` is a wrong fix. Note S64 deletes
   `refresh()` from `addTask`, so #178's own suggested test is half-vacuous:
   only the error-surface half is load-bearing.
5. **`cors-proxy/` is exonerated by construction.** `worker.js` has no branch
   on `service=` anywhere; `?service=` is in the query, not the pathname, so
   both services hit the same `\/info\/refs$` alternative. The anon-first
   mechanism is confirmed (`node_modules/isomorphic-git/index.js:9104-9169`)
   but CANNOT explain the asymmetry — `_push` uses the identical `discover`,
   so receive-pack must 401 first too. The "4×401" count is not ground truth.
6. **#183's `App.tsx:103` / `:106-112` are exact at HEAD but +12 off** in a
   tree carrying the ownership-comment change. Cite symbols, not line numbers.
7. **`AddTaskInput` is deletable but not free:** `syncProvider.test.ts:63-70`
   is an architectural-fitness test that dynamically imports it for a Dexie-leak
   assertion. Port `doneWhenUi` / `priorityUi` to `CaptureSheet` first.
8. **Local `.env` produces 3 phantom red tests** (2 vitest in
   `transport.test.ts`, 1 e2e). `VITE_VAULT_REPO_URL` is inlined by Vite, so
   the `if (!url)` guard never fires and the prod build hits `window.prompt`
   in `pat.ts:26-28`. Run `VITE_VAULT_REPO_URL= npm run test`. CI has no
   `.env` and is green.

## Hotspot lanes (strictly serial within a lane)

- `src/App.tsx`: **S63 → S70 → S71 → S73 → S67a** (S67a is one line, anywhere after S63)
- `src/hooks/useTasks.ts`: **S64 → S68 → S72**
- `src/vault/transport.ts`: **S66 → S67a**
- `src/components/home/HomeView.tsx`: **S70 → S71 → S73**
- `src/components/UndoToast.tsx`: **S68 → S72**

## Authoring order (2 agents at a time, hard limit)

Pair 1: **S68 (#178) + S72 (#182)** — same `useTasks` lane; S72 must amend
S64's DoD #7 (a queued inversion, not a dropped no-op), which S68's author
needs to see.
Pair 2: **S70 (#180+#179) + S73 (#183)** — S73 inherits S70's HomeView prop change.
Pair 3: **S67a (#177 staleness) + the S71 spike** — no shared files.

**S71 spike (≤1h, read-only):** reproduce #181 with a deferred `onAdd` that
resolves with a parent re-render inside the exit window. The assertion is
already written and GREEN on broken master
(`src/test/zzscratchS71.test.tsx:36-38`) — **the red IS the deliverable**. Run
pre-S64 or with an artificially slowed provider: S64 cuts `onAdd` from 1-9s to
~1.1s and may make #181 unreproducible without fixing it.
