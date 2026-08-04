# S68 — Surface capture write-failures instead of diverging silently (closes #178)

Post-v2 · Wave 14 · Deps: S64 (#174) — rebase on its head, not on `master` · Blocks: S72 (#182)

Source: GitHub issue **#178**. Read it before starting. Reliability bug: a
write that fails is indistinguishable from a write that succeeded, so the app
can disagree with its own storage and say nothing.

## Context

Live on the deployed build: a captured task was committed to the vault
(`add task: ZZTEST delete me`, `added Life Admin/QA.md`) and never appeared in
the app — not on Home, not on Tasks, not after a reload, with no error and no
retry affordance. The issue names the mechanism: `addTask` did
`await provider.add(...)` then `await refresh()`, and `refresh()`
(`useTasks.ts:35-39`) has no catch, so a `provider.list()` rejection propagated
unhandled after a successful write.

**S64 deletes that mechanism** (no `refresh()` on any write path). What S64
does **not** delete is the *class* the issue is titled after. Two defects
survive onto S68's base:

1. **A rejected `provider.add` is still 100% silent.** `useTasks.addTask`
   (`useTasks.ts:59-67`) propagates → `HomeView.handleAdd`
   (`HomeView.tsx:147-150`) propagates → `CaptureSheet.commit`
   (`CaptureSheet.tsx:54-60`) is `try`/`finally` with **no catch**: `busy` flips
   back to `false`, the button reads "Add Task" again, and the rejection becomes
   an unhandled promise. From the user's seat this is exactly the #178 report.
2. **`refresh()` still has no catch**, and after S64 it has exactly one caller —
   the seed effect at `App.tsx:67-71`
   (`seedIfEmpty(provider).then(count => { if (count > 0) refresh() })`). If
   seeding imported tasks and the follow-up read rejects, a first-run user sees
   an empty list while the vault holds N tasks: the same divergence, plus an
   unhandled rejection.

The fix is deliberately small and stays out of two hotspot lanes: the failure
message is rendered by the component that owns the interaction
(`CaptureSheet`), and the `refresh()` rejection is fixed by tightening the
**callee's** contract inside `useTasks`, which repairs the uncaught rejection at
`App.tsx:67-71` **without editing `App.tsx`** (S68 is not in the
`S63 → S70 → S71 → S73 → S67a` lane).

**Retry safety was verified, not assumed** (this is what licenses "just press
Add again" as the retry affordance). `GitTransport.writeFile`
(`transport.ts:341-377`) is ordered mkdir → `pfs.writeFile` → `git.add` →
`git.commit` → `git.push` inside `try/catch` (`:372-376`, push failure swallowed
by design, `:333-339`). Nothing after the commit can throw, and `VaultSync.add`
mutates `lastFiles`/`snapshot` only after `writeFile` resolves
(`VaultSync.ts:239-247`). So **`add` rejecting ⇒ no commit, no cache mutation**.
One residual: if `git.add`/`git.commit` throws *after* `pfs.writeFile` succeeded,
an uncommitted line sits in the LightningFS working tree and `_readFiles`
(`transport.ts:178-301`) reads the working tree, so it can surface as a phantom
task. A retry to the **same** domain/project self-heals — `add` rebuilds file
content from the stale `lastFiles` entry (`VaultSync.ts:226-227`) and overwrites
the whole file (`:236`), so the orphan line is clobbered and exactly one task
results. Only a retry that *changes* `#domain` or `/project` writes a different
path and leaves the orphan behind. That is a documented residual with a
characterization test, **not** a reason to build dedup machinery.

### Non-goals — do not implement, do not test for

- **Optimistic add / temp-id / reconcile.** It is latency work (#174/S64's
  charter, deliberately deferred at `slice-S64:47-51`), and it would manufacture
  a *new* silent-divergence class inside the ticket that exists to kill one: a
  temp-id task is unknown to the provider, so `toggleDone`/`deleteTask` on it
  throw `Task ${id} not found` (`VaultSync.ts:346`, `:391`), which under S64
  rolls the row back with only a `console.error` — the user's tap does nothing,
  silently. The honest in-flight affordance also already exists on this path:
  `CaptureSheet.tsx:169` renders `Adding…` and `:101`/`:165` disable the input
  and button. If add latency later measures as painful, file it.
- **Any retry, retry queue, or offline outbox.** `transport.ts:333-339` states
  the local commit is authoritative and push is retried on the next mutation —
  **the transport already is the outbox** — and an automatic retry is exactly
  the "user believes it succeeded" lie the issue is about (it is also not
  provably safe: see the changed-path residual above).
- **`setError(null)`, a clearable `error`, or a fatal-vs-transient split.**
  `error` is documented as initial-load-only (`useTasks.ts:8-9`) and gates a
  full-screen card that replaces the whole app (`App.tsx:87-110`) whose only
  exits are `window.location.reload()` and `clearVaultPat()`. Splitting it is a
  change to the shell's rendering gate, and the shell lives in `App.tsx` — the
  forbidden lane. **S64 DoD #10 is inherited verbatim, unamended.**
- **Any toggle/delete failure surface, and any edit to `UndoToast.tsx`,
  `TaskItem.tsx`, `MissionCard.tsx`, `NowView.tsx`.** After S64 a failed toggle
  is *unlabelled*, not *lying* — the row snaps back, so the UI matches the
  vault. #178 is a divergence bug; unlabelled-but-correct is not its business.
  The whole toast surface is **S72's** (see Sequencing — this supersedes the
  wave-14 `UndoToast.tsx: S68 → S72` lane, which becomes **S72 only**).

### Owner decisions (recommendation stated; confirm at dispatch)

1. **Error copy. RECOMMENDED:** headline `Couldn't save this task` plus the raw
   `message` in dim, truncated — mirroring the fatal card's two-line shape
   (`App.tsx:89-90`). The raw message is what made #178 diagnosable from the
   deployed build; hiding it costs that. Wording only is the owner's call.
2. **A failed capture keeps the sheet open. RECOMMENDED: yes** — it is already
   the behaviour (`HomeView.tsx:147-150` throws before `setAddOpen(false)`), it
   preserves the parsed input, and it requires no code. Just do not break it.
3. **Retry affordance = the existing Add button, not a new "Try again".
   RECOMMENDED: accept.** `finally` (`CaptureSheet.tsx:58-60`) re-enables it and
   it already reads "Add Task"; a second button doing the same thing is chrome.
4. **File one follow-up issue for the `App.tsx` lane** covering (a) the
   first-run empty-list residual when a post-seed `refresh()` fails, and (b) the
   still-uncaught `seedIfEmpty(...)` rejection at `App.tsx:68`, which S68 cannot
   reach without entering the lane. Not filed by this ticket.
5. **`pendingIds`:** S68 does **not** claim it. Per S72's design it has no
   consumer, so S64 drops it (already amended in `slice-S64`).

## Write-set

Exactly five files. No new modules, no new dependencies, no new tokens, **no
`App.tsx`**.

- MODIFY `src/hooks/useTasks.ts` (~6 lines) — wrap the body of `refresh`
  (`:35-39`; post-S64 the staleness-guarded version) in `try`/`catch`. The catch
  logs `console.error('[LifeOS] task refresh failed:', e)` and returns; it does
  **not** rethrow, does **not** touch `tasks`, does **not** touch `error`.
  Update the `refresh` JSDoc in `UseTasksResult` (`:10`) to state the contract:
  *"Never rejects. On failure the last-known list is retained and the reason is
  logged."* **No other change** — `addTask` (`:59-67`) keeps propagating.
- MODIFY `src/components/CaptureSheet.tsx` (~15 lines) —
  `const [err, setErr] = useState<string | null>(null)`; in `commit` (`:48-61`)
  call `setErr(null)` before `setBusy(true)` and add
  `catch (e) { setErr(e instanceof Error ? e.message : String(e)) }` between
  `try` and `finally`; clear `err` in the input's `onChange` (`:92`); render a
  `data-testid="capture-error"` `role="alert"` block between the preview and the
  Add button (`:159-161`) using existing colour utilities (`bad` /
  `tailwind.config.js:30` `#f87171`, or `dim`). **The catch must not call
  `setText`.**
- ADD `src/test/captureWriteFailure.test.tsx` — tests (A), (B), (C).
- ADD `src/test/useTasksRefreshCatch.test.tsx` — tests (D), (E). New file rather
  than appending to `useTasksUnmount.test.tsx`: S64 adds
  `useTasksOptimistic.test.tsx` in the same directory, so a third sibling keeps
  the rebase trivial.
- ADD `src/test/vaultSyncAddRetry.test.ts` — test (F), the retry-safety
  characterization. Test-only; `VaultSync` accepts an injected transport
  (`VaultSync.ts:86-89`), so it touches no source.

## Subtasks

1. Rebase onto S64's head. Confirm `refresh` already carries S64's staleness
   guard before wrapping it.
2. Add the `refresh` catch + the never-rejects JSDoc contract.
3. Add `err` state, the `catch` arm, the `onChange` clear, and the alert block
   to `CaptureSheet`.
4. Write (A)(B)(C); confirm each is red on the S64 head for the stated reason.
5. Write (D); confirm red. Write (E) and (F) and label them explicitly as
   regression/characterization guards, **green on base by design**.
6. Grep the diff against every negative DoD item before opening the PR.

## Definition of Done

1. `grep -n "catch" src/hooks/useTasks.ts` shows exactly **two** catch sites:
   the initial-load effect (`:49-56`) and the new one inside `refresh`. The
   `refresh` catch calls `console.error` and does **not** rethrow.
2. `await result.current.refresh()` **resolves** when `provider.list()` rejects
   — test (D). `refresh`'s JSDoc states "never rejects" as a contract.
3. `grep -c "setError" src/hooks/useTasks.ts` returns the **same count as
   `master` and as the S64 head** (S64 DoD #10 inherited, unamended), and
   `grep -rn "setError(null)" src/` returns nothing.
4. `src/App.tsx` is **absent from the diff** (hotspot-lane compliance), as are
   `src/vault/transport.ts`, `src/sync/VaultSync.ts`, `src/sync/selfLoadTasks.ts`
   and `src/components/cockpit/VitalsRow.tsx`.
5. `src/components/UndoToast.tsx`, `src/components/TaskItem.tsx`,
   `src/components/home/MissionCard.tsx` and `src/components/NowView.tsx` are
   **absent from the diff** (S72 boundary). A change to any of them is a
   **FAIL**, not a pass.
6. `useTasks.addTask` still **rejects** when `provider.add` rejects — no
   `try`/`catch` inside `addTask` (`:59-67`) anywhere in the diff; proven by
   test (E). Verify by reading the diff, not only by trusting the test.
7. `CaptureSheet.commit` has a `catch` arm and that arm does **not** call
   `setText`; `grep -n "setText('')" src/components/CaptureSheet.tsx` still shows
   exactly one occurrence, on the post-`await` success path.
8. A rejected `onAdd` renders an element with `data-testid="capture-error"` and
   `role="alert"` whose text contains the rejection's own `message` — tests
   (A)/(B).
9. After a failed add the typed text is still in the input and the Add button is
   enabled — asserted inside test (A).
10. The error clears when the user edits the input **and** on a subsequent
    successful add — test (C).
11. `grep -rn "writeError\|lastError\|useToast\|ToastProvider\|ErrorBoundary\|status:" src/hooks/useTasks.ts src/components/CaptureSheet.tsx`
    returns nothing (no dead error channel, no toast framework, no status enum),
    and no `setTimeout`-based retry appears in the diff.
12. No new key in `tailwind.config.js` or `docs/DESIGN_LANGUAGE.md`; the diff
    adds no colour literal not already present in the repo.
13. Test (F) proves that when `transport.writeFile` rejects and the caller
    retries `add` with the same domain/project, the resulting file content
    contains **exactly one** task line.
14. The diff touches exactly the five files listed in Write-set;
    `VITE_VAULT_REPO_URL= npm run test` and `npm run build` green incl.
    `pwa-e2e`; the PR closes #178. Target size ≤ 25 source lines across two
    files.

## Tests

Base for every "red" claim is **`master` + S64**, not plain `master`. On plain
`master` an `onAdd` rejection can originate from `provider.add` *or* from
`refresh()` (`useTasks.ts:64`); only after S64 is `provider.add` the sole
source, so state the base explicitly in the PR. Run everything as
`VITE_VAULT_REPO_URL= npm run test` (a local `.env` otherwise produces 3 phantom
reds).

**(A) Capture failure is visible — the red-first check.** Render
`CaptureSheet` with
`onAdd = vi.fn().mockRejectedValue(new Error('vault pull failed and local commits are unpushed; refusing to wipe'))`,
type a title, click Add, settle. Assert `getByTestId('capture-error')` is
present, **and in the same test** that the input still holds the typed text,
that the Add button is enabled again, and that `onAdd` was called exactly once.
*Red on base:* `CaptureSheet.tsx:54-60` has no catch, so no such element exists.
*Cannot pass for the wrong reason:* the text-retained and button-re-enabled
assertions **pass on base** (`:57` never runs, `:58-60` clears `busy`), which
mechanically proves the failure path was driven and that the only new fact is
the message; the call-count assertion kills a "passes because nothing was
submitted" reading.

**(B) The message is the failure's own, and only appears on failure.** Assert
the rendered text contains the rejection's `message` (not fixed copy), and — with
a **resolving** `onAdd` — that `queryByTestId('capture-error')` is null and the
input is cleared. *Red on base:* the first half. *Anti-vacuity:* asserting the
dynamic string defeats an unconditionally-rendered banner; the negative half
carries no red and exists solely to block one.

**(C) The message clears.** Fail once (assert present), then edit the input
(assert absent), then make `onAdd` resolve, click Add, settle (assert absent and
text cleared). *Red on base:* the "present after failure" step only — state in
the ticket that the "absent" steps are vacuously true on base (#120 lesson).

**(D) `refresh()` never rejects.** `renderHook(useTasks)` with a fake provider;
after the mount settles, `provider.list.mockRejectedValueOnce(new Error('vault pull failed…'))`,
then `await expect(result.current.refresh()).resolves.toBeUndefined()`. Also
assert `tasks` is unchanged (length **and** `done` flags), `error === null`, and
that a `console.error` spy was called once with a string containing `refresh`.
*Red on base:* the post-S64 `refresh` body still propagates. *Cannot pass for the
wrong reason:* the unchanged-state assertions pass on base and therefore cannot
supply the red; the `console.error` spy kills an empty `catch {}`.
*Not expressible on plain `master`:* there a `list()` rejection also aborts every
write path, so "refresh fails but state survives" has no isolated form.

**(E) `addTask` still rejects — regression guard, GREEN on base by design.**
`provider.add.mockRejectedValueOnce(...)`,
`await expect(result.current.addTask({ title: 'x' })).rejects.toThrow()`, assert
`tasks` unchanged. Its job is to fail the moment anyone adds a catch inside
`addTask`. Label it as a guard in the test name.

**(F) Retry safety — characterization, GREEN on base by design.** With an
injected transport whose `writeFile` rejects once, call `add`, catch, then retry
`add` with the same domain/project; assert the resulting file content contains
**exactly one** task line. Documents the Q4 invariant so a future dedup "fix"
must justify itself.

Do **not** add a "capture succeeds → task appears" end-to-end test: green on
base and already S64's DoD #2.

**The single worst way to ship this wrong** (make it a review checklist item):
catching the rejection **inside `useTasks.addTask`**. `addTask` would then
resolve on failure → `HomeView.handleAdd` (`:147-150`) reaches
`setAddOpen(false)` → the sheet closes and `CaptureSheet` unmounts → the user's
typed text is **destroyed** and they are told nothing. Strictly worse than #178.
Second-worst: a `catch` in `CaptureSheet.commit` that also calls `setText('')` —
same data loss, smaller radius.

## Design refs

`docs/DESIGN_LANGUAGE.md` — reuse existing colour utilities only (`:38` already
names `#fca5a5` as bad-text; `tailwind.config.js:30` has `bad` `#f87171`). No new
tokens, no pending/in-flight pattern (S64 declined to invent one, and this slice
does not need one — `Adding…` at `CaptureSheet.tsx:169` already exists).
Behaviour refs: `transport.ts:333-339` (local commit authoritative, push
best-effort — why no retry queue), `App.tsx:87-110` (why `error` is not reused).

## Dispatch

`/afk-pipeline auto` with this file. Model: **Sonnet**.

**Sequencing: S64 → S68 → S72.** S68 rebases onto **S64's head, not `master`** —
the `refresh` catch wraps S64's staleness-guarded body, and applying it to
`master`'s `refresh` produces both a conflict *and* a wrong result (it would
swallow the rejection on all four write paths, silently reintroducing #178's own
symptom). S68 requests **no amendment** to S64; DoD #10 is inherited verbatim.

Ownership line (supersedes S64's table where they overlap):

| Concern | Owner |
|---|---|
| Optimistic state, `commit`, refs, rollback, rethrow, staleness guard, `console.error` breadcrumbs | S64 |
| `refresh()` catch (fixes the uncaught rejection at `App.tsx:67-71` without editing it) | **S68** |
| Capture-path user-visible write-failure surface (`CaptureSheet.tsx`) | **S68** |
| `setError(null)` / clearable `error` / fatal-vs-transient split | **nobody** — declined; `error` stays initial-load-only |
| Optimistic add / temp id | **nobody** — declined; new issue if latency is measured |
| Duplicate-capture prevention in source | **nobody** — characterization test + documented residual instead |
| `UndoToast.tsx`, `MissionCard.tsx`, `TaskItem.handleDotTap`, `NowView.handleUndo`, the toggle/delete failure surface | **S72** (the `UndoToast.tsx` lane becomes S72-only) |
| `TaskItem` edit-save / delete uncaught rejections | **follow-up issue** — neither ticket |
| `seedIfEmpty` uncaught rejection + first-run empty-list residual | **follow-up issue** — `App.tsx` lane |

If S72's `catch` at `MissionCard.handleComplete` / `TaskItem.handleDotTap` is
what you were about to write: stop, it is not S68's.

**Forbidden over-builds (reject in review):** a retry queue or offline outbox ·
automatic retry of `provider.add` · a generic toast/notification system,
`ToastProvider`, `useToast` · a React error boundary (mechanically wrong —
boundaries do not catch rejected promises from event handlers) · a per-task or
per-op `idle | pending | error` enum · any `setError` outside the initial-load
effect · a hook-level `writeError`/`lastError`/`errors[]` with no consumer in
this PR · optimistic add / temp id · edits to any file outside the five in
Write-set.
