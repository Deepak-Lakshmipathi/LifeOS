# S66 — Single owner for the vault FS; stop wiping a store we don't hold the lock on (closes #176)

Post-v2 · Wave 14 · Deps: — (lands FIRST of the `transport.ts` pair) · Blocks: S67 (#177)

Source: GitHub issue **#176**. Read it before starting. The issue is filed as
console noise. **It is not.** It is a data-integrity bug whose exhaust happens
to be console noise — re-scope it before you start (Owner decision 1).

## Context

### What was observed live (2026-07-31 deployed Pages build)

`AbortError: Lock broken by another request with the 'steal' option.` floods the
console as **uncaught** rejections: **7 at a time** per vault-read cycle, ~28+
over a short session, plus one on the write path. They are not routed through
any `catch` or error boundary. They actively cost triage time — real errors were
drowned in the noise, **including the silent refresh failure that became #178**.

### Root cause #1 — eight independent owners of one process-global store

`FS_NAME = 'lifeos-vault'` (`transport.ts:68`) names one IndexedDB store and one
`navigator.locks` lock. **Eight** independent `GitTransport` instances each
construct their own `LightningFS` over it (verified by grep):

| Site | Kind |
|---|---|
| `src/App.tsx:22` → `VaultSync.ts:88` | module-level `VaultSync` singleton |
| `src/sync/selfLoadTasks.ts:31` → `VaultSync.ts:88` | module-level `VaultSync` singleton |
| `AttentionCard.tsx:80` · `FleetStrip.tsx:66` · `HabitsCard.tsx:124` · `HomeView.tsx:130` · `TodayCard.tsx:92` | 5 per-card read defaults |
| `HabitsCard.tsx:156` (`appendHabitHit(transport ?? new GitTransport(), hit)`) | **write** path, a fresh instance **per habit tap** |

Seven on the read path, one on the write path — exactly matching "7 at a time,
plus one on the write path" observed live.

`GitTransport.inflight` (`transport.ts:94,171-175`) is the correct guard at the
**wrong scope**. Its own comment already states the problem — *"without this,
both run a git clone into the same lightning-fs dir concurrently, race, and
reject, hanging the app"* — but the guard is per-**instance** while the resource
is per-**process**. **S66 is not introducing single ownership; it is finishing
the idea already in the file.**

### Root cause #2 — the wipe runs before the mutex is acquired

Verified against `@isomorphic-git/lightning-fs@4.6.2` source in `node_modules/`:

1. `transport.ts:217` does `this.fs = new LightningFS(FS_NAME, { wipe: true })`.
2. `PromisifiedFS._init` (`PromisifiedFS.js:94-98`) calls `this.stat('/')`
   **unawaited** in the constructor — the wipe fires fire-and-forget at
   **construction** time, not at first awaited use.
3. `DefaultBackend.activate()` (`DefaultBackend.js:40-48`):
   ```js
   if (this._needsWipe) { this._needsWipe = false; await this._idb.wipe(); await this._mutex.release({force:true}) }
   if (!(await this._mutex.has())) await this._mutex.wait()
   ```
   **The wipe destroys the store before the mutex is ever acquired.** The wiping
   instance never holds the lock. `_idb.wipe()` is `idb.clear(store)` — it
   deletes every file blob **and** the `!root` superblock key.
4. `Mutex2.release({force:true})` (`Mutex2.js:41-48`): a fresh instance's
   `_release` is `null`, so it takes
   `navigator.locks.request(name, {steal:true}, …)`. Per the Web Locks spec a
   steal breaks every held lock of that name and rejects the victims'
   `request()` promises with this exact `AbortError`.
5. On any pull failure **all eight instances independently reach `needsClone` in
   the same tick and each wipes.** This is the *normal* behaviour on pull
   failure, not a narrow race window.

### Why the existing try/catch chain cannot contain it

In `Mutex2.wait()` (`Mutex2.js:31`) and `Mutex2.acquire()` (`:14`), the promise
returned by `navigator.locks.request(...)` is **discarded — never assigned,
never awaited, never `.catch()`ed**. The outer promise already settled via the
inner `resolve(!!lock)`. The rejecting promise is created inside the dependency
and never enters our awaited chain. **No `try`/`catch` in `_readFiles()` can
ever reach it**; only a global `unhandledrejection` listener could observe it.
That is why the issue's `try`/`catch` observation is correct but its suggested
fix is the wrong lever.

### Root cause #3 — this corrupts the store (the severity question, answered)

The architect confirmed the full chain step by step against 4.6.2 source.
**Yes — a stolen lock / concurrent wipe leaves the backing store corrupt.**

- The mutex is **advisory**, checked only in `activate()`.
  `PromisifiedFS._wrap` (`:108-128`) calls `_activate()`, which short-circuits
  once `_activationPromise` is set. **No per-operation mutex check exists** — a
  victim keeps reading *and writing* IDB indefinitely after its lock is stolen.
- The **debounced** `saveSuperblock()` (`_wrap` finally → `flush()` →
  `_saveSuperblock()`) has **no mutex check**, only `if (this._cache.activated)`.
  (`deactivate()` *does* check `await this._mutex.has()` — so the unguarded
  flush is specifically the 500ms-debounced one.) A victim therefore flushes its
  **stale in-memory tree** over `!root` after another instance wiped the store.
  **This is what makes the corruption durable across page reloads.**
- `CacheFS.autoinc()` = `_maxInode(root) + 1` computed from that instance's own
  stale tree, so two instances allocate the **same ino** for different files;
  `idb.set(ino, data)` then makes one file's bytes overwrite another's. **This
  is worse than a missing file — it is silently wrong content served under
  another path.** For `.git/objects/*` that means a corrupt object store, which
  is self-sustaining: corrupt `.git` → `pull` throws → `needsClone` → wipe →
  repeat. That is the 28-errors-in-one-session arithmetic, and the mechanism
  behind #177's permanent staleness.

**How a ghost file reaches our code without throwing:**
`IdbBackend.readFile` is `idb.get(ino, store)`, which **resolves `undefined`**
for a missing key — it does not reject. So in `DefaultBackend.readFile`
(`:100-127`) the `catch` is never entered, `_http` is undefined (we never pass
`url`), and `if (!stat) throw ENOENT` is skipped because `stat` is truthy from
the cached tree. It **returns `undefined` without throwing**. Then
`transport.ts:287-288` does `result.push({ path: relPath, content })` with
`content === undefined` — and the `catch` at `:289` never fires because nothing
threw. **The `as string` cast on `:287` is what launders `undefined` past the
type system**; the code actively asserts the lie.

Downstream, two different harms:

- Via `VaultSync.list()` (`:176`): `content.split('\n')` →
  `TypeError: Cannot read properties of undefined` → the **entire `list()`
  rejects**. Post-S64 there is no `refresh()` retry on write paths, so a
  rejected mount `list()` means an empty list or a full-screen error card until
  reload.
- **The five self-loading cards do not go through `VaultSync`.** They call
  `transport.readFiles()` directly and parse inside their own `try/catch`. A
  ghost `Calendar/today.md` therefore produces **no error at all** — it produces
  **TodayCard confidently rendering "no events today."** That silent variant is
  worse than the loud one: the user's mental model is corrupted, not just their
  console.

**`HabitsCard.tsx:156` is the single strongest piece of evidence that this is a
data-integrity ticket.** It constructs a *fresh* transport **per habit tap**, on
the **write** path, against the store a read may be walking. It passes no
`{wipe:true}` so it does not steal — but it (a) creates another divergent
in-memory superblock, (b) `writeFile` → `_cache.writeStat` → `autoinc()` from
**its** tree → **ino collision** with a concurrent reader, (c) flushes that
divergent tree over `!root`. It also leaks an instance per tap.

**Severity: High / correctness. Not console noise.**

### What changed today (S64)

`slice-S64-optimistic-task-writes.md` landed and removed `await refresh()` from
all four write paths in `useTasks.ts`. Reads are now **mount-only**, so the
eight-way fan-out fires as a single concentrated burst — which makes `inflight`'s
collapse *maximally* effective and means S66 lands at exactly the right moment.
Read S64 before starting, especially its "Forbidden over-builds" section.

## The fix (architect's ruling)

Three concerns, in priority order:

1. **Single process-wide ownership of `FS_NAME`** — a module-level lazy accessor
   in `transport.ts`. A rejection handler alone is **rejected as the fix**: with
   eight owners it suppresses the *one signal* that corruption is occurring. It
   is not neutral, it is a reliability regression dressed as a fix.
2. **Eliminate the steal at its source** — replace the second `LightningFS` with
   an in-place reset on the existing handle. Single ownership alone still leaves
   **one** steal per reclone (a fresh `Mutex2` has `_release === null`, so it
   still takes the steal branch, and its predecessor still holds the lock).
   7 → 1, not 7 → 0.
3. **Harden the read push-site** — single ownership prevents *new* corruption;
   it does **not heal stores that are already corrupt right now**. The
   content-type guard is the only part of S66 that helps a user whose IndexedDB
   is already poisoned. It is not optional padding on a minimal diff.

### Shape

```ts
let shared: GitTransport | null = null
export function getVaultTransport(): VaultTransport {
  return (shared ??= new GitTransport())
}
/** Test-only: clears the module-scoped owner between tests. */
export function __resetVaultTransport(): void { shared = null }
```

**Lazy accessor, not `export const t = new GitTransport()`.** Eager construction
is a module-import side effect, and avoiding exactly that is the organising
principle of this file (deferred dynamic imports; S62's synchronous config check
before `import()`). Eager binding would also risk reviving #155's render budget
and `getVaultPat()`'s blocking `window.prompt`. Precedent for the lazy-memo +
`__reset…` idiom already exists in `selfLoadTasks.ts:30-51` — use it, do not
invent a new one.

**React context is rejected**, three independent reasons: (i) it forces a
Provider into `App.tsx`, the wave-14 hotspot with its own ordering rule, so S66
would have to join that queue; (ii) `selfLoadTasks.ts` is a module and cannot
consume context, so you would still need the module singleton *as well* — two
ownership mechanisms for one resource; (iii) it models a process-global resource
as tree-scoped state, and the prop seam already provides substitution.

### The reset (option **c2**)

Replace `transport.ts:217` with `await this.fs.init(FS_NAME, { wipe: true })` on
the **existing** handle. `LightningFS.init(name, options)` is public API
(`index.js:34-36`, bound at `:18`) and delegates to `PromisifiedFS.init`.

Why this removes the steal rather than handling its exhaust: `PromisifiedFS._init`
does `await this._gracefulShutdown()` then
`if (this._activationPromise) await this._deactivate()` **before** building a
fresh backend. In-flight operations drain and the mutex is released through the
**normal** `_release()` path. The subsequent `release({force:true})` still takes
the steal branch, but **there is no local holder left to victimise** — and a
Web Locks steal with no current holder grants immediately and rejects nobody.
There is also only ever one `PromisifiedFS` object, so the multi-instance
superblock divergence (the actual corrupter) is gone by construction.

**Fallback c1**, only if the live check in DoD #12 still shows one `Lock broken`
per reclone: recursive delete of `/vault` through `pfs` (never touching
`_needsWipe`). It never wipes IDB and never steals, but `rmdir` throws
`ENOTEMPTY`, so it needs a ~20-line recursive walk and is O(files) slower.
**Do not reach for c1 first.**

**Hard constraint against ADR-0010.** Resetting through the fs handle is
*exactly as destructive to unpushed commits* as `{wipe:true}`. (c) changes **how**
we reset, never **whether** it is safe to reset. The `commitsAhead === 0` gate
(`transport.ts:209-214`) stays as the sole authority, in the same position,
unweakened. Any diff that moves, relaxes, or reorders it is a **FAIL**, not a
discussion.

### The aliasing hazard this fix INTRODUCES — do not ship without the mitigation

This is the highest-probability way for S66 to introduce a new bug while fixing
an old one, and a reviewer will miss it.

`inflight` collapses concurrent callers onto **one promise**, so every sharer
receives the **identical array object**, whose entries are the **identical
objects**. And `VaultSync` mutates those entries **in place**: `this.lastFiles = files`
(`VaultSync.ts:136`) aliases the transport's array directly, then
`fileEntry.content = newContent` at **`:240`, `:334`, `:379`, `:414`** and
`this.lastFiles.push(...)` at **`:242`**. Today each consumer has its own
transport and therefore its own fresh `result` array, so this is safe. After the
singleton, the five cards **and both `VaultSync` instances** alias one array with
two mutators on it.

**Mandatory:** `readFiles()` must hand each caller a defensive copy —
`.then(r => r.map(e => ({ ...e })))` in the `readFiles()` wrapper, **above**
`inflight`. Cost is negligible (tens of entries).

## Write-set

- **MODIFY `src/vault/transport.ts`**
  - ADD `getVaultTransport()` + `__resetVaultTransport()` (module-level lazy memo).
  - `readFiles()` (`:169-176`) — defensive copy per caller, above `inflight`.
  - `_readFiles()` `:217` — `await this.fs.init(FS_NAME, { wipe: true })`; the
    subsequent `git.clone` keeps `fs: this.fs` (now the same object identity).
  - `:286-288` — drop the `as string` cast; skip any entry whose `content` is
    not a `string` (`if (typeof content !== 'string') return`).
  - ADD one doc-comment paragraph naming the cross-tab limitation + the
    follow-up issue number.
  - **DO NOT touch `:209-214`** (the `commitsAhead > 0` guard).
- **MODIFY `src/sync/VaultSync.ts:88`** — `transport ?? getVaultTransport()`.
  **This one edit covers both module-level singletons**, so `App.tsx` and
  `selfLoadTasks.ts` are **not touched** — which is what keeps S66 out of the
  `App.tsx` hotspot queue and clear of S64's negative DoD. Do not "helpfully"
  edit either file.
- **MODIFY 6 call sites** — `AttentionCard.tsx:80`, `FleetStrip.tsx:66`,
  `HabitsCard.tsx:124`, `HabitsCard.tsx:156`, `HomeView.tsx:130`,
  `TodayCard.tsx:92`: `new GitTransport()` → `getVaultTransport()`. **Only the
  right-hand side of `??` changes.**
- **MODIFY `src/vault/transport.test.ts`** — tests (i)–(iv) below; extend
  `FakeFS.readFile` to *resolve `undefined`* for a seeded ghost path (it
  currently **throws** on missing, which is exactly why it never caught this).
- **MODIFY `src/sync/VaultSync.test.ts`** — one test: `list()` survives a
  non-string `content`.
- **DO NOT MODIFY:** `src/App.tsx`, `src/sync/selfLoadTasks.ts`,
  `src/hooks/useTasks.ts`, `src/vault/parseVault.ts`, any `transport?:` /
  `briefTransport?:` prop declaration, `appendHabitHit`'s signature.

## Subtasks

1. Add `getVaultTransport()` / `__resetVaultTransport()`; point all 7 default
   sites at it (6 files — `VaultSync.ts:88` covers two of the seven owners).
2. Add the defensive copy in `readFiles()`.
3. Swap the reset to in-place `this.fs.init(...)`; leave the ADR-0010 guard alone.
4. Harden the read push-site; delete the `as string` cast.
5. Wire `__resetVaultTransport()` into the test setup so no state bleeds between tests.
6. Write tests (i)–(iv) + the `VaultSync` one; confirm each is red on `master`
   for its stated reason.
7. Add the cross-tab limitation doc-comment; file the four follow-up issues.

## Definition of Done

1. `new GitTransport()` appears in **zero** files under `src/components/` and
   `src/sync/` — `grep -rn "new GitTransport()" src/ --include=*.ts --include=*.tsx`
   returns hits only in `src/vault/transport.ts` (the accessor) and test files.
2. `getVaultTransport()` returns the same object across calls, and with
   `VITE_VAULT_REPO_URL` stubbed the mocked `LightningFS` constructor runs
   **exactly once** across the 5 card defaults + a `new VaultSync()` — test (i-a).
   *Red on master: 7.*
3. Two concurrent `readFiles()` from **different** consumers (a card default and
   a `VaultSync`) trigger **exactly one** `git.pull` — test (i-b). *Red on
   master: 2.* This is the assertion that catches a "singleton exists but callers
   still construct their own" half-fix; rank it above #2.
4. `readFiles()` **never emits an entry whose `content` is not a `string`**, and
   emits the good file alongside — test (ii) asserts the result contains exactly
   the good path. *Red on master:* `result.push` accepts `undefined`.
5. `as string` no longer appears on the `pfs.readFile` call in `transport.ts`
   (grep-verifiable).
6. `VaultSync.list()` does not throw when the transport hands it an entry with
   non-string `content` — test in `VaultSync.test.ts`. *Red on master:*
   `content.split('\n')` TypeErrors.
7. Across a full pull-fail → reset → clone cycle the mocked `LightningFS`
   constructor runs **exactly once**, and `expect(cloneOpts.fs).toBe(pullOpts.fs)`
   — test (iii). *Red on master:* master constructs a second instance and hands
   **that** one to `clone`. **This is the only test that pins the reset change;
   without it that change ships untested.**
8. Each caller of a shared `readFiles()` receives a **distinct** entry object:
   mutating `result[0].content` from one caller does not change the other
   caller's view — test. *Red on master:* not reachable on master (separate
   transports), so state it as a forward guard, not a red-first proof.
9. `transport.ts:209-214` (the `if (commitsAhead > 0) throw '…refusing to wipe'`
   block) is **byte-identical to master** — verifiable in the diff — and test
   (iv) proves the reset path is not entered when commits are ahead.
10. **Negative criterion (out-of-scope detector):** `src/App.tsx`,
    `src/sync/selfLoadTasks.ts`, `src/hooks/useTasks.ts`, `src/vault/parseVault.ts`
    are **absent from the diff**. Every `transport?: VaultTransport` /
    `briefTransport?: VaultTransport` declaration is unchanged
    (`grep -c "transport?: VaultTransport" src/components/home/*.tsx` matches
    master), and every existing card test passes **unmodified**. A change here is
    a **FAIL**, not a pass.
11. No `new GitTransport()` at module top level anywhere (grep) — the accessor
    must be lazy, or #155's render budget and the blocking PAT prompt come back.
12. **HITL (cannot be CI-verified — see Tests):** zero occurrences of
    `Lock broken by another request` in the live console across two full mount
    cycles of the deployed build, including one cycle where the remote 401s.
    Filtered console output pasted into the PR.
13. `transport.ts`'s doc-comment names the cross-tab limitation and cites the
    filed follow-up issue number.
14. `npm run build` + `npm test` green incl. `pwa-e2e`; issue #176 closed by the PR.

## Tests

All in `src/vault/transport.test.ts` unless stated. The existing harness already
mocks `isomorphic-git` / `lightning-fs` with `FakeFS` and already forces the
clone path (`pull = vi.fn().mockRejectedValue(new Error('no pull'))`), so S66's
tests **manufacture their own trigger** and do not depend on #177 being
reproducible.

**Harness rule — the counter is vacuous without the env stub.** Counting
`LightningFS` constructions only means anything if `loadGit()` gets past S62's
synchronous `if (!url)` guard. Every counting test **must**
`vi.stubEnv('VITE_VAULT_REPO_URL', …)`; without it the test is vacuously green
on master *and* on the fix. Also call `__resetVaultTransport()` in `beforeEach`.

**(i-a) One instance across all readers.** Env stubbed; instantiate the 5 card
defaults + `new VaultSync()`; assert the mocked `LightningFS` ctor ran once.
*Red on master: 7.*

**(i-b) Behavioural collapse — the red-first check.** Two concurrent
`readFiles()` from different consumers → `git.pull` called **exactly once**.
*Red on master: 2.* Proves the actual win rather than object identity.

**(ii) Ghost file — the most valuable test in the slice.** Extend
`FakeFS.readFile` to **resolve `undefined`** for one seeded path (mirroring
`DefaultBackend.readFile`'s no-throw return). Assert no result entry has a
non-`string` `content`. **Mandatory anti-vacuity control (#120 lesson, same
device S64 used with its control task):** seed **two** files — one good, one
ghost — and assert the result contains **exactly the good one, by path**.
Without the control, an over-correcting implementation that drops *everything*
passes. *Red on master:* `content: undefined` is pushed.

Plus in `VaultSync.test.ts`: a fake transport returning
`{ path: 'Career/x.md', content: undefined }` must not make `list()` throw. The
transport-level test encodes the mechanism; this one encodes the user-visible harm.

**(iii) No second instance on the reset path.** Force `pull` to reject; assert
(a) the `LightningFS` ctor ran **exactly once** across pull-fail → reset →
clone, and (b) `expect(cloneOpts.fs).toBe(pullOpts.fs)`, and (c) `clone` was
actually called (so a reset that silently stops resetting is caught).
*Red on master:* a second instance is constructed and handed to `clone`.

**(iv) ADR-0010 regression fence.** `pull` rejects, `push` rejects, `log`
resolves commits with an unresolvable remote ref → assert the reset path is
**not** entered and the transport throws `'…refusing to wipe'`. Not red-first;
it is the fence around the one thing S66 could plausibly break.

**What no unit test can prove — state this in the PR.** jsdom has no
`navigator.locks`, so `DefaultBackend.init` (`:31`) selects the IDB `Mutex`, not
`Mutex2`, and **the entire steal mechanism is absent from the test environment.**
You **cannot** write a CI test for the absence of the uncaught `AbortError`. If
an agent produces one by mocking `navigator.locks`, that test asserts the mock's
behaviour, not the browser's — it is the #120 failure mode exactly and must be
**rejected in review**. Hence DoD #12 is HITL, the same category ADR-0010 flag
(D) already established for S15b.

*Optional forward guard, honestly labelled:* a `pwa-e2e` assertion on an
injected `unhandledrejection` counter matching `/Lock broken/`, asserting zero
after load. Real Chromium → real `navigator.locks`. But it will **not** be red
on master unless the e2e environment has a configured vault remote, which it
does not. Ship it as a forward guard; **do not claim it as red-first proof.**

## Design refs

None — no UI change, no new tokens. ADR-0010 "must-fix transport hazard" is
**binding** (the `commitsAhead === 0` gate is untouchable). Owner decision 7
proposes a new ADR-0011 for the ownership constraint itself.

## Owner decisions (confirm before/at dispatch — do not silently re-decide)

1. **Re-scope #176 from console-noise to data-integrity/correctness, and
   re-title. RECOMMENDED: yes, High severity.** Changes wave priority and what
   gets bumped.
2. **The reset: (c) in-place `fs.init(...)` vs (a)/(b) keep `{wipe:true}` vs
   (d) user-initiated "reset local vault cache". RECOMMENDED: (c) now; (d) as a
   later, deliberate slice.** (d) is architecturally the most honest option and
   where this should end up — but it is a **product surface** (button, copy,
   token), and a bug-fix slice must not invent one (the exact reasoning S64 used
   to refuse the pending affordance). It also changes recovery semantics: today
   a corrupt clone self-heals on the next read; under (d) the app stays broken
   until the user acts.
3. **Is a global `unhandledrejection` filter ever acceptable in this codebase?
   RECOMMENDED: no — and specifically not in S66.** A standing policy question
   affecting all future debugging. *If the owner rejects decision 2 and keeps
   `{wipe:true}`, a handler becomes acceptable defence-in-depth (never
   "required"), and only in this shape:* module scope in `transport.ts`
   (**not** `main.tsx`), installed lazily by the accessor; predicate narrow
   **and windowed** — `e.reason instanceof DOMException && e.reason.name === 'AbortError'
   && /Lock broken by another request/.test(e.reason.message)` **plus** a
   transport-owned `wiping` flag set immediately before the reset and cleared
   when the clone settles; and it must `console.debug` a count rather than fully
   silence. A message-only filter would swallow any future legitimate Web Locks
   steal anywhere in the app.
4. **Cross-tab contention: defer + file an issue. RECOMMENDED: defer —
   *conditional on decision 2 resolving to (c)*.** Post-fix cross-tab behaviour
   is slow-but-safe: tab B's first read may block behind tab A's lock
   (`Mutex2.wait()`, 10-min ceiling, released 500ms after A's ops drain). That
   is an interaction bug, not data loss. **But with `{wipe:true}` retained
   anywhere, cross-tab *is* a corruption vector** (tab B wipes the store tab A is
   mid-read on and steals its lock). So: **(c) lands → cross-tab defers; (a) or
   (b) → cross-tab escalates.** These two decisions cannot be split apart.
   **The one fact that would change this ruling and is not derivable from the
   repo: does the owner routinely run two tabs of the deployed PWA?**
5. **Halt/re-dispatch S67 so S66 lands first (see Sequencing). RECOMMENDED: yes.**
   S67 is already dispatched; stopping it costs work already done.
6. **Allow DoD #12 to be HITL rather than CI-verified. RECOMMENDED: yes** —
   precedent is ADR-0010 flag (D), "HITL by construction". It weakens the
   triple-green gate for one item; that is the owner's gate to weaken.
7. **Does S66 get an ADR? RECOMMENDED: yes — a short ADR-0011, "Single owner of
   the vault FS; non-stealing reset."** Amend ADR-0010 **by link only** — do not
   edit an Accepted ADR in place. "One process-wide owner of `FS_NAME`" is a
   constraint on all future code; without a written rule the **ninth**
   `new GitTransport()` appears in the next slice and silently re-opens this bug.
   ~20 lines of insurance.
8. **Follow-ups to file, implement none:** (a) consolidate the five card
   self-loads into one shared vault read; (b) collapse the two `VaultSync`
   instances; (c) cross-tab ownership; (d) `appendHabitHit` bypasses
   `VaultSync`'s FIFO queue entirely by going straight at the transport
   (pre-existing; a write concurrent with a read on one fs is still possible —
   `inflight` covers reads only).

## Forbidden over-builds (reject in review)

- **A global `unhandledrejection` swallow as the fix.** Symptom suppression;
  converts a loud data-integrity bug into a silent one; suppressing to zero
  observability is how this bug hid in the first place.
- **Cross-tab leader election / BroadcastChannel / a Web Locks coordinator.** A
  distributed-coordination mechanism for a problem not yet shown to bite.
- **React context or a DI container for the transport.** Drags in the `App.tsx`
  hotspot and its ordering rule, cannot serve `selfLoadTasks.ts`, models a
  process-global resource as tree state. The prop seam already exists.
- **Forking or `patch-package`-ing lightning-fs.** Tempting — the defect is
  genuinely in the dependency — but it is a permanent maintenance liability to
  fix a path we can simply stop calling.
- **A retry/backoff wrapper around `git.pull`, or any outbox/queue.** S64 already
  ruled: `transport.ts:335-339`, "the transport already is the outbox". The pull
  failure belongs to S67.
- **Consolidating the five card self-loads into one shared read, or a
  `useVaultFiles` hook.** This is the architecturally correct *eventual* move —
  five full recursive vault reads on one mount is the real waste — and that is
  exactly why it must be refused here. #176 is closed by owning the FS, not by
  merging the readers. File it (Owner decision 8a).
- **Collapsing the two `VaultSync` instances.** Explicitly deferred by S64
  (non-goal + owner decision 3). They now share one transport, which is all #176
  requires.
- **Bumping `FS_NAME` to `lifeos-vault-v2`** to abandon already-corrupt stores.
  It would orphan any unpushed local commits — precisely ADR-0010's hazard,
  executed deliberately.

## Blast radius

- **Failure isolation was an illusion.** Eight objects, one store, one
  superblock, one lock — never isolated, *interfering*. "One card's failed
  transport cannot poison another's" is true at the object layer and false at
  the data layer, which is the layer that matters. What changes: five cards that
  today fail independently *and identically* (shared cause) will fail
  **together** through one `inflight`. Same outcome, correlated instead of
  coincidental. Each card's own `try/catch` → honest empty state is untouched.
- **Latency improves materially:** 7 concurrent network `git.pull` collapse to
  1. Against S64's measured ~8s read, this is the largest performance change in
  the wave, and it is free.
- **Ordering shifts slightly:** a card mounting into an in-flight read joins it
  rather than starting its own, so it may receive a read initiated milliseconds
  before its own mount. All Home cards mount together and S64 made reads
  mount-only, so the window is negligible. State it; do not engineer around it.
- **No new deadlock:** waiting for an in-flight read is strictly faster than
  racing it on the same FS, and `inflight` clears in `finally`.
- **If it ships wrong:** eager module-level construction revives #155's render
  budget and the blocking PAT prompt (DoD #11); a missing
  `__resetVaultTransport()` in test setup bleeds state across tests; a reset that
  silently stops resetting makes S66 *cause* #177's permanent staleness
  (test (iii)(c)).
- **Already-corrupt stores in the field** are not healed by ownership alone —
  the content-type guard degrades them gracefully and the now-safe reset path
  self-heals. If a user reports persistent breakage post-S66, the diagnosis is a
  pre-existing corrupt store and the answer is Owner decision 2(d), not more
  machinery in S66.
- **Note for S68 (#178):** the content-type guard converts a `list()` rejection
  into a *silently shorter file list* — a deliberate trade toward availability
  over loudness, acceptable here because the alternative is a blank app and
  because the user-visible surfacing channel is S68's by S64's ownership table.

## Dispatch

`/afk-pipeline auto` with this file. Model: **Opus** — the reset change is a
one-line diff whose correctness depends on reading dependency internals
(`PromisifiedFS._init`'s shutdown ordering), and the aliasing hazard is easy to
miss. This is not a mechanical find-and-replace despite looking like one.

**Sequencing — S66 lands FIRST; S67 (#177) rebases onto it and RE-MEASURES.**
Both edit `src/vault/transport.ts` (declared wave-14 hotspot). Five reasons, in
descending force:

1. **S66 changes S67's evidence base.** The "four upload-pack 401s ≈ two read
   paths × (anon + authed)" arithmetic is derived from a world with seven
   transports and a per-instance `inflight`. After S66 there is **one** transport
   with a working `inflight`, so a mount burst produces exactly **one**
   `discover` → at most **two** requests. If S67 lands first and validates a
   proxy/auth theory calibrated on four requests, S66 then changes the request
   count and the fix is confirmed against a number that no longer exists. **Yes,
   the arithmetic collapses — and that argues for S66 first, not against.**
2. **S66 turns S67's diagnosis from ambiguous into decisive.** The salvaged
   finding (isomorphic-git's `discover` sends the first request anonymously,
   then calls `onAuth` and retries once; no `onAuthFailure` is supplied so a
   second 401 throws) is almost certainly right. With a single reader S67 should
   observe exactly one anon 401 then one authed 200. If it instead sees an
   **authed** 401, that is a genuine credential/proxy problem. Post-S66 S67 can
   distinguish these; pre-S66 it cannot.
3. **Does S67 make #176 unreproducible? Partially — which argues FOR S66 first.**
   If S67 fixes the 401, `pull` succeeds, `needsClone` never fires, and the
   `AbortError` disappears **with the ownership bug fully intact** — surviving
   undetected until the next unrelated pull failure (force-push, corrupt object,
   genuinely offline). Fixing the trigger while leaving the loaded gun is the
   worse order.
4. **S67 does not render S66's tests unwritable.** S66's tests manufacture the
   trigger, as the existing test file already does.
5. **Hotspot mechanics.** S66's edits are structural (new exported accessor,
   reset path, read-site hardening); S67's are localised to `loadGit`'s auth
   options (`onAuth`/`onAuthFailure`) plus staleness surfacing. S66-then-S67
   means S67 adds options into a `sharedOpts` it can see. The reverse means S66
   restructures around S67's fresh code — the same argument S64 used against S68.

**Action:** halt the parallel S67 dispatch and re-dispatch after S66 merges, or
at minimum instruct it to rebase **and re-collect its network trace**. Add to
S67's ticket: *the pre-S66 4×401 observation is not ground truth; re-measure
post-merge.* **Do not merge S67 first.**

Target size: ~40 lines across `transport.ts` + one token at each of 6 call
sites, plus tests.
