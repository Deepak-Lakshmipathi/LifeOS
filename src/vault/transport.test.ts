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
  // Minimal lightning-fs stand-in: every domain dir is absent, so readFiles()
  // returns [] after the clone (the read loop swallows readdir failures).
  class FakeFS {
    promises = {
      readdir: vi.fn().mockRejectedValue(new Error('absent')),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    }
  }
  return { clone, pull, push, log, FakeFS }
})

vi.mock('isomorphic-git', () => ({
  default: { clone: h.clone, pull: h.pull, push: h.push, log: h.log },
}))
vi.mock('isomorphic-git/http/web', () => ({ default: {} }))
vi.mock('@isomorphic-git/lightning-fs', () => ({ default: h.FakeFS }))
vi.mock('./pat', () => ({ getVaultPat: () => undefined, clearVaultPat: () => {} }))

import { GitTransport } from './transport'

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
