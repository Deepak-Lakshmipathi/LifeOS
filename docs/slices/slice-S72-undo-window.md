# S72 — Open the undo window at click time and keep it open long enough to use (closes #182)

Post-v2 · Wave 14 · Deps: S64 (#174), S68 (#178) — last in both the `useTasks.ts` and `UndoToast.tsx` lanes · Blocks: —

Source: GitHub issue **#182**. Read it before starting. Interaction bug: undo is
the only recovery from a misclick, and today it is offered late and withdrawn
fast.

## Context

What a user experiences on the hosted build: tap the completion dot → nothing
for 1–8s (#174) → the toast appears → 3s later it is gone. Two independent
causes, and fixing either alone makes it **worse**:

- `MissionCard.handleComplete` (`MissionCard.tsx:72-79`) calls `setPendingUndo`
  only **after** `await onToggle(id)`; `TaskItem.handleDotTap`
  (`TaskItem.tsx:51-68`) calls `onCompleted` after its own await. So the toast
  is gated on a full write round-trip.
- `UndoToast.tsx:26-29` starts its dismiss timer **on mount** with
  `DISMISS_MS = 3000` (`:5`). Move the toast earlier without a gate and a 3s
  timer at t=0 fires before an 8s write resolves — the toast flashes and dies
  before the write it describes has landed.

S64 makes the fix possible: `toggleDone` applies its flip **synchronously before
its first `await`** (a stated contract, not an implementation detail), still
**rejects** on write failure, and post-S64 the settle is the ~1.1s local commit
rather than the 1–8s read (`slice-S64` Dispatch §). This slice moves the toast to
click time, starts the countdown at **settle**, widens the window to 8s, retracts
the toast when the write fails, and fixes the fourth orphaned `exit` that the
wave-14 triage assigned here.

Three grounding corrections, all verified at HEAD:

1. **`TaskItem` has exactly one parent** — `NowView.tsx:55` is the only
   `<TaskItem` render site (`TasksView.tsx:57` renders `NowView`). The triage's
   "shared beyond NowView" is imprecise: the blast radius is all three NowView
   sections (Live / Up next / Later), not multiple parents. That makes the
   `onCompleted` signature change cheap.
2. **`UndoToast.tsx:17-24` documents the bug as the contract** ("the timer starts
   on mount and restarts whenever `onDismiss` changes reference"). Rewrite the
   JSDoc, not just the code.
3. **`slice-S63:113-115` names `UndoToast.tsx:47`'s `exit` legitimate** and
   deliberately excludes it from S63's write-set. The orphan is at the *mount
   point* (`MissionCard.tsx:105-111`, no `AnimatePresence` ancestor;
   `NowView.tsx:125-134` is the correct shape) — fix it there, never at `:47`.

**Why `pendingIds` is not used.** S64 exposed it so S72 could gate Undo; that
plan is wrong on the merits. The undo re-issue is itself a `toggleDone(id)`, so
it puts the same id straight back into `pendingIds` — a toast gated on it would
re-arm its own gate after the user already dismissed via Undo. The correct
question is "has **this toast's** write settled", which is per-toast, not per-id,
and both toast owners already hold the exact promise. Threading `pendingIds`
would also mean editing `App.tsx:115,120`, i.e. joining a lane S72 is not in.
S64 therefore drops `pendingIds` (already amended in `slice-S64`).

### Non-goals — do not implement, do not test for

- **A watchdog / max-lifetime cap on the toast.** A toast whose write never
  settles sticking forever is **correct**: post-S64 the settle is a ~1.1s local
  commit, so a never-settling promise means a lightning-fs lock hang (S66's
  domain), and a stuck toast is then a desirable symptom, not a new defect. Same
  class as `slice-S63:219-220`'s refusal.
- **A "pending" visual on the dot or the toast.** `DESIGN_LANGUAGE.md` has no
  pending token and `slice-S64:74`, `:318-320` refused to invent one. Do **not**
  repurpose `TaskItem`'s 600ms ring pulse as one.
- **A repo-wide framer-motion exit audit or an "orphaned exit" lint rule**
  (`slice-S63:222-227`). Exactly one `AnimatePresence` is added, in
  `MissionCard.tsx`. `TaskItem.tsx:174/190/215` and `HomeView.tsx:205/214` stay
  untouched.
- **Any failure *message*.** S72 removes the now-false "completed" affordance;
  labelling the failure is S68's channel.
- **Merging the two `UndoToast` mount points into one owner.** Tempting (it would
  fix H3 below) but it is a HomeView/App restructure — forbidden lane.

### Owner decisions

1. **`DISMISS_MS = 8000`, counted from settle. RECOMMENDED: ship it, do not
   block.** Material's snackbar-with-action band is 4–10s (`LENGTH_INDEFINITE`
   reserved for critical); Gmail/Drive undo bars sit 5–10s. 3s is the
   *informational* toast number, not the *actionable* one — and the action here
   is not cheap: notice a peripheral bottom-center pill, read a title truncated
   at 160px (`UndoToast.tsx:52`), move a thumb, hit the target, with no other
   recovery path once the row has left every ranked section. Not indefinite (it
   becomes permanent chrome and multiplies the two-toast case), not 10s+ (it
   overlaps the next completion in a multi-complete flow). By the
   strategic-vs-tactical test this is tactical: one line, one stakeholder,
   reversible. De-risked so an override is trivial — `DISMISS_MS` is **exported**
   and behavioural tests import it, with exactly **one** literal assertion
   (`expect(DISMISS_MS).toBe(8000)`) as a deliberate-change tripwire.
2. **S64 DoD #7 amendment (deferred-inversion latch) — OWNER SANCTIONED
   2026-08-03. RESOLVED, not a dispatch gate.** The latch is written into
   `slice-S64` DoD #7 + tests (e)/(e2)/(e3) and S64 implements it, so S72 does
   **not** touch `src/hooks/useTasks.ts`. The fallback (S72 carries the latch
   itself) applies only in the one case where S64 somehow merged from its
   pre-amendment text — verify at rebase time that `owedRef` exists in
   `useTasks.ts` and that `grep -rn "pendingIds" src/` is empty; if not, stop and
   escalate rather than implementing around it.
3. **Two simultaneously-visible toasts** (MissionCard's and NowView's, same fixed
   bottom-center slot) become likelier at 8s. Pre-existing; the fix is a single
   toast owner = forbidden restructure. **RECOMMENDED: accept and file a
   follow-up issue.** Owner need only agree it is deferred.
4. **No new `pwa-e2e` case. RECOMMENDED: decline one.** The reds are
   deterministic in vitest and S63 already lengthened the gate.
5. **The ring pulse is now visually dead on the NOW path** (post-S64 the row
   unmounts in the same frame, so the pulse's `AnimatePresence`,
   `TaskItem.tsx:182`, tears down with it). **RECOMMENDED: leave it**; owner's
   eye at live-test time. Not a blocker, and not a pending affordance.

## Write-set

Six files. S64 carries the latch (owner decision 2, sanctioned) — `useTasks.ts`
is **not** in this write-set.

- MODIFY `src/components/UndoToast.tsx` —
  `export const DISMISS_MS = 8000`; add `pending?: boolean` (default `false`);
  replace the effect at `:26-29` with a latest-ref + `pending`-only deps:
  ```ts
  const onDismissRef = useRef(onDismiss)
  useEffect(() => { onDismissRef.current = onDismiss })
  useEffect(() => {
    if (pending) return
    const id = window.setTimeout(() => onDismissRef.current(), DISMISS_MS)
    return () => window.clearTimeout(id)
  }, [pending])
  ```
  **Rewrite the `:17-24` JSDoc**, which currently documents the bug as the
  contract. No change to the markup (`:36-66`), the `exit` variant (`:47`), or
  `handleUndo` (`:31-34`). The prop is `pending`, not `settled`: a `settled` prop
  must default `true` (reads backwards), while `pending = false` keeps both call
  sites and all five existing `UndoToast` tests compiling unchanged.
- MODIFY `src/components/home/MissionCard.tsx` — `pendingUndo` gains
  `pending: boolean`; `handleComplete` (`:72-79`) becomes:
  ```ts
  setPendingUndo({ id, title, pending: true })
  try {
    await onToggle(id)
    setPendingUndo(p => (p && p.id === id ? { ...p, pending: false } : p))
  } catch {
    setPendingUndo(p => (p && p.id === id ? null : p))
  }
  ```
  The `p.id === id` guard is **load-bearing, not defensive**: complete A then
  complete B inside the settle window and B's toast has replaced A's; A's late
  settle must not start B's countdown, and A's late rejection must not delete B's
  toast. Add `import { AnimatePresence }` and wrap `:105-111` with
  `key="undo-toast"`, mirroring `NowView.tsx:125-134` verbatim; pass
  `pending={pendingUndo.pending}`.
- MODIFY `src/components/TaskItem.tsx` — `onCompleted`'s signature (`:28`, `:31`)
  gains a third argument: `(id: string, title: string, settled: Promise<void>) => void`.
  `handleDotTap` (`:51-68`) becomes `const settled = onToggle(task.id)` →
  `onCompleted?.(task.id, task.title, settled)` **before any await** →
  `await settled.catch(() => {})`; the `else` branch gets the same rejection
  sink. Passing the promise rather than adding an `onCompleteFailed` prop gives
  the toast owner both edges through one channel and makes
  `NowView.handleCompleted` structurally identical to `MissionCard.handleComplete`
  — three callbacks for one interaction is the Grains-of-Sand shape. **Ring pulse
  untouched** (`:53-56`, `:49`).
- MODIFY `src/components/NowView.tsx` — `pendingUndo` gains `pending`;
  `handleCompleted` (`:40-42`) consumes the promise (`.then` → un-pend with the
  id guard, `.catch` → retract with the id guard); pass `pending` at `:127-132`.
  The `AnimatePresence` at `:125` is already correct.
- MODIFY `src/test/tapDotComplete.test.tsx` — the two literals at `:148-179`
  become `DISMISS_MS` / `DISMISS_MS - 1`; `:74-75`'s
  `toHaveBeenCalledWith('task-1','Write tests')` gains `expect.any(Promise)`;
  **ADD** a `pending={true}` + `advanceTimersByTime(DISMISS_MS * 3)` case
  asserting `onDismiss` was not called. Nothing deleted, nothing loosened.
- ADD `src/test/undoWindow.test.tsx` — R1, R2, R3, R4, R6, R7, R8, the
  A/B-interleave case, and the motion guard.

Untouched and DoD-asserted: `src/App.tsx`, `src/components/home/HomeView.tsx`,
`src/components/tasks/TasksView.tsx`, `docs/DESIGN_LANGUAGE.md`, `docs/adr/`.

## Subtasks

1. Rebase onto S68's head (which sits on S64's). Confirm S64's synchronous-flip
   contract and the latch (amended DoD #7) are present before starting.
2. `UndoToast`: export `DISMISS_MS = 8000`, add `pending`, rewrite the timer
   effect with the latest-ref, rewrite the JSDoc.
3. `MissionCard`: reorder `handleComplete`, add the try/catch with the id guard,
   wrap the toast in `AnimatePresence`, thread `pending`.
4. `TaskItem`: widen `onCompleted`, call it pre-await, sink the rejection.
5. `NowView`: consume the settle promise, thread `pending`.
6. Update `tapDotComplete.test.tsx`; write `undoWindow.test.tsx`; confirm each
   red is red for the stated reason on the S68 head.

## Definition of Done

1. `grep -n "DISMISS_MS" src/components/UndoToast.tsx` shows
   `export const DISMISS_MS = 8000`, and `src/test/undoWindow.test.tsx` contains
   `expect(DISMISS_MS).toBe(8000)`.
2. The dismiss effect's dependency array is **exactly `[pending]`** and its body
   reads `onDismissRef.current`; `onDismiss` appears in **no** dependency array
   in the file (grep-verifiable). Test R4 passes.
3. `UndoToastProps` declares `pending?: boolean` defaulting to `false`, and with
   `pending={true}` no timer is scheduled — asserted by the new case in
   `tapDotComplete.test.tsx`.
4. In `MissionCard.handleComplete`, `setPendingUndo` appears **before**
   `await onToggle(id)` in source order and the handler has a `try`/`catch`.
   Test R1 passes.
5. In `TaskItem.handleDotTap`, `onCompleted?.(…)` appears **before** the `await`
   in source order and receives a third argument of type `Promise<void>`. Test R7
   passes.
6. Both `MissionCard` and `NowView` guard their post-settle `setPendingUndo`
   updaters with `p && p.id === id`; a named test completes A, then B inside the
   window, settles A, and asserts B's toast is still present **and still
   pending** (its countdown has not started).
7. Test R2 passes: with an unsettled write,
   `advanceTimersByTime(DISMISS_MS + 1000)` leaves `onDismiss` uncalled; after
   settle it fires at `DISMISS_MS` and not at `DISMISS_MS - 1`.
8. Test R6 passes: on rejection the toast is removed **and** the task row is
   present again; the run reports no unhandled rejection.
9. `rg -c 'AnimatePresence' src/components/home/MissionCard.tsx` returns **≥ 2**
   (import + usage), the `UndoToast` JSX at `:105-111` is nested inside it with
   `key="undo-toast"`, and `git diff` shows `src/components/UndoToast.tsx:47`
   (`exit`) **unchanged**.
10. Test R5 (in S64's `useTasksOptimistic.test.tsx`, amended test (e)) passes:
    two synchronous `toggleDone('a')` before settle → `done === false`
    **immediately** with `provider.toggleDone` still at **1×**; after settle
    **exactly 2×** and `done === false`. Three calls → **2×** and `done === true`.
    First-op rejection with the bit set → **1×** total, no follow-up, rejection
    still propagates.
11. **Negative criterion (out-of-scope detector):** `git diff --stat` lists
    **zero** changes in `src/App.tsx`, `src/components/home/HomeView.tsx`,
    `src/components/tasks/TasksView.tsx`, `docs/DESIGN_LANGUAGE.md` and
    `docs/adr/`; `grep -rn "pendingIds" src/` returns nothing. Any hit is a
    **FAIL**, not a pass.
12. `VITE_VAULT_REPO_URL= npm run test`, `npm run build` and `pwa-e2e` green with
    **no new `pwa-e2e` case added**; the PR closes #182.

## Tests

Base for every "red" claim is **`master` + S64 + S68**. A test asserting "the row
vanishes immediately" is **green on that base** (S64 did it) — every red below is
about the *toast*. Run as `VITE_VAULT_REPO_URL= npm run test`.

| # | Assertion | Red on base because | Cannot pass for the wrong reason because |
|---|---|---|---|
| **R1** | Sync-act click on the mission dot with a never-resolving `onToggle`: assert `d.isSettled() === false` **first**, then `getByTestId('undo-toast')` present *(the issue's asked-for test)* | `MissionCard.tsx:75-76` awaits before `setPendingUndo` — no toast exists | `isSettled()===false` rules out an already-resolved mock; **sync** `act` (never `await act`) rules out microtask drainage letting the base reach its `setPendingUndo` (`slice-S64:202-207`) |
| **R2** | **Load-bearing red.** Pending deferred → `advanceTimersByTime(DISMISS_MS + 1000)` → still present; resolve → present at `DISMISS_MS - 1`, gone at `+2` | two independent ways: (a) no toast pre-settle at all; (b) even with R1's fix alone, the mount timer at `:26-29` fires before settle | the post-settle present→absent pair proves a timer still exists; a "gate that never opens" implementation passes half and fails the other half |
| **R3** | `expect(DISMISS_MS).toBe(8000)` | it is `3000` (`UndoToast.tsx:5`) | literal tripwire, nothing to game |
| **R4** | `pending={false}`, advance `DISMISS_MS/2`, re-render with a **new** `onDismiss` identity, advance `DISMISS_MS/2 + 1` → dismissed exactly once, at the **original** deadline, via the **new** callback | `[onDismiss]` at `:29` clears and reschedules, so nothing has fired | asserting *which* callback fired proves the ref is live rather than the effect merely deleted |
| **R5** | the latch — see DoD #10; lives in S64's `useTasksOptimistic.test.tsx` as amended test (e) | S64-as-originally-written leaves `done === true` and the provider at 1× forever | the middle assertion (immediate `done === false` while the provider is still at 1×) discriminates a deferred inversion from both a dropped no-op and an eager double-write |
| **R6** | Click (sync act) → toast present; `await act(async () => d.reject(...))` → toast **absent** AND the mission row **present** again | base: "toast present" fails first. Under an R1-only partial fix the toast persists → the absence assertion fails | covers both the unfixed and the half-fixed shape |
| **R7** | `TaskItem` sync-act click with a pending `onToggle`: `onCompleted` already called with `(id, title, expect.any(Promise))` while `isSettled() === false` | `TaskItem.tsx:59-64` awaits first | same `isSettled()` + sync-act discipline |
| **R8** | `MissionCard.tsx` contains `AnimatePresence` (import + usage, ≥ 2 occurrences), file-read style of `syncProvider.test.ts:54` / `tokens.test.tsx:16` | zero occurrences | structural, exact |

**Harness rules — the likeliest source of a flaky or vacuous test here:**

1. **Sync `act(() => { fireEvent.click(dot) })` for every pre-settle assertion.**
   Never `await act(async () => …)`: it drains microtasks and lets a base-shaped
   implementation reach its post-await `setPendingUndo`. Use
   `await act(async () => d.resolve(x))` / `d.reject(e)` for settle only.
2. Every deferred exposes `isSettled()`; every pre-settle block **leads** with
   `expect(d.isSettled()).toBe(false)`.
3. **Never combine `vi.useFakeTimers()` with the now-`AnimatePresence`-wrapped
   `MissionCard`** — the pill lingers for the exit spring, which is rAF-driven
   and will not advance under fake timers (hung or vacuously-green assertion).
   So: **R2/R3/R4 render `<UndoToast>` directly** (no presence ancestor) and
   assert on `onDismiss` call counts — the shape `tapDotComplete.test.tsx:148-179`
   already proves works under fake timers. **R1/R6/R7 use real timers** (none of
   them depends on `DISMISS_MS`); use `waitForElementToBeRemoved` for R6.
4. One-line motion guard, per the wave-14 triage ruling:
   `expect(window.matchMedia).toBeUndefined()` in the new file, documenting that
   jsdom makes `useReducedMotion()` return `false` so the `exit` at `:47` is live.
   (`test.use({ reducedMotion })` is silently ignored in Playwright 1.61 — use
   `browser.newContext()` or `page.emulateMedia()` if an e2e is ever added.)

**Existing `tapDotComplete.test.tsx` — why the changes are not a weakened gate:**
`:148-164` and `:166-179` keep the identical asserted property (a timer exists;
it fires at the deadline and not before) — only the magic numbers move into an
import, and **R3 re-pins the literal** in a dedicated assertion. `:74-75` gains a
third matcher, which is strictly stronger. `:55-76` otherwise stays: it uses
`mockResolvedValue(undefined)` (`:56`) so it cannot distinguish before-await from
after-await, stays green after the fix, and is therefore **not** the regression
test — R7 is. Do not rewrite a green test; add the discriminating one beside it.
`:199-213` (unmount cleanup) and `:103-120` (#120 ring-pulse cleanup) are
unchanged. **No assertion is deleted or loosened anywhere.**

## Design refs

`docs/DESIGN_LANGUAGE.md` — no new tokens, no pending state; the toast markup
(`UndoToast.tsx:36-66`) is unchanged. **ADR-0015** (S63's shell presence
protocol) is the reference for DoD #9: its rule is about the **shell** — no
`AnimatePresence` in `App.tsx`, because a `mode="wait"` root makes correctness a
function of arbitrary child internals (`slice-S63:60-64`) — not "no
`AnimatePresence` anywhere". The block added here is default `mode="sync"` with
exactly one conditional child and no `layout` descendants, so per ADR-0015's own
blast-radius table the worst case is a ghost pill, never a blackout. **Cite
ADR-0015; do not amend it** (ADR immutability — supersede, never edit). If
ADR-0015 has not merged at implementation time, cite
`docs/slices/slice-S63-nav-exit-trap.md:111-115`.

## Dispatch

`/afk-pipeline auto` with this file. Model: **Sonnet**.

**Sequencing: S64 → S68 → S72; S72 is last in both the `useTasks.ts` and
`UndoToast.tsx` lanes and rebases on S68's head.** Ownership against S68:

| Concern | Owner |
|---|---|
| Removing the now-false "completed" affordance when the write rejects | **S72** |
| Adding any true failure message / label / retry | **S68** |
| `console.error` on write failure | S64 (already) |
| The `catch` at `MissionCard.handleComplete` and `TaskItem.handleDotTap` | **S72** — S68 must not nest a second one there |
| The deferred-inversion latch in `useTasks` | **S64** (amended DoD #7, owner-sanctioned 2026-08-03) — S72 does not touch `useTasks.ts` |

S72's catch does exactly two things: retract that id's toast, and swallow. No
message, no logging, no state — S68 hangs its surface off the hook, not off these
handlers. If a catch already exists at those sites after the rebase, add the
retraction **inside** it; do not nest.

**Why retraction is not cosmetic:** S64 rolls the row back into the list, so a
surviving toast would read `"X" completed` next to X sitting undone — and its
Undo button would then invert a state that never happened, i.e. tapping it would
**complete** the task. S64's rollback `setTasks` runs inside `toggleDone`'s catch
before the rethrow and the component's catch runs in the same microtask
continuation, so React 18 batches both into one commit: row back and toast gone
together. Assert the end state, never render counts.

**Blast radius** — `useTasks.toggleDone` is the app's single toggle path (mission
dot, TaskItem dot in all three NowView sections, both undo re-issues). Ranked
wrong-ship outcomes: (1) silent data divergence if an inversion is applied to the
wrong id or written twice — which is why the latch is a `Set<string>` keyed by id
and **never a counter**, and why R5 asserts exact call counts *and* final `done`;
(2) a toast that sticks forever on every completion if `pending` is never cleared
on some path (a mismatched `p.id === id` guard); (3) Undo hitting the wrong task
via a stale `pendingUndo.id` closure; (4) a drain-call provider write after
unmount.

**Forbidden over-builds (reject in review):** a generic toast / notification /
snackbar system, `<ToastHost>`, a toast queue, a portal singleton — two call
sites, and it collides head-on with S68's failure surface (different message,
different lifetime) · an undo stack, multi-level undo, or undo history · a
`useUndo` / `usePendingUndo` shared hook (two consumers, ~8 lines each,
structurally similar but not identical — extracting now bakes in the wrong seam)
· a per-task `idle | pending | error` enum or any `pendingIds`-driven pending
visual on the dot · a watchdog / max-lifetime cap on the toast or an
`onExitComplete` timeout (`slice-S63:219-220`) · making `DISMISS_MS`
configurable (settings UI, prop-drilled, localStorage) · a retry button,
retry-on-failure, or an outbox on the toast (`slice-S64:313-315` — the transport
already **is** the outbox) · persisting `pendingUndo` across unmount, tab switch
or reload · **any hunk in `src/App.tsx`, `HomeView.tsx`, `tasks/TasksView.tsx`,
`docs/DESIGN_LANGUAGE.md` or `docs/adr/*` — automatic reject** · a repo-wide
framer-motion exit audit or a generic orphaned-exit lint rule
(`slice-S63:222-227`) · merging the two `UndoToast` mount points into one owner.

Target size: ~60 lines across four source files plus the tests.
