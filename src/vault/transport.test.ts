/**
 * transport.test — S56 DoD #1 (browser side): assert the in-browser vault
 * clone stays SHALLOW and SINGLE-BRANCH.
 *
 * GitTransport already requests `depth: 1` + `singleBranch: true` (S14/ADR-0009);
 * this is a regression spy so a future refactor can't silently deepen the clone
 * and blow up the PWA's in-browser history size (the S56 hardening risk).
 *
 * isomorphic-git / http/web / lightning-fs are fully mocked — no IndexedDB, no
 * network. We force the clone path by making `pull` reject (needs-clone) with
 * no local commits ahead (`log` rejects → ahead-count 0 → safe to clone), then
 * assert the options `clone` was called with.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const h = vi.hoisted(() => {
  const clone = vi.fn().mockResolvedValue(undefined)
  const pull = vi.fn().mockRejectedValue(new Error('no pull'))
  const push = vi.fn().mockRejectedValue(new Error('no push'))
  const log = vi.fn().mockRejectedValue(new Error('no local repo'))
  const add = vi.fn().mockResolvedValue(undefined)
  const commit = vi.fn().mockResolvedValue(undefined)
  const currentBranch = vi.fn().mockResolvedValue('main')
  const resolveRef = vi.fn().mockRejectedValue(new Error('no remote ref'))
  // S66/#176 spies. `fsCtor` counts LightningFS *constructions* — the whole
  // point of the single-owner change is that this stops scaling with the
  // number of readers. `fsInit` counts in-place `fs.init(name, opts)` calls,
  // which is how the non-stealing reset replaces `new LightningFS(name,
  // {wipe:true})`.
  const fsCtor = vi.fn()
  const fsInit = vi.fn()
  // S66/#176 — paths whose readFile must RESOLVE `undefined` instead of
  // throwing, mirroring DefaultBackend.readFile on an already-corrupt store
  // (see FakeFS.readFile below).
  const ghosts = new Set<string>()
  // Set to true the moment each mocked module's factory actually runs — i.e.
  // the moment GitTransport's dynamic `import(...)` for that specifier is
  // reached. vi.mock factories are lazy: they only execute on first import of
  // that specifier, so these flags are a direct proxy for "did loadGit() get
  // past the synchronous `if (!url)` check" (S62/#155) — NOT just "was
  // LightningFS ever constructed", which the pre-S62 code already avoided
  // and so wouldn't catch a regression back to import-before-check.
  const moduleReached = { isomorphicGit: false, http: false, lightningFs: false }
  // Minimal lightning-fs stand-in, backed by a real in-memory Map per
  // instance: readdir/readFile/writeFile derive their answers from whatever
  // has actually been "written" so far. With an empty map every domain dir
  // is absent (readFiles() returns [] after the clone — the read loop
  // swallows readdir failures), matching the old dumb-reject-always mock's
  // behaviour for every test that never writes anything. Tests that DO
  // write (the #148 regression below) need readdir/readFile to reflect
  // those writes on a later read — a static "always reject" mock can't do
  // that, so this fake is stateful instead.
  //
  // readdir returns the immediate child name for EVERY key under the
  // queried prefix, whether that child is a leaf file or itself a
  // subdirectory (S61/#158 — GitTransport's recursive walk relies on
  // readdir succeeding for a directory path and throwing for a file path
  // to tell the two apart; a mock that only ever returns leaf files one
  // level deep, as before this slice, can't exercise nested reads like
  // `agents/<name>/status.json`).
  class FakeFS {
    private files = new Map<string, string>()

    // Mirrors @isomorphic-git/lightning-fs@4.6.2 `index.js`: the FS ctor
    // builds a PromisifiedFS which calls `init(name, options)` when a name is
    // given, and `init` is public API in its own right (`index.js:34-36`).
    // S66 relies on that second fact — it resets in place through `init`
    // rather than constructing a second FS over the same store.
    constructor(name?: string, options?: { wipe?: boolean }) {
      fsCtor(name, options)
      if (name) void this.init(name, options)
    }

    async init(name: string, options?: { wipe?: boolean }): Promise<void> {
      fsInit(name, options)
      // `{wipe:true}` is `idb.clear(store)` in the real backend — everything
      // goes, including the superblock.
      if (options?.wipe) this.files.clear()
    }

    promises = {
      readdir: async (dirPath: string): Promise<string[]> => {
        const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`
        const entries = new Set<string>()
        for (const p of this.files.keys()) {
          if (p.startsWith(prefix)) {
            const rest = p.slice(prefix.length)
            const firstSegment = rest.split('/')[0]
            if (firstSegment) entries.add(firstSegment)
          }
        }
        if (entries.size === 0) throw new Error('ENOENT: no such directory')
        return [...entries]
      },
      // S66/#176 — the ghost-file case. Until this slice this mock *threw*
      // for anything missing, which is precisely why the suite never caught
      // the bug: the real backend does not throw. On a store that another
      // LightningFS instance wiped mid-flight, `DefaultBackend.readFile`
      // (`:100-127`) hits `stat = this._cache.stat(filepath)` — truthy, from
      // the surviving in-memory tree — then `data = await this._idb.readFile
      // (stat.ino)`, and `idb.get` RESOLVES `undefined` for a missing key.
      // `this._http` is undefined (we never pass `url`), `if (!stat) throw
      // ENOENT` is skipped because `stat` is truthy, so the function returns
      // `undefined` **without throwing** and `transport.ts`'s `catch` never
      // fires. `h.ghosts` seeds exactly that shape for a chosen path.
      readFile: async (filePath: string): Promise<string | undefined> => {
        if (ghosts.has(filePath)) return undefined
        const content = this.files.get(filePath)
        if (content === undefined) throw new Error('ENOENT: no such file')
        return content
      },
      writeFile: async (filePath: string, content: string): Promise<void> => {
        this.files.set(filePath, content)
      },
      mkdir: async (): Promise<void> => {},
    }
  }
  return {
    clone,
    pull,
    push,
    log,
    add,
    commit,
    currentBranch,
    resolveRef,
    fsCtor,
    fsInit,
    ghosts,
    FakeFS,
    moduleReached,
  }
})

vi.mock('isomorphic-git', () => {
  h.moduleReached.isomorphicGit = true
  return {
    default: {
      clone: h.clone,
      pull: h.pull,
      push: h.push,
      log: h.log,
      add: h.add,
      commit: h.commit,
      currentBranch: h.currentBranch,
      resolveRef: h.resolveRef,
    },
  }
})
vi.mock('isomorphic-git/http/web', () => {
  h.moduleReached.http = true
  return { default: {} }
})
vi.mock('@isomorphic-git/lightning-fs', () => {
  h.moduleReached.lightningFs = true
  return { default: h.FakeFS }
})
vi.mock('./pat', () => ({ getVaultPat: () => undefined, clearVaultPat: () => {} }))

import { GitTransport, getVaultTransport, __resetVaultTransport } from './transport'
import { VaultSync } from '../sync/VaultSync'
import { appendHabitHit } from './habitsWrite'
import type { HabitHit } from './habits'

// ─── Unconfigured path skips the dynamic import entirely (S62/#155) ──────────
//
// MUST run first in this file (declaration order === execution order,
// vitest's default within a file, and this repo sets no shuffle/concurrent
// sequencer). Every dynamic-import specifier below is mocked via vi.mock,
// whose factories run lazily on first import — so `moduleReached` only
// tells us anything if these are the very first assertions to touch
// GitTransport in this module. Once any other test's readFiles()/writeFile()
// call reaches loadGit()'s import() (which they all do, with the env stubbed),
// the flags flip true for the rest of the file's run.
describe('GitTransport — unconfigured self-load skips isomorphic-git/lightning-fs entirely (S62/#155)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('readFiles() rejects on missing url WITHOUT ever reaching the isomorphic-git/lightning-fs import', async () => {
    // VITE_VAULT_REPO_URL intentionally left unset — no vi.stubEnv call.
    const transport = new GitTransport()

    await expect(transport.readFiles()).rejects.toThrow('VITE_VAULT_REPO_URL is not configured')

    expect(h.moduleReached.isomorphicGit).toBe(false)
    expect(h.moduleReached.http).toBe(false)
    expect(h.moduleReached.lightningFs).toBe(false)
  })

  it('writeFile() also rejects on missing url WITHOUT ever reaching the import', async () => {
    const transport = new GitTransport()

    await expect(transport.writeFile('x.md', 'a', 'msg')).rejects.toThrow(
      'VITE_VAULT_REPO_URL is not configured',
    )

    expect(h.moduleReached.isomorphicGit).toBe(false)
    expect(h.moduleReached.http).toBe(false)
    expect(h.moduleReached.lightningFs).toBe(false)
  })
})

describe('GitTransport — shallow, single-branch clone (S56 DoD #1)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_VAULT_REPO_URL', 'https://example.invalid/vault.git')
    h.clone.mockClear()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('clones with depth:1 and singleBranch:true', async () => {
    const transport = new GitTransport()
    const files = await transport.readFiles()

    // No domain folders in the fake FS → empty read, but the clone happened.
    expect(files).toEqual([])
    expect(h.clone).toHaveBeenCalledTimes(1)

    const opts = h.clone.mock.calls[0][0]
    expect(opts).toMatchObject({
      depth: 1,
      singleBranch: true,
      url: 'https://example.invalid/vault.git',
    })
  })
})

describe('GitTransport + appendHabitHit — Habits/log.md read-modify-write (#148 regression)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_VAULT_REPO_URL', 'https://example.invalid/vault.git')
    // This scenario needs `pull` to succeed (no wipe-reclone) so the FakeFS's
    // in-memory file map survives across both appendHabitHit calls on the
    // SAME GitTransport instance — exactly what a running PWA session does
    // across two live taps (GitTransport.fs is only replaced on a
    // wipe-reclone, never between ordinary readFiles() calls).
    h.pull.mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    // Restore the reject-by-default `pull` the sibling describe block above
    // (and any future test in this file) relies on.
    h.pull.mockRejectedValue(new Error('no pull'))
  })

  it('two hits on different days both survive a second live tap (fails pre-fix: only the 2nd hit survives, the 1st is clobbered)', async () => {
    const transport = new GitTransport()

    const hit1: HabitHit = { habit: 'Gym session', date: '2026-07-20', source: 'pwa' }
    const hit2: HabitHit = { habit: 'Gym session', date: '2026-07-21', source: 'pwa' }

    await appendHabitHit(transport, hit1)
    await appendHabitHit(transport, hit2)

    const files = await transport.readFiles()
    const log = files.find((f) => f.path === 'Habits/log.md')?.content ?? ''

    expect(log).toContain('(date:: 2026-07-20)')
    expect(log).toContain('(date:: 2026-07-21)')
  })
})

describe('GitTransport — Calendar/today.md surfaced in the snapshot (#151 regression)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_VAULT_REPO_URL', 'https://example.invalid/vault.git')
    // Same reasoning as the #148 block above: `pull` must succeed so the
    // FakeFS's in-memory file map survives between the seed write and the
    // later read on this same GitTransport instance, instead of being
    // wiped by a needs-clone reclone.
    h.pull.mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    h.pull.mockRejectedValue(new Error('no pull'))
  })

  it("readFiles() surfaces Calendar/today.md (fails pre-fix: TodayCard's find() is always undefined)", async () => {
    const transport = new GitTransport()

    const todayMd = [
      '# 2026-07-22',
      '- 08:00-09:00 Gym — legs (type:: gym)',
      '- 10:00-11:00 Client call — NorthStar handoff (type:: call)',
      '',
    ].join('\n')

    await transport.writeFile('Calendar/today.md', todayMd, 'seed calendar')

    const files = await transport.readFiles()
    const entry = files.find((f) => f.path === 'Calendar/today.md')

    expect(entry).toBeDefined()
    expect(entry?.content).toBe(todayMd)
  })
})

describe('GitTransport — Mail/attention.md surfaced in the snapshot (#154 regression)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_VAULT_REPO_URL', 'https://example.invalid/vault.git')
    // Same reasoning as the #148/#151 blocks above: `pull` must succeed so
    // the FakeFS's in-memory file map survives between the seed write and
    // the later read on this same GitTransport instance, instead of being
    // wiped by a needs-clone reclone.
    h.pull.mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    h.pull.mockRejectedValue(new Error('no pull'))
  })

  it("readFiles() surfaces Mail/attention.md (fails pre-fix: AttentionCard's find() is always undefined)", async () => {
    const transport = new GitTransport()

    const attentionMd = [
      '# attention — written by email-triage',
      '- [ ] Meera (NorthStar) asked for a revised quote (label:: client-money) (from:: meera@northstar.io) (waiting:: 26h)',
      '- [x] Recruiter reply — InstaCo (label:: job) (from:: t@instaco.dev) (waiting:: 0h)',
      '',
    ].join('\n')

    await transport.writeFile('Mail/attention.md', attentionMd, 'seed attention')

    const files = await transport.readFiles()
    const entry = files.find((f) => f.path === 'Mail/attention.md')

    expect(entry).toBeDefined()
    expect(entry?.content).toBe(attentionMd)
  })
})

// ─── Recursive, non-.md reads (S61/#158) ──────────────────────────────────────

describe('GitTransport — recursive descent + agents/ .json allowlist (S61/#158)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_VAULT_REPO_URL', 'https://example.invalid/vault.git')
    // Same reasoning as the #148/#151/#154 blocks above: `pull` must succeed
    // so the FakeFS's in-memory file map survives between the seed writes
    // and the later read on this same GitTransport instance.
    h.pull.mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    h.pull.mockRejectedValue(new Error('no pull'))
  })

  it(
    "readFiles() surfaces agents/<name>/status.json AND Briefs/<date>.md " +
      '(red-before-fix: the old flat, .md-only, non-recursive scan can reach ' +
      'neither — status.json is one directory deeper AND not .md; Briefs/ ' +
      "wasn't in the hardcoded folder list at all)",
    async () => {
      const transport = new GitTransport()

      const statusJson = JSON.stringify({
        agent: 'daily-brief',
        last_run: '2026-07-30T06:00:00.000Z',
        ok: true,
      })
      const briefMd = [
        '# Briefs/2026-07-30.md',
        '',
        '- Win: ship S61.',
        '- 10:00 Client call.',
        '',
      ].join('\n')

      await transport.writeFile('agents/daily-brief/status.json', statusJson, 'seed status')
      await transport.writeFile('Briefs/2026-07-30.md', briefMd, 'seed brief')

      const files = await transport.readFiles()

      const status = files.find((f) => f.path === 'agents/daily-brief/status.json')
      const brief = files.find((f) => f.path === 'Briefs/2026-07-30.md')

      expect(status).toBeDefined()
      expect(status?.content).toBe(statusJson)
      expect(brief).toBeDefined()
      expect(brief?.content).toBe(briefMd)
    },
  )

  it('does NOT surface agents/<name>/runs.jsonl (only .json is allowlisted, and only under agents/)', async () => {
    const transport = new GitTransport()

    await transport.writeFile('agents/daily-brief/status.json', '{}', 'seed status')
    await transport.writeFile('agents/daily-brief/runs.jsonl', '{"ts":"x","ok":true}\n', 'seed runs')

    const files = await transport.readFiles()

    expect(files.find((f) => f.path === 'agents/daily-brief/status.json')).toBeDefined()
    expect(files.find((f) => f.path === 'agents/daily-brief/runs.jsonl')).toBeUndefined()
  })

  it('does NOT extend the .json allowlist outside agents/ (a stray .json elsewhere in the vault stays invisible)', async () => {
    const transport = new GitTransport()

    await transport.writeFile('Growth/notes.json', '{"not":"a task file"}', 'seed stray json')
    await transport.writeFile('Growth/Reading.md', '- [ ] Real task\n', 'seed real task')

    const files = await transport.readFiles()

    expect(files.find((f) => f.path === 'Growth/notes.json')).toBeUndefined()
    expect(files.find((f) => f.path === 'Growth/Reading.md')).toBeDefined()
  })

  it('all previously-surfaced folders still round-trip byte-identically alongside the new nested/non-md reads (no regression)', async () => {
    const transport = new GitTransport()

    const readingMd = '- [ ] Real task\n'
    const inboxMd = '- [ ] Inbox item\n'
    const statusJson = JSON.stringify({ agent: 'x', last_run: '2026-07-30T00:00:00.000Z', ok: true })

    await transport.writeFile('Growth/Reading.md', readingMd, 'seed domain file')
    await transport.writeFile('Inbox/Inbox.md', inboxMd, 'seed inbox')
    await transport.writeFile('agents/x/status.json', statusJson, 'seed status')

    const files = await transport.readFiles()

    expect(files.find((f) => f.path === 'Growth/Reading.md')?.content).toBe(readingMd)
    expect(files.find((f) => f.path === 'Inbox/Inbox.md')?.content).toBe(inboxMd)
    expect(files.find((f) => f.path === 'agents/x/status.json')?.content).toBe(statusJson)
  })

  it('recursion is depth-bounded (a pathologically deep nested path is not read)', async () => {
    const transport = new GitTransport()

    // 6 directory levels deep under agents/ — past MAX_DEPTH (4) in
    // transport.ts's walk(). This can't happen with the real agent-status
    // writer, but the bound must hold regardless so a corrupt/malicious
    // vault can't stall the read via runaway recursion.
    const deepPath = 'agents/a/b/c/d/e/status.json'
    await transport.writeFile(deepPath, '{}', 'seed pathologically deep file')

    const files = await transport.readFiles()

    expect(files.find((f) => f.path === deepPath)).toBeUndefined()
  })
})

// ─── S66 / #176 — one owner of FS_NAME, non-stealing reset, ghost-file guard ──
//
// Harness rules for everything below (both are load-bearing):
//
//  1. **`vi.stubEnv('VITE_VAULT_REPO_URL', …)` is mandatory in every test that
//     counts anything.** Without it `loadGit()` throws on S62's synchronous
//     `if (!url)` guard before it ever constructs a LightningFS or calls
//     `git.pull`, so every counter reads 0 and the test is vacuously green on
//     master *and* on the fix.
//  2. **`__resetVaultTransport()` in `beforeEach`.** The owner is a
//     module-scoped memo (same idiom as `selfLoadTasks.ts:30-51`); without the
//     reset, one test's transport — and its already-initialised `fs` — bleeds
//     into the next.
//
// What these tests deliberately do NOT do: mock `navigator.locks`. jsdom has
// none, so `DefaultBackend.init` (`:31`) picks the IDB `Mutex`, not `Mutex2`,
// and the steal path that emits `AbortError: Lock broken by another request`
// is structurally absent from this environment. A test that mocked it would
// assert the mock's behaviour, not the browser's (the #120 failure mode).
// Zero-`AbortError` is verified HITL against the deployed build — DoD #12.

describe('GitTransport — single process-wide owner of FS_NAME (S66/#176)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_VAULT_REPO_URL', 'https://example.invalid/vault.git')
    __resetVaultTransport()
    h.ghosts.clear()
    h.fsCtor.mockClear()
    h.fsInit.mockClear()
    h.clone.mockClear()
    h.pull.mockClear()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    __resetVaultTransport()
    h.ghosts.clear()
    h.pull.mockRejectedValue(new Error('no pull'))
  })

  it('(i-a) constructs exactly ONE LightningFS across the 5 card defaults + both VaultSync singletons', async () => {
    // `pull` succeeds so this measures the *fan-out* alone, with no reclone
    // in the picture (a rejecting pull would additionally construct a second
    // FS per instance on master and muddy the number).
    h.pull.mockResolvedValue(undefined)

    // The five self-loading cards' defaults — AttentionCard:80, FleetStrip:66,
    // HabitsCard:124, HomeView:130, TodayCard:92 — each `transport ??
    // getVaultTransport()`; plus the two module-level VaultSync singletons
    // (App.tsx:22 and selfLoadTasks.ts:31), which both route through
    // VaultSync.ts:88. Seven owners on master, one after this slice.
    const appSync = new VaultSync()
    const selfLoadSync = new VaultSync()
    const readers: (() => Promise<unknown>)[] = [
      () => getVaultTransport().readFiles(),
      () => getVaultTransport().readFiles(),
      () => getVaultTransport().readFiles(),
      () => getVaultTransport().readFiles(),
      () => getVaultTransport().readFiles(),
      () => appSync.list(),
      () => selfLoadSync.list(),
    ]

    // Sequential on purpose — see the harness note above (i-b): two
    // GitTransports importing concurrently trips a Vitest mocker race. This
    // test is about how many FS objects get built, not about overlap, so
    // serialising costs it nothing.
    for (const read of readers) await read()

    expect(h.fsCtor).toHaveBeenCalledTimes(1)
  })

  it('(i-b) two overlapping reads from DIFFERENT consumers collapse to exactly one git.pull', async () => {
    // The behavioural assertion, ranked above (i-a): object identity can be
    // right while callers still construct their own transports, and this is
    // the test that catches that half-fix. It is also the measured live win —
    // seven `info/refs` handshakes per cold load collapse to one (#176).
    //
    // ── Harness note: why this is gated rather than a plain Promise.all ──
    // Vitest's module mocker races when two dynamic `import()`s of the same
    // `vi.mock`-ed specifier are in flight simultaneously: one importer gets
    // the mock and the other gets the REAL `isomorphic-git`, which then tries
    // to reach the network (verified in this worktree — a plain
    // `Promise.all([a.readFiles(), b.readFiles()])` on two transports yields
    // `fulfilled,rejected` with `getaddrinfo ENOTFOUND example.invalid`,
    // while the same two reads run back-to-back give a clean `pull === 2`).
    // Priming the modules first does not close the window. That race can only
    // fire when more than one transport exists — i.e. only on the pre-fix
    // code — so left unhandled it would corrupt this test's RED into a
    // network error instead of the count it is supposed to report.
    //
    // The gate below sidesteps it without weakening the assertion: reader A
    // is held *inside* `git.pull` (so its imports have already completed)
    // before reader B starts, so the two imports never overlap while the two
    // READS still do — which is the property under test.
    let releasePull!: () => void
    let signalPullEntered!: () => void
    const pullReleased = new Promise<void>((r) => {
      releasePull = r
    })
    const pullEntered = new Promise<void>((r) => {
      signalPullEntered = r
    })
    h.pull.mockImplementation(async () => {
      signalPullEntered()
      await pullReleased
    })

    const card = getVaultTransport()
    const sync = new VaultSync()

    const cardRead = card.readFiles()
    await pullEntered
    const syncRead = sync.list()
    releasePull()

    await Promise.all([cardRead, syncRead])

    expect(h.pull).toHaveBeenCalledTimes(1)
  })

  it('(DoD #8, forward guard — NOT red-first) each caller of one shared read gets its OWN entry objects', async () => {
    // Honest label: on master the five cards and both VaultSyncs each own a
    // transport, so each gets a freshly-built `result` array and this cannot
    // fail for the reason S66 cares about. The singleton is what creates the
    // hazard: `inflight` hands every sharer the identical array of identical
    // objects, and VaultSync mutates entries in place (`VaultSync.ts:136`
    // aliases it; `:240 :334 :379 :414` assign `fileEntry.content`; `:242`
    // pushes). One VaultSync's write would otherwise rewrite what a card is
    // rendering.
    h.pull.mockResolvedValue(undefined)

    const t = getVaultTransport()
    await t.writeFile('Growth/Reading.md', '- [ ] Real task\n', 'seed')

    const [first, second] = await Promise.all([t.readFiles(), t.readFiles()])

    expect(first).not.toBe(second)

    const a = first.find((f) => f.path === 'Growth/Reading.md')
    const b = second.find((f) => f.path === 'Growth/Reading.md')
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).not.toBe(b)

    a!.content = 'MUTATED BY ANOTHER CONSUMER'
    expect(b!.content).toBe('- [ ] Real task\n')
  })

  it('(ii) drops a ghost entry whose readFile RESOLVES undefined, and still returns the good file', async () => {
    h.pull.mockResolvedValue(undefined)

    const t = getVaultTransport()
    await t.writeFile('Growth/good.md', '- [ ] Real task\n', 'seed good')
    await t.writeFile('Growth/ghost.md', '- [ ] Lost task\n', 'seed ghost')
    // Both files remain in the directory tree (readdir still lists them) —
    // only the *content* read comes back undefined, exactly as a wiped IDB
    // store behaves against a surviving cached superblock.
    h.ghosts.add('/vault/Growth/ghost.md')

    const files = await t.readFiles()

    // Anti-vacuity control (#120 lesson): asserting only "no non-string
    // content" is satisfied by an over-correcting implementation that drops
    // *everything*, so pin the surviving path exactly.
    expect(files.filter((f) => f.path.startsWith('Growth/')).map((f) => f.path)).toEqual([
      'Growth/good.md',
    ])
    expect(files.every((f) => typeof f.content === 'string')).toBe(true)
  })

  it('(iii) pull-fail → reset → clone constructs NO second LightningFS and clones onto the same fs object', async () => {
    // `pull` rejects (default) → `push` rejects → `log` rejects → ahead-count
    // 0 → the reset path runs. This is the only test that pins the reset
    // change; without it that one line ships untested.
    const t = getVaultTransport()
    await t.readFiles()

    // (c) the reset genuinely still resets — a reset that silently stops
    // resetting would make S66 *cause* #177's permanent staleness.
    expect(h.clone).toHaveBeenCalledTimes(1)
    expect(h.fsInit).toHaveBeenCalledWith('lifeos-vault', { wipe: true })

    // (a) no second instance over the same IndexedDB store / lock name.
    expect(h.fsCtor).toHaveBeenCalledTimes(1)

    // (b) clone runs against the very object pull ran against.
    const pullOpts = h.pull.mock.calls[0]![0]
    const cloneOpts = h.clone.mock.calls[0]![0]
    expect(cloneOpts.fs).toBe(pullOpts.fs)
  })

  it('(iv) ADR-0010 fence: unpushed local commits ⇒ refuses to wipe and never enters the reset path', async () => {
    // pull rejects (default) → push rejects (default) → log resolves two local
    // commits with an unresolvable remote ref ⇒ countCommitsAhead returns 2.
    h.log.mockResolvedValueOnce([{ oid: 'aaaaaaa' }, { oid: 'bbbbbbb' }])

    const t = getVaultTransport()

    await expect(t.readFiles()).rejects.toThrow(
      'vault pull failed and local commits are unpushed; refusing to wipe',
    )

    expect(h.clone).not.toHaveBeenCalled()
    expect(h.fsInit).not.toHaveBeenCalledWith('lifeos-vault', { wipe: true })
  })
})

describe('getVaultTransport — lazy module-scoped owner (S66/#176, DoD #2/#11)', () => {
  beforeEach(() => {
    __resetVaultTransport()
  })
  afterEach(() => {
    __resetVaultTransport()
  })

  it('returns the same instance across calls', () => {
    expect(getVaultTransport()).toBe(getVaultTransport())
  })

  it('__resetVaultTransport() mints a fresh owner (test seam, mirrors selfLoadTasks.ts:49)', () => {
    const before = getVaultTransport()
    __resetVaultTransport()
    expect(getVaultTransport()).not.toBe(before)
  })

  it('is LAZY — no vault work happens until a caller actually reads', async () => {
    // DoD #11: an eagerly-constructed `export const t = new GitTransport()`
    // would be a module-import side effect, reviving #155's render budget and
    // getVaultPat()'s blocking window.prompt. Merely *getting* the owner must
    // touch neither the dynamic imports nor LightningFS. Note the env is
    // deliberately NOT stubbed here.
    h.fsCtor.mockClear()
    getVaultTransport()
    expect(h.fsCtor).not.toHaveBeenCalled()

    await expect(getVaultTransport().readFiles()).rejects.toThrow(
      'VITE_VAULT_REPO_URL is not configured',
    )
    expect(h.fsCtor).not.toHaveBeenCalled()
  })
})
