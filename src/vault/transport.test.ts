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
      readFile: async (filePath: string): Promise<string> => {
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
  return { clone, pull, push, log, add, commit, FakeFS, moduleReached }
})

vi.mock('isomorphic-git', () => {
  h.moduleReached.isomorphicGit = true
  return {
    default: { clone: h.clone, pull: h.pull, push: h.push, log: h.log, add: h.add, commit: h.commit },
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

import { GitTransport } from './transport'
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
