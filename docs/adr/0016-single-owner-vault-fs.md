# Single owner of the vault FS; non-stealing reset

Status: **Accepted**. Constrains the transport built in [ADR-0009](0009-vault-read-transport.md) and preserves the wipe gate mandated by [ADR-0010](0010-vault-write.md). Recorded by slice S66 (closes #176).

> **Numbering note.** Slice S66 and owner decision 7 both call this "ADR-0011". `docs/adr/0011-bot-transport-identity-router.md` has been Accepted since S16, as have 0012–0015, so this decision takes the next free number instead. The content is unchanged.

## Context

`FS_NAME = 'lifeos-vault'` (`src/vault/transport.ts`) names **one** IndexedDB store and **one** `navigator.locks` lock. Until S66, **eight** independent `GitTransport` instances each constructed their own `LightningFS` over it: two module-level `VaultSync` singletons, five per-card read defaults, and a fresh instance per habit tap on the write path. A single cold load was measured at seven `AbortError: Lock broken by another request with the 'steal' option`, seven `git-upload-pack` handshakes and seven broken locks (#176).

Those instances were never isolated replicas — they were interfering writers of one superblock. Verified against `@isomorphic-git/lightning-fs@4.6.2`: `DefaultBackend.activate()` wipes IDB **before** acquiring the mutex, then calls `Mutex2.release({force:true})`, which on a fresh instance takes the `navigator.locks.request(name, {steal:true})` branch. The mutex is advisory — checked only in `activate()`, never per operation — so a victim keeps reading and writing after its lock is stolen, and its debounced `saveSuperblock()` flushes a stale tree over `!root`. That makes the corruption durable across reloads, and colliding inodes from `CacheFS.autoinc()` mean one file's bytes can be served under another file's path.

`GitTransport.inflight` was always the correct guard at the wrong scope: per-**instance**, over a per-**process** resource.

## Decision

1. **One process-wide owner of `FS_NAME`.** Every default read/write seam resolves through the lazy module-level memo `getVaultTransport()` in `src/vault/transport.ts`. **No code outside that accessor may write `new GitTransport()`.** The prop seam (`transport?: VaultTransport`) remains the substitution point for tests; adding a second owner is what re-opens #176.
2. **The accessor is lazy.** Eager construction is a module-import side effect, which this file is organised to avoid; it would revive #155's render budget and `getVaultPat()`'s blocking `window.prompt`.
3. **Reset in place, never by construction.** A reclone calls `await this.fs.init(FS_NAME, { wipe: true })` on the handle already held. `PromisifiedFS._init` drains in-flight operations and releases the mutex through the normal `_release()` path before rebuilding the backend, so the subsequent forced release has no holder to victimise. Constructing a second `LightningFS` over a live store is forbidden.
4. **The `commitsAhead === 0` gate is untouched.** ADR-0010's "must-fix transport hazard" remains the sole authority on *whether* a reset is safe; this ADR only changes *how* one is performed. Moving, relaxing or reordering that gate is a defect.
5. **Shared reads are copied per caller.** `readFiles()` returns `files.map(e => ({ ...e }))` above `inflight`, because `VaultSync` mutates entries in place and now shares one array with every other consumer.

## Consequences

- **Failure isolation was an illusion, and losing it costs nothing.** Five cards that previously failed independently but identically (shared cause) now fail together through one `inflight`. Each card's own `try`/`catch` → honest empty state is unchanged.
- **Seven concurrent `git.pull` collapse to one** — the largest latency improvement in wave 14, obtained for free.
- **Cross-tab contention is out of scope and tracked as #188.** The memo is per JavaScript realm, so two tabs remain two owners. Post-S66 that degrades to slow-but-safe: tab B queues behind tab A's lock (`Mutex2.wait()`, 10-minute ceiling) rather than wiping the store beneath it. **Reinstating any wipe that runs before the lock is held re-escalates #188 from an interaction bug to a corruption vector.**
- **Already-corrupt stores are not healed by ownership.** The content-type guard at the read push-site degrades them gracefully; the now-safe reset path self-heals them. Persistent breakage post-S66 indicates a pre-existing corrupt store, and the answer is a deliberate user-initiated cache-reset slice, not more machinery in the transport.
- **Not CI-verifiable.** jsdom has no `navigator.locks`, so `DefaultBackend.init` selects the IDB `Mutex` and the steal mechanism is structurally absent from the test environment. Absence of the uncaught `AbortError` is HITL by construction — the same category as ADR-0010 flag (D). A test that mocks `navigator.locks` asserts its own mock and must be rejected in review (issue #120).
- **Revisit when:** a second realm legitimately needs the vault (a Web Worker or a genuinely multi-tab workflow), or when `lightning-fs` gains a per-operation mutex check. Either would make #188 an ownership question rather than a deferral.
