# S63 — Remove the shell's AnimatePresence exit protocol so no panel can trap navigation (closes #173)

Post-v2 · Wave 14 · Deps: — (first `src/App.tsx` toucher of the wave) · Blocks: S6x/#180, S6x/#183 (both edit `src/App.tsx` — they rebase on this)

Source: GitHub issue **#173**. Read it before starting. Highest-severity find of the
2026-07-31 live-testing session: the app goes blank and appears frozen, with
invisible-but-clickable content still mounted underneath. **The issue's own
"Root cause" and "Suggested fix" sections are wrong — read the Context below
before you write any code.**

## Context

**Symptom (reproduced live and in headless Chromium).** Activate the Domains
sub-tab inside Tasks, then click any main tab. The nav pill highlights and
`aria-current="page"` moves, but the incoming panel never mounts and the
outgoing panel stays in the DOM at `opacity: 0`. `main.innerText` still returns
the Domains content and `document.elementFromPoint()` still returns the
invisible tiles — invisible-but-clickable, not merely a cosmetic blank. Only a
reload recovers.

**What the issue says the cause is.** `DomainsMap.tsx:107` and `PulseView.tsx:68`
declare a root `exit` with no `AnimatePresence` of their own
(`TasksView.tsx:65-66` renders them from bare conditionals), so their exit never
completes and `AnimatePresence mode="wait"` at `App.tsx:100` never swaps. Its
suggested fix is to delete those orphaned `exit` props.

**Why that is a symptom fix.** Measured against current `master` in real
Chromium: `PulseView` has the *identical* orphaned-`exit` shape and **does not
trap** in any condition tried (`?noseed` or seeded, motion on or reduced). And
`DomainsMap` traps **only with the 107-task seed present** — with `?noseed` it
unmounts cleanly. So the orphaned `exit` is the fuse, not the powder. Deleting
the three orphaned `exit` props leaves the shell's failure mode fully armed for
the next panel that declares `exit`, `layout`, or `layoutId`.

**The actual root cause** (established from the installed `framer-motion@11.18.2`
source, not from memory):

1. `AnimatePresence` tracks exit completion through an **acknowledgement
   protocol**. `PresenceChild`'s `memoizedOnExitComplete` returns early unless
   *every* registered descendant has reported `true`; the auto-complete escape
   hatch only fires when the registration map is **empty**.
2. Under `mode="wait"`, `nextChildren = exitingChildren` — the incoming panel is
   **not rendered at all** until every acknowledgement lands. One missing ack =
   total blackout. (Under `mode="sync"` the incoming panel mounts immediately and
   the worst case is a stuck ghost layer.)
3. A descendant joins the protocol **implicitly**, by declaring `exit`
   (`features/animation/exit.mjs` → `ExitAnimationFeature.mount()` → `register`)
   **or** `layout`/`layoutId` (`features/layout/MeasureLayout.mjs` calls
   `usePresence()` and owes `safeToRemove()`). No opt-in, no type-level signal.
4. The obligation is **edge-triggered and one-shot**: `ExitAnimationFeature.update()`
   bails on `isPresent === prevIsPresent`. Miss the edge and there is no retry.
5. There is **no timeout, watchdog, or fallback** anywhere in this path.
6. `PresenceChild` rebuilds its context on every render (`presenceAffectsLayout`
   defaults true → deps include `Math.random()`), forcing every descendant motion
   node to re-render and re-enter `animateChanges()`. With the 107-task seed,
   `App.tsx:55-59`'s `seedIfEmpty(...).then(refresh)` plus the self-loading cards
   drive exactly that churn inside the 300 ms exit window. That is the trigger,
   and (4) makes a single lost ack permanent.

So: **`App.tsx`'s correctness is a function of the internal animation details of
arbitrary descendants of arbitrary panels**, through an untimed, edge-triggered,
implicitly-joined protocol. The shell is a microkernel and the tab panels are
plugins; `mode="wait"` lets a plugin hang the core. That is what this ticket
removes.

**Note on a hypothesis that was tested and refuted** (do not revisit): the 7
nested `motion.div` tiles at `DomainsMap.tsx:120-131` have no `exit` prop, so
`featureDefinitions.exit.isEnabled` is false, no `ExitAnimationFeature` is ever
constructed, and they never register. They also cannot be reached by variant
propagation (`isVariantNode` is false — the root uses object targets, not variant
labels). **The tiles are architecturally inert.**

**The fix already exists in the file.** `TAB_STATIC` (`App.tsx:33`), the
reduced-motion branch, has **no `exit`** and has always worked. This ticket makes
the motion branch match the branch already proven correct, and collapses an
asymmetry between the two that was itself the hazard.

**§7 compliance.** `docs/DESIGN_LANGUAGE.md` §2.3 specifies
`Tab fade | .3s ease, opacity + 6px rise | continuity between tabs` — a duration,
two properties, and an intent. It does **not** mandate an exit animation or
sequential choreography. An enter-only fade satisfies the contract as written.
What is genuinely lost is the outgoing fade: the exit becomes a cut. See Human
decisions (2).

## Write-set

- **MODIFY `src/App.tsx`** — remove the `AnimatePresence` import (`:2`) and the
  wrapper (`:100`, `:118`); remove `exit` from `TAB_FADE` (`:30`). Keep
  `<motion.section key={tab} {...tabMotion}>` exactly as-is — React unmounts the
  old tab synchronously on the key change and the new one fades in. Update the
  `TAB_FADE` comment block (`:24-26`) and the file docstring (`:43-46`) to record
  why the shell must never re-introduce `AnimatePresence`.
- **MODIFY `src/components/DomainsMap.tsx`** — delete `exit` (`:107`) and the now
  vestigial `key="domains-map"` (`:104`).
- **MODIFY `src/components/PulseView.tsx`** — delete `exit` (`:68`) and
  `key="pulse"` (`:65`). Prophylactic: same unowned obligation, trigger simply not
  yet met.
- **MODIFY `src/components/NowView.tsx`** — delete `exit` (`:74`) and
  `key="now-empty"` (`:71`). Same shape, same reason. **Do not touch** NowView's
  three legitimate `AnimatePresence` blocks (`:105`, `:125`, `:161`) or its
  `motion.div layout` (`:98`).
- **ADD `src/test/shellNavigation.test.tsx`** — Tests A and B below.
- **MODIFY `e2e/pwa.spec.ts`** — add Test C after the existing Domains sub-nav
  case (`:121-141`), reusing its seeded-`/` + `serviceWorker.ready` idiom.
- **ADD `docs/adr/0015-shell-owns-no-presence-protocol.md`** — records the two
  implicit registration classes (`exit`; `layout`/`layoutId`), the no-timeout
  finding, and the per-mode blast-radius difference (`wait` = blackout,
  `sync` = ghost layer). Referenced by this ticket and by S71/#181. See Human
  decisions (3).

**Deliberately NOT in the write-set** — every one of these is a legitimate
`exit` under a real `AnimatePresence` ancestor that does not use `mode="wait"`,
so an unfulfilled ack there cannot blank the app. Touching correct code with no
defect behind it is added risk: `UndoToast.tsx:47`; `TaskItem.tsx:174`, `:190`,
`:215`; `HomeView.tsx:205`, `:214`.

## Subtasks

1. Write Test A (never-completing presence stub) and Test B (static analysis) and
   watch **A fail** against unmodified `master`. Do not proceed until it does.
2. Remove `AnimatePresence` + `TAB_FADE.exit` from `src/App.tsx`. Test A goes green.
3. Delete the three orphaned `exit` + vestigial `key` pairs (DomainsMap, PulseView,
   NowView).
4. Add Test C to `e2e/pwa.spec.ts` with `test.use({ reducedMotion: 'no-preference' })`.
5. Write ADR-0015. Update the `App.tsx` docstring to point at it.
6. Full suite + `npm run build`; confirm the tab fade still reads correctly on
   enter (screenshot for the owner — Human decision 2).

## Definition of Done

1. `AnimatePresence` appears **zero** times in `src/App.tsx` (grep-verifiable), and
   is no longer imported there.
2. Grep-verifiable, exactly: `rg -c 'exit='` returns **no matches** for
   `src/components/DomainsMap.tsx`, `src/components/PulseView.tsx`, and
   `src/components/NowView.tsx` (each has exactly **1** on current `master`), and
   `rg 'exit:' src/App.tsx` returns **no matches** (the `TAB_FADE` object key at
   `:30`). `NowView`'s three `AnimatePresence` blocks and their cross-file children
   stay — none of these four files declares an `exit` of either form after this PR.
3. `key="domains-map"`, `key="pulse"`, and `key="now-empty"` appear **zero** times
   in `src/` (grep-verifiable) — the fossils that would tempt a future reader to
   "restore" the `exit` for symmetry are gone.
4. **Test A** (`src/test/shellNavigation.test.tsx`) exists, and **fails on
   `master` with only the test applied**. The PR body must quote its failure
   output from that red run. (Red-first proof — see Tests.)
5. **Test B** asserts `src/App.tsx` does not reference `AnimatePresence` by
   reading the file, in the style of `src/test/syncProvider.test.ts:54` and
   `src/test/tokens.test.tsx:16`.
6. **Test C** exists in `e2e/pwa.spec.ts`, is scoped by
   `test.use({ reducedMotion: 'no-preference' })`, and asserts **both** that
   `[data-testid="domain-tile"]` has count `0` and that `document.elementFromPoint`
   at the centre of `<main>` does not resolve into a `[data-testid="domain-tile"]`
   subtree, after Domains → Home on a seeded `/`.
7. `src/components/UndoToast.tsx`, `src/components/TaskItem.tsx`, and
   `src/components/home/HomeView.tsx` are **unchanged** by this PR (`git diff --stat`
   verifiable) — scope discipline; #181 is out of scope.
8. `docs/adr/0015-shell-owns-no-presence-protocol.md` exists and names both
   registration classes (`exit`, and `layout`/`layoutId` via `MeasureLayout`).
9. `npm run build` + `npm test` + `pwa-e2e` all green; issue #173 closed by the PR.

## Tests

**Test A — the load-bearing red (Vitest/jsdom, deterministic, sub-100 ms).**
Do **not** try to reproduce #173 by replaying the user journey in jsdom: that was
measured and it is **vacuous**. All five journey-replay cases (Domains → Home,
Pulse → Money, NowView empty → Home, and the #181 capture-sheet assertion)
**passed against broken `master`** in jsdom with `matchMedia` mocked to
`matches: false`. jsdom is not blind to DOM absence — the harness simply removes
the trigger. This is the #120 lesson exactly.

Instead, test the **invariant**, not the incident: mount the shell with a stub
panel that *deliberately never completes its presence obligation* — a
`motion.div exit={{ opacity: 0 }} transition={{ duration: 1e6 }}`, or a component
calling `usePresence()` that never calls `safeToRemove`. Switch tabs. Assert the
incoming panel mounted **and** the outgoing subtree is gone.
- Red on `master`: `mode="wait"` never swaps `renderedChildren`, so the incoming
  panel is absent from the DOM. That is the assertion that must fail.
- Green after the fix: trivially, because no protocol remains to hang.
- No seed, no clock, no timing dependence. It pins the real property: *the
  shell's correctness does not depend on any panel's animation behaviour.*
- **Do not use `vi.useFakeTimers()`** — framer-motion's rAF driver interacts badly
  with it and you will manufacture another vacuous green. The never-completing
  stub is the deterministic lever.
- Fallback if injecting a stub panel into `App` needs a seam that does not exist
  (do **not** restructure `App` to create one — that is scope creep): render `App`
  with a provider whose `list()` promise you resolve **manually, mid-transition**.
  Deterministic control of when the churn lands is what jsdom gives you and
  Chromium does not.

**Explicitly rejected as the DoD anchor: the seeded Chromium red.** It is real
(107-task seed, Domains → Home, 7 tiles still mounted after 6 s, ~9 s runtime)
but **incidental** — it depends on seed size, seed timing, and self-loader
latency, none of which are stated invariants. Any of them shifting turns it green
with the bug present. Keep it as Test C (acceptance evidence that a real browser
is fixed); never build the DoD on it.

**Test B — structural.** Assert `src/App.tsx` contains no `AnimatePresence`
reference. This is the only thing preventing a future slice from silently
re-arming the hazard with one auto-import.

**Test C — one e2e case.** Seeded `/` → Tasks → Domains → Home; assert tile count
`0` and non-hit-testability. Pin `reducedMotion: 'no-preference'`. **Why pin it
when it is already the default:** headless Chromium was measured reporting
`prefers-reduced-motion: reduce === false` / `no-preference === true` (Chrome 149,
`devices['Desktop Chrome']`) — so the salvaged worry that CI silently swaps in
`TAB_STATIC` is **refuted**. But that is a current default, not a contract; it is
an unpinned dependency on Playwright's device profile, the Chromium build, and
runner OS settings. The whole bug class exists only on the motion branch, so a
silent flip to `reduce` would convert this into a permanently-green vacuous test
undetectably. One line removes the class. Do **not** add a mirrored
reduced-motion case — `TAB_STATIC` already has no `exit`.
**Do not attempt `elementFromPoint` in jsdom** — jsdom has no real hit-testing and
will hand back a vacuous assertion. Hit-testability is asserted in Test C only.

**Over-builds to refuse** (named so a reviewer cannot re-litigate them):
- **Wrapping `TasksView`'s segment conditionals in their own `AnimatePresence`** to
  "make the exits legitimate." The most tempting wrong move: it *adds* an
  acknowledgement protocol where none is needed and recreates the identical hazard
  one level down.
- Watchdogs, `onExitComplete` timeouts, forced key-bumps, or a "force remount on
  tab change" effect — compensating for a protocol you can simply not use.
- A shared `<TabPanel>` wrapper or motion-policy HOC for five call sites.
- A repo-wide framer-motion exit audit touching `TaskItem`/`UndoToast`/`HomeView`.
- A generic "orphaned exit" lint rule — refused on evidence: a same-file heuristic
  false-positives on `UndoToast.tsx:47` and `TaskItem.tsx:174/190/215`, whose
  `AnimatePresence` legitimately lives in `NowView.tsx`; a cross-file version needs
  real dataflow analysis. The narrow `App.tsx` rule (Test B) has zero false
  positives and pins the decision that matters.
- Bumping or patching framer-motion — a separate, independently-revertible call.

**Recorded, not changed:** `NowView.tsx:98` and `TaskItem.tsx:171` declare
`layout`, which registers with the ancestor `PresenceContext` via `MeasureLayout`'s
`usePresence()` — the second, unnamed obligation class. Under today's shell that
ancestor is App's `mode="wait"` child. After this fix there is no `PresenceContext`
above `NowView` at all, so the obligation vanishes. This ticket therefore also
closes a hazard nobody had named. Note it in ADR-0015; change no code.

## Design refs

`docs/DESIGN_LANGUAGE.md` §2.3 (Tab fade: `.3s ease`, opacity + 6px rise) and §7's
non-negotiable reduced-motion contract. The enter fade, its duration, and its 6px
rise are unchanged; only the outgoing fade is lost. New: `docs/adr/0015`.

## Dispatch

`/afk-pipeline auto` with this file. Model: **Opus** — the fix is four small
diffs, but Test A requires reasoning about framer-motion's presence protocol and
is the exact place a Sonnet-tier agent would substitute the vacuous journey-replay
test that has already been measured green on broken `master`.

**Sequencing — `src/App.tsx` is a wave-14 hotspot** shared with **#180**
(morning/midday/evening control) and **#183** (move `+ New task` off Home). S63
should land **first** — it is the smallest `App.tsx` diff and the highest severity.
Both other tickets rebase onto S63's merge. If S63 is not first, it must rebase
onto whichever landed.

**#181 / S71 stays a separate ticket. Do not claim its scope.** #181 claims to be
"the same underlying shape," and that claim was tested and does not hold: the
CaptureSheet lives inside a **well-formed, default-`sync`** `AnimatePresence`
(`HomeView.tsx:199-237`) with a properly nested exit pair, and under `sync` an
unfulfilled ack cannot blank the app. It also **did not reproduce** headless —
the input was removed after add, and after a 6 s wait. Folding an unreproduced
hypothesis into a ticket that has a proven red contaminates the DoD, and a green
S63 would falsely "close" #181 while the owner still sees the behaviour. What S71
needs and S63 cannot give it is **a reproduction**: real device rather than
headless, virtual-keyboard/focus interaction, a slow `onAdd` (vault write rather
than `LocalOnly`) so the sheet closes with a write in flight, and — the leading
hypothesis — the **spring** at `HomeView.tsx:215`
(`type: 'spring', damping: 28, stiffness: 320`). Springs have no fixed duration; a
spring interrupted mid-flight and re-targeted is a genuinely distinct candidate for
a promise that never settles, and has nothing to do with orphaned `exit`. S63 hands
S71 ADR-0015; it does not hand it a fix.

## Human decisions — confirm before/while dispatching

1. **`src/App.tsx` ownership (blocking).** `App.tsx:43-46` states S58 is "the sole
   post-v2 toucher of this file — no other card may edit it." The fix **requires**
   editing it; S63 cannot grant itself that permission. *Evidence it is already
   superseded:* the wave-14 brief lists `src/App.tsx` as a known hotspot shared by
   #173/#180/#183, which presumes wave-14 tickets edit it. **Recommendation:**
   confirm the S58 clause is retired for wave 14 and have S63 rewrite that
   docstring paragraph. Needs owner confirmation.
2. **The exit-cut is a real visual change.** §7 as written does not mandate an exit
   animation, so I read the fix as contract-compliant — but DESIGN_LANGUAGE is a
   locked contract and "does it still feel right" is the owner's eye.
   **Recommendation:** accept the cut (it reads as intentional at 300 ms over the
   persistent aurora ground); look at a screenshot before merge. If the owner
   rejects it, the fallback is `mode="sync"` **plus** grid-stacking both sections in
   one cell **plus** `pointer-events: none` on the outgoing one — strictly more
   machinery for strictly less safety, so only on an explicit owner call.
3. **Is an ADR warranted?** My read is yes — this constrains every future panel,
   which makes it strategic rather than tactical — but authoring an ADR is a
   governance act. **Recommendation:** yes, write ADR-0015.
4. **Adding a case to the `pwa-e2e` merge gate** lengthens a required job on every
   PR. **Recommendation:** accept — one ~9 s case for the session's
   highest-severity bug.
5. **#181 triage:** close as not-reproduced, or leave open pending the condition
   list in Dispatch above? **Recommendation:** leave open, retitle to name the
   spring hypothesis, keep S71.
6. **Spike the exact framer-motion defect for an upstream report?** Unnecessary for
   the fix (this eliminates the protocol rather than repairing it), but a
   legitimate thing to want and not free. **Recommendation:** no, not in S63.
