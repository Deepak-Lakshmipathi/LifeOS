# S64 — Take the vault re-read off the write path and flip tasks optimistically (closes #174)

Post-v2 · Wave 14 · Deps: — (lands FIRST of the `useTasks.ts` pair) · Blocks: S68 (#178), S72 (#182)

Source: GitHub issue **#174**. Read it before starting. Correctness-adjacent
latency bug: the completion dot is visually dead for 1.1–9s, so users click
again and queue a second write.

## Context

Clicking the dot on a Today's Mission row produces **zero** DOM change at
+1.1s; the row is finally gone at ~9s. The contrasting case proves the
direction: the *veto* action in the same component (`MissionCard.tsx:64-70`,
`setVetoed`, pure local state) reflows instantly.

**The root cause is not only the missing optimistic `setState` — it is that a
redundant full vault re-read is serialized into the user-visible latency
path.** All four write paths in `src/hooks/useTasks.ts` share one shape:
`await provider.X(...)` then `await refresh()`. The two awaits map exactly
onto the two measured numbers:

- `transport.ts:341-377` `writeFile` = local FS write + `git.add` + `git.commit`,
  then a **best-effort push whose failure is swallowed** (`:370-376`) ≈ the 1.1s.
- `refresh()` → `provider.list()` → `readFiles()` (`transport.ts:178-223`) =
  a network `git.pull`, possibly a push + commits-ahead count + wipe-and-reclone,
  then a recursive read and reparse of every vault file ≈ the remaining ~8s.

That re-read buys nothing. `VaultSync` **is** the cache: every mutation updates
`snapshot` and `lastFiles` in place on success (`VaultSync.ts:239-247`,
`:334-335`, `:379-380`, `:414-415`) and **returns the persisted `Task`**
(`SyncProvider.ts:17,34,43`) — a return value `useTasks` currently discards on
all four paths. So the fix is: drop `await refresh()` everywhere, apply the
provider's return value, and additionally pre-apply optimistically on the two
ops whose semantics the hook can mirror byte-for-byte.

Three findings that shape the design (all verified against `master`):

1. **`deleteTask` (`:89-95`) is a fourth write path.** Issue #174 says "three".
   It shares the bug shape exactly and is in scope.
2. **`VaultSync.list()` (`:134-190`) is NOT enqueued** — only mutations go
   through the FIFO queue (`enqueue`, `:116-121`). A `list()` and a write can
   therefore be in flight simultaneously and settle in either order. The
   stale-list clobber is reachable on `master` today via `App.tsx:67-71`
   (`seedIfEmpty(...).then(count => { if (count > 0) refresh() })`), and
   optimistic state widens the window because the user can now click at t≈0.
   A staleness guard is required; the FIFO queue is not sufficient.
3. **`VaultSync.add()` mints the id itself** (`crypto.randomUUID()`, `:207`),
   so an optimistic add has no real id at click time. That is a different state
   machine (temp-id remapping + what happens if the user toggles/deletes a
   temp-id task first — the provider would throw `Task ${id} not found`,
   `VaultSync.ts:346`). Deferred out of this slice — and **S68 has since
   declined it too** (`slice-S68` Non-goals): it would manufacture a new silent
   divergence inside the ticket that exists to kill one. File it as its own
   issue if add latency ever measures as painful.

**Side effect worth stating: this already kills #178's stated root cause.**
#178 is "`addTask` succeeds, `refresh()` rejects unhandled, task never
appears". After this slice `addTask` no longer calls `refresh()`, so there is
no rejection to swallow. Concretely, `transport.ts:213` throws
`'vault pull failed and local commits are unpushed; refusing to wipe'` — a
rejection that by construction occurs **only after** a local commit landed, and
on `master` it makes a *successful* write reject. S68 shrinks accordingly.

### Non-goals — do not implement, do not test for

- **The DAY REVIEW / Completion vital counters and the Aurora warmth tint.**
  #174 lists them as a symptom, but those surfaces do not read `useTasks` —
  they read `src/sync/selfLoadTasks.ts:33-40`, a module-level memoized promise
  (`inFlight ??= provider.list()`) with **no production invalidation path**
  (`__resetSelfLoadTasksCache` at `:49-51` is marked test-only). They are stale
  until page reload **before and after this slice**, and no change inside
  `useTasks` can move them. The real fix is deleting the second reader
  (single-owner task list), which touches `App.tsx` — a declared hotspot — and
  needs its own slice. See "Owner decisions" below.
- **Any user-visible write-failure message, `setError(null)`, or catching
  `refresh()` rejections.** That is S68's channel (see Sequencing).
- **A pending/spinner/disabled affordance on the dot.** See Owner decisions.
- **Multi-device freshness.** Dropping `refresh()` from write paths means the
  list refreshes only at mount. `refresh()`'s only non-write caller is the
  one-shot seed effect (`App.tsx:67-71`); there is no focus/interval/visibility
  refresh anywhere, so the "writes pick up other devices' edits" behaviour was
  incidental, not designed. Accepted regression; if freshness is wanted it
  belongs in a deliberate refresh-on-visibility slice, not smuggled into the
  mutation path.

### Owner decisions (confirm before/at dispatch — do not silently re-decide)

1. **No in-flight affordance on the dot. RECOMMENDED: accept, on condition
   S68 lands in the same wave.** After the optimistic flip the UI already shows
   the expected final outcome; painting "pending" on top says "we don't know
   yet" while showing the answer. `DESIGN_LANGUAGE.md` has no pending token, so
   inventing one inside a bug-fix slice is a design decision made by whoever
   picks up the ticket. Failure feedback is the row **snapping back into the
   list** (the veto reflow in reverse) plus a `console.error`. That is
   unlabelled, not silent — and the labelled surface is S68's by design.
   Also: **do not set `disabled` on the dot during a write** —
   `MissionCard.tsx:156` already uses `disabled={!onComplete}` to mean "inert,
   no handler wired"; overloading it renders an in-flight dot as permanently
   inert. If the owner rejects this, the minimum honest affordance is a reuse
   of `UndoToast`'s pill shell (`UndoToast.tsx:36-66`) with "Couldn't save —
   try again" and no action button — but that is S68's design to own and doing
   it here guarantees a collision.
2. **Instant vanish on completion — no persist-through-undo grace period.
   RECOMMENDED: ship the instant vanish.** On the optimistic flip three things
   happen in one frame: `rankNow.ts:73` filters `!t.done` so the row vanishes,
   `missionPicks` backfills the next-ranked task, and `computeWarmth`
   (`:64-68`) re-tints because `completed_at` changed. With 1–3 picks this can
   read as "my row was replaced" rather than "my row completed". Ship it
   anyway: it is exactly the veto behaviour the owner called correct, the undo
   affordance is the toast rather than the row, and a "completed but still
   displayed" third UI state would foreclose S72's undo-window design. If it
   feels wrong live, it belongs in S72 alongside `DISMISS_MS`.
3. **DoD #7 = deferred-inversion latch. OWNER SANCTIONED 2026-08-03.** The
   original "second `toggleDone(id)` is a silent no-op" wording is superseded;
   `owedRef` + the amended tests (e)/(e2)/(e3) are the contract to implement.
   `pendingIds` is dropped with it (DoD #12). Do not re-decide either at
   dispatch — merge from this amended ticket, never from its pre-amendment form.
4. **A follow-up issue should be filed for the `selfLoadTasks` stale reader**
   (non-goal above). Suggested title: *"VitalsRow/Aurora read a permanently-
   memoized task list, so Completion + warmth never update after a write."*
   Not filed by this ticket. Insert its number into the negative DoD item
   (#11) if it exists at dispatch time.

## Write-set

- MODIFY `src/hooks/useTasks.ts` — the entire fix; **no other source file changes.**
  - ADD four refs: `tasksRef` (mirrors `tasks` synchronously so two writes in
    the same tick both read fresh state), `localVersionRef` (bumped by every
    *local* task mutation — optimistic apply, reconcile, rollback — never by a
    server list commit), `inFlightRef: Set<string>` (invariant: at most one
    un-settled op per id), and `owedRef: Set<string>` — the
    **deferred-inversion latch** (DoD #7): one bit per id, never a list of
    operations. It is **not** a second mutation queue and does not duplicate
    `VaultSync.enqueue`'s FIFO.
  - ADD one internal helper `commit(fn, local)` — the single mutation point for
    `tasks`; keeps `tasksRef` in lockstep, bumps `localVersionRef` when
    `local`, calls `setTasks`. Plus `replaceById(id, next | null)`. Never
    called during render (StrictMode-safe).
  - `toggleDone` (`:77-87`) — in-flight guard (**deferred inversion**, DoD #7:
    apply the flip synchronously, toggle the `owedRef` bit, return without
    calling the provider) → optimistic apply mirroring
    `VaultSync.ts:351-357` **exactly** (including `completed_at`, which
    `computeWarmth.ts:64-68` reads) → `await provider.toggleDone(id)` →
    reconcile with the returned `Task` → on throw, roll back that **one id** to
    its captured pre-click value, `console.error`, **rethrow** → `finally`
    clears the id. `navigator.vibrate(10)` stays post-await.
  - `deleteTask` (`:89-95`) — same shape; optimistic removal, and on failure
    re-insert the captured task and re-sort newest-first
    (`(a,b) => b.created_at - a.created_at`) to match `VaultSync.list():189`.
    Do not re-insert by index.
  - `addTask` (`:59-67`) / `updateTask` (`:69-75`) — replace `await refresh()`
    with applying the returned `Task` (append/replace + newest-first order).
    **No optimistic pre-apply on either.** For `updateTask` this is deliberate:
    an optimistic `{...before, ...patch}` is NOT equivalent to
    `VaultSync.update` — `SyncProvider.ts:24-33` specifies that
    empty/whitespace `done_when`/`project`/`domain` **unset** the field and
    `priority: undefined` **clears** it, so a naive spread would render
    `done_when: ''` and then visibly jump on reconcile. Replicating those rules
    in the hook duplicates provider semantics across the seam and will drift.
  - `refresh` (`:35-39`) — ADD the two-condition staleness guard: sample
    `localVersionRef.current` before `await provider.list()`; after it, discard
    the result if the version moved **or** `inFlightRef.current.size > 0`.
    Both conditions are required — a write applied *before* `list()` sampled
    the counter leaves the counter unchanged, so the version check alone still
    lets a pre-write server list commit. Commit with `local: false`.
    **Do not add a catch** — that is S68's.
  - **No `pendingIds` on `UseTasksResult`.** An earlier draft exposed it so S72
    could gate the Undo button; S72's design ruled that out — the undo re-issue
    is itself a `toggleDone(id)`, so a gate keyed on `pendingIds` would re-arm
    itself after the user already dismissed via Undo, and the real question
    ("has *this toast's* write settled") is per-toast, not per-id. The
    deferred-inversion latch below removes the hazard at its source. Do not add
    the field; it would be a public API with no consumer.
  - **`error` and `setError` are NOT touched.** `useTasks.ts:8-9` documents
    `error` as "set when the initial load failed" and `App.tsx` gates a
    full-screen error card on it; `setError(null)` exists nowhere in the
    codebase, so setting `error` from a failed toggle would replace the entire
    app with an unclearable error card until reload.
- ADD `src/test/useTasksOptimistic.test.tsx` — the tests below ((a)-(e), plus
  (e2)/(e3) from the amended DoD #7). Location
  matches convention: `src/test/useTasksUnmount.test.tsx` already holds the
  cross-cutting `useTasks` tests; `src/hooks/` holds only self-contained ones.

## Subtasks

1. Add `tasksRef` / `localVersionRef` / `inFlightRef` + `commit` + `replaceById`;
   route the initial-load effect's `setTasks` through `commit(..., false)`.
2. Rewrite `toggleDone`: guard → optimistic → reconcile → rollback → rethrow.
3. Rewrite `deleteTask` the same way (optimistic removal, re-insert + re-sort).
4. `addTask` / `updateTask`: drop `refresh()`, apply the returned `Task`.
5. Add the `refresh()` staleness guard. Do NOT add `pendingIds` (DoD #12).
6. Audit every `commit(...)` reachable after an `await` for the `mountedRef`
   guard (see DoD #8).
7. Write the tests; confirm each is red on `master` for the stated reason, and
   that (e)'s middle assertion is red against the earlier no-op design too.

## Definition of Done

1. `refresh()` is called from ZERO write paths: `grep -n "refresh()" src/hooks/useTasks.ts` shows no occurrence inside `addTask`, `updateTask`, `toggleDone`, or `deleteTask` (the `useCallback` dep arrays for those four no longer list `refresh`).
2. All four write paths apply the provider's return value to state; `provider.add`/`update`/`toggleDone` return values are no longer discarded (verifiable in the diff — each result is bound and passed to `commit`).
3. `toggleDone` applies its state change **synchronously before its first `await`** — proven by test (a) below, which asserts the new `done` value while the provider promise is still pending (`isSettled() === false`).
4. `deleteTask` removes the task synchronously before its first `await`, and on write failure re-inserts it in newest-first order — proven by tests.
5. A failed write rolls back **only the affected id**: test (b) asserts a concurrently-successful sibling task keeps its new `done: true` and `completed_at: 555` after the other task's write rejects.
6. `toggleDone` and `deleteTask` still **reject** on write failure (the rethrow is present in the diff) — S72 depends on this signal.
7. **Deferred inversion (amended 2026-08-03 by S72's design pass, OWNER SANCTIONED the same day — this replaces the earlier "silent no-op" wording).** A second `toggleDone(id)` for an id already in flight does **not** call the provider a second time while the first op is un-settled, does **not** throw, and **applies its optimistic flip synchronously before returning** (same contract as #3 — otherwise Undo is a dead click for the length of the settle window). It records a deferred inversion: a one-bit-per-id latch `owedRef: Set<string>`, where a further deferred call for the same id **clears** the bit rather than adding a second. On **successful** settle of the first op: if the bit is set, the hook **skips reconciling** the provider's returned `Task` (the row already shows the inverted state; reconciling would visibly bounce), clears the bit, and — after `inFlightRef.current.delete(id)`, and only while `mountedRef.current` — issues **exactly one** follow-up `provider.toggleDone(id)` **with no further optimistic apply**; if the bit is clear it reconciles normally. On **failed** settle: the bit is cleared and **no** follow-up is issued; the row rolls back to its captured pre-click value (which, for a completed-then-undone row, is already what the UI shows) and the rejection still propagates to the first caller. A follow-up call that itself fails rolls that id back to its pre-follow-up state and `console.error`s; it has no user-visible surface (S68's channel). **Invariant preserved: at most one un-settled provider op per id.** This is a latch, **not** a queue — one bit, never a list of operations. Proven by tests (e), (e2), (e3).
8. Every `commit(...)` call reachable after an `await` is preceded by `if (!mountedRef.current) return` (grep the diff; there are exactly five such call sites after this change, up from two). `inFlightRef.current.delete(id)` stays in `finally`, outside that guard. `src/test/useTasksUnmount.test.tsx` still passes unmodified.
9. `refresh()` discards a `list()` result when `localVersionRef` moved during the await **or** `inFlightRef` is non-empty — test (d) asserts a late-resolving mount `list()` carrying pre-toggle data does not revert a settled toggle.
10. `setError` is called in exactly one place (the initial-load effect) — unchanged from `master`; `setError(null)` still appears nowhere. `grep -c "setError" src/hooks/useTasks.ts` returns the same count as on `master`.
11. **Negative criterion (out-of-scope detector):** given a task completed via the mission dot, the DAY REVIEW Completion counter is expected **NOT** to change without a reload. `src/sync/selfLoadTasks.ts` and `src/components/cockpit/VitalsRow.tsx` are absent from the diff. A change here means out-of-scope work was done and is a **FAIL**, not a pass.
12. `UseTasksResult` exposes **no** `pendingIds` (or any other per-id status set): `grep -rn "pendingIds" src/` returns nothing. The deferred-inversion latch (#7) is internal to the hook and is not part of the public result type.
13. The diff touches exactly two files: `src/hooks/useTasks.ts` and the new `src/test/useTasksOptimistic.test.tsx`. No new modules, no new dependencies, no new design tokens, no call-site changes.
14. `npm run build` + `npm test` green incl. `pwa-e2e`; issue #174 closed by the PR.

## Tests

New file `src/test/useTasksOptimistic.test.tsx`. **Mock shape is load-bearing:**
a `deferred<T>()` helper exposing `promise` / `resolve` / `reject` /
`isSettled()`, with `toggleDone` returning a per-id pending promise and `list`
resolving `[A, B]` (two tasks, distinct `created_at` and `domain`).

**Anti-vacuity harness rule (the #120 lesson):** drive clicks with the
**synchronous** `act(() => { void result.current.toggleDone('a').catch(() => {}) })`,
never `await act(async () => ...)`. The sync form flushes the pre-await
optimistic `setState` and stops; the async form drains microtasks and would let
a `master`-shaped implementation reach its `setTasks`, making the test pass for
the wrong reason.

**(a) Optimistic visible before resolve — the red-first check.**
After the sync click, assert `tgl.get('a').isSettled() === false` **first**
(mechanical proof we are asserting pre-settle), then `tasks.find('a').done === true`
and `completed_at === expect.any(Number)`. Then resolve with
`completed_at: 999`, await reconcile, and assert `provider.list` was called
**once** (mount only) — this pins the "no re-read on the write path" decision.
*Fails on `master`:* `useTasks.ts:79` awaits a pending `provider.toggleDone`,
so `refresh()` at `:84` is never reached and `setTasks` never runs —
`done` is still `false`. The `toHaveBeenCalledTimes(1)` assertion fails
independently on `master` (it would be 2).
*Vacuity risk HIGH, both traps closed:* an already-resolved mock plus
`await act` would make `master` pass — killed by `isSettled()` + sync `act`;
asserting only after settle cannot distinguish optimistic from settle-apply —
killed by asserting before resolve.

**(b) Rollback on write failure — MUST include the control task.**
Toggle `a` **and** `b` optimistically; assert both `done === true`; then reject
`a` and resolve `b` with `completed_at: 555` in the same act; assert `a` is
back to `done: false` with `completed_at` undefined **and `b` is still
`done: true` / `completed_at: 555`**.
*Fails on `master`:* the pre-reject `done === true` assertions fail.
*Documented weakness:* on `master` this is red for the same reason as (a)
("the flip never happened"), and "nothing ever changed" would satisfy the final
`a.done === false`. **The control task is what makes it non-vacuous** — `b`'s
final state is reachable only if the optimistic + reconcile machinery genuinely
ran AND the rollback was scoped to `a` alone. It simultaneously pins the
"targeted inverse patch, never a whole-list restore" decision. **Do not ship
this test without the control task.**

**(c) A committed write survives a later `list()` rejection.**
Toggle `a` and settle it successfully. Then
`(provider.list as Mock).mockRejectedValueOnce(new Error('vault pull failed and local commits are unpushed; refusing to wipe'))`
and call `refresh().catch(() => {})`. Assert `a.done` is still `true`,
`tasks` still has length 2 (catches a blank-on-error implementation), and
`error` is still `null`.
*Fails on `master`:* step 1 cannot even be expressed there, since `toggleDone`
awaits `refresh()` internally — so state the `master` form as "`toggleDone`
makes the completion visible even when the subsequent `list()` rejects":
`refresh()` (`:35-39`) has no catch, the rejection propagates out of
`toggleDone`, `setTasks` never runs, `done` stays `false`. This is #178's
exact bug. *Vacuity risk LOW.*

**(d) Stale-list clobber guard.** Hold the mount `list()` deferred; toggle `a`
and settle it; *then* resolve the mount `list()` with the pre-toggle `[A, B]`.
Assert `a.done` is still `true`.
*Fails on `master`:* the late `setTasks(all)` at `:46` overwrites
unconditionally.

**(e) Deferred-inversion guard (amended — see DoD #7).** Two synchronous
`toggleDone('a')` calls before settle. Assert `provider.toggleDone` called
**exactly once**, neither call threw, and `tasks.find('a').done === false`
**immediately** (the deferred flip is visible pre-settle). **Then** resolve the
first op and assert `provider.toggleDone` called **exactly twice**, its second
argument was `'a'`, and `done === false`.
**(e2)** Three synchronous calls → after settle, `provider.toggleDone` called
**exactly twice** and `done === true`.
**(e3)** The first op **rejects** with the bit set → `provider.toggleDone` called
**exactly once** in total (no follow-up), `done === false`, and the rejection
still propagates to the first caller.
*Fails on `master`:* `master` calls the provider twice with no guard at all, so
(e)'s first `toHaveBeenCalledTimes(1)` fails. (This is the user-reported "click
again, queue a second write" behaviour.)
*Fails on the earlier no-op design:* `done` would stay `true` after the second
call and the provider would sit at 1× forever, so (e)'s middle and final
assertions both fail. **The middle assertion — immediate `done === false` while
the provider is still at 1× — is what discriminates a deferred inversion from
both a dropped no-op and an eager double-write. Do not ship (e) without it.**
Note the guard must `return`, not `throw` — `MissionCard.tsx:75` awaits
`onToggle` uncaught, so throwing would produce an unhandled rejection.

## Design refs

None — no visual change, no new tokens. `DESIGN_LANGUAGE.md` has no
pending/in-flight pattern, which is precisely why this slice does not invent
one (Owner decision 1). Behaviour references: `rankNow.ts:73` (`!t.done` filter
— why a completed row vanishes), `computeWarmth.ts:64-68` (why the optimistic
patch must set `completed_at`), `src/test/useTasksUnmount.test.tsx` (the #120
anti-vacuity precedent to follow).

## Dispatch

`/afk-pipeline auto` with this file. Model: **Sonnet**.

**Sequencing — S64 lands FIRST; S68 (#178) rebases onto it; S72 (#182) last.**
Both S64 and S68 edit `src/hooks/useTasks.ts` (declared wave-14 hotspot). S64
is the structural change (it rewrites all four write paths and introduces the
`commit` / version / in-flight primitives); error surfacing is purely additive
on top. The reverse order means S68 wraps four `await refresh()` calls in
try/catch and S64 then deletes all four — pure rework.

Ownership line, so the two do not double-implement:

| Concern | Owner |
|---|---|
| Optimistic state, `commit`, the three refs | **S64** |
| Rollback mechanics + the rethrow contract | **S64** |
| Removing `await refresh()` from all four write paths | **S64** |
| `refresh()` staleness guard; applying provider return values | **S64** |
| `console.error` breadcrumbs on write failure | **S64** |
| **Any** user-visible write-failure surface | **S68** |
| `setError(null)` / making `error` clearable; splitting fatal-load vs transient-write | **nobody** — S68 declined it; `error` stays initial-load-only |
| Catching `refresh()` rejections (which also fixes the uncaught one at `App.tsx:67-71` without editing `App.tsx`) | **S68** |
| Optimistic **add** (temp id + reconcile); duplicate-capture prevention | **nobody** — S68 declined both; file separately if add latency measures painful |
| The deferred-inversion latch (DoD #7) | **S64** — sanctioned by S72's design pass; S72 implements it only if the owner declines the amendment |
| Undo timing, `DISMISS_MS`, the toast `pending` gate, toast retraction on failure | **S72** |

**What S64 guarantees so S72 is not precluded:** (1) `toggleDone` applies the
flip synchronously before its first `await` — state this in the hook's JSDoc as
a **contract**, not an implementation detail, so S72 can move `setPendingUndo`
from after the await (`MissionCard.tsx:75-76`) to before it and get a genuine
0ms toast; (2) `toggleDone` still rejects on write failure, so S72 can decide
what happens to an already-shown toast; (3) **the undo-inside-the-window hazard
is resolved here, not handed to S72:** undo is a second `toggleDone(id)`
(`MissionCard.tsx:83`, `NowView.tsx:44-50`), and an earlier draft of this slice
dropped it silently via the in-flight guard. DoD #7's deferred-inversion latch
accepts the tap instead — the flip is visible immediately and the provider call
is issued once on settle — so S72 needs no Undo gate and `pendingIds` is not
exposed; (4) S64 adds no "completed but still shown" grace state.

**Forbidden over-builds (reject in review):** an offline outbox or retry queue
— `transport.ts:335-339` states the local commit is authoritative and push is
best-effort "retried on the next mutation or refresh (git's native queue — no
separate queue infra)", so **the transport already is the outbox**; a second
mutation queue in the hook — `VaultSync.enqueue` (`:116-121`) already
serializes FIFO, and a second queue would break the one-op-per-id invariant;
a generic optimistic middleware / reducer with an inverse-patch registry — a
framework for two call sites; a per-task `idle | pending | error` status enum —
invents tokens that do not exist and creates the third UI state that forecloses
S72; React Query / SWR — a second caching layer over the ADR-0002 provider
seam, i.e. the same two-owners mistake `selfLoadTasks` already made.

Target size: ~50 lines in one source file plus one test file.
