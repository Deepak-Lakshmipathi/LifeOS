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
  // Minimal lightning-fs stand-in, backed by a real in-memory Map per
  // instance: readdir/readFile/writeFile derive their answers from whatever
  // has actually been "written" so far. With an empty map every domain dir
  // is absent (readFiles() returns [] after the clone — the read loop
  // swallows readdir failures), matching the old dumb-reject-always mock's
  // behaviour for every test that never writes anything. Tests that DO
  // write (the #148 regression below) need readdir/readFile to reflect
  // those writes on a later read — a static "always reject" mock can't do
  // that, so this fake is stateful instead.
  class FakeFS {
    private files = new Map<string, string>()
    promises = {
      readdir: async (dirPath: string): Promise<string[]> => {
        const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`
        const entries = new Set<string>()
        for (const p of this.files.keys()) {
          if (p.startsWith(prefix)) {
            const rest = p.slice(prefix.length)
            if (rest && !rest.includes('/')) entries.add(rest)
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
  return { clone, pull, push, log, add, commit, FakeFS }
})

vi.mock('isomorphic-git', () => ({
  default: { clone: h.clone, pull: h.pull, push: h.push, log: h.log, add: h.add, commit: h.commit },
}))
vi.mock('isomorphic-git/http/web', () => ({ default: {} }))
vi.mock('@isomorphic-git/lightning-fs', () => ({ default: h.FakeFS }))
vi.mock('./pat', () => ({ getVaultPat: () => undefined, clearVaultPat: () => {} }))

import { GitTransport } from './transport'
import { appendHabitHit } from './habitsWrite'
import type { HabitHit } from './habits'

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
