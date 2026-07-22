/**
 * vaultTransport.test — Node git transport tests (S16c).
 *
 * CI-verifiable slice of the HITL split (see README.md / PR body): these
 * tests exercise the transport's LOCAL git logic (a real isomorphic-git repo
 * on a temp directory, no live network) — commit-lands, offline-commit-
 * survives (push to an unreachable/invalid remote is swallowed), and the
 * wipe-guard (refuses to wipe-reclone when local commits are unpushed and
 * pull fails, the S15b "must-fix transport hazard"). The actual
 * clone/pull/push against the REAL vault repo with the REAL BOT_VAULT_PAT
 * is NOT CI-verifiable (no remote/network in CI) and is covered by the
 * owner hand-verify checklist instead.
 *
 * `.invalid` is a reserved TLD (RFC 2606) that always fails DNS resolution —
 * used as a deterministic stand-in for "unreachable remote" regardless of
 * whether the CI runner actually has internet access.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import nodeFs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import git from 'isomorphic-git'
import { NodeVaultTransport, scanVaultFiles } from './vaultTransport'

const UNREACHABLE_URL = 'https://example.invalid/no-such-vault.git'

let repoDir: string

beforeEach(() => {
  repoDir = nodeFs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-bot-vault-test-'))
})

afterEach(() => {
  nodeFs.rmSync(repoDir, { recursive: true, force: true })
})

/** Inits a plain local repo (no remote configured yet) at `dir`, mirroring an already-cloned working copy. */
async function initLocalRepo(dir: string): Promise<void> {
  await git.init({ fs: nodeFs, dir, defaultBranch: 'main' })
}

describe('NodeVaultTransport.writeFile', () => {
  it('commits the new file locally (commit-lands)', async () => {
    await initLocalRepo(repoDir)
    const transport = new NodeVaultTransport({ repoUrl: UNREACHABLE_URL, dir: repoDir })

    await transport.writeFile('Inbox/Inbox.md', '- [ ] Test task id:: abc123\n', 'add task: Test task')

    expect(nodeFs.readFileSync(path.join(repoDir, 'Inbox/Inbox.md'), 'utf8')).toBe(
      '- [ ] Test task id:: abc123\n',
    )

    const log = await git.log({ fs: nodeFs, dir: repoDir, depth: 1 })
    expect(log).toHaveLength(1)
    expect(log[0].commit.message).toBe('add task: Test task\n')
    expect(log[0].commit.author.name).toBe('LifeOS Bot')
  })

  it('survives an unreachable remote — the commit stays local when push fails (offline-commit-survives)', async () => {
    await initLocalRepo(repoDir)
    const transport = new NodeVaultTransport({ repoUrl: UNREACHABLE_URL, dir: repoDir })

    // Push to a `.invalid` host always fails — writeFile must not throw and
    // must not lose the local commit (best-effort push, local-authoritative
    // commit — mirrors GitTransport.writeFile, S15b).
    await expect(
      transport.writeFile('Career/Inbox.md', '- [ ] Offline task\n', 'add task: Offline task'),
    ).resolves.toBeUndefined()

    const log = await git.log({ fs: nodeFs, dir: repoDir, depth: 1 })
    expect(log[0].commit.message).toBe('add task: Offline task\n')
  })

  it('mkdir -p creates missing parent directories before writing', async () => {
    await initLocalRepo(repoDir)
    const transport = new NodeVaultTransport({ repoUrl: UNREACHABLE_URL, dir: repoDir })

    await transport.writeFile('Growth/NewProject.md', '- [ ] Read a book\n', 'add task: Read a book')

    expect(nodeFs.existsSync(path.join(repoDir, 'Growth'))).toBe(true)
    expect(nodeFs.readFileSync(path.join(repoDir, 'Growth/NewProject.md'), 'utf8')).toBe(
      '- [ ] Read a book\n',
    )
  })

  it('appends a second commit on a second write to the same file, without disturbing the first', async () => {
    await initLocalRepo(repoDir)
    const transport = new NodeVaultTransport({ repoUrl: UNREACHABLE_URL, dir: repoDir })

    await transport.writeFile('Inbox/Inbox.md', '- [ ] First\n', 'add task: First')
    await transport.writeFile('Inbox/Inbox.md', '- [ ] First\n- [ ] Second\n', 'add task: Second')

    expect(nodeFs.readFileSync(path.join(repoDir, 'Inbox/Inbox.md'), 'utf8')).toBe(
      '- [ ] First\n- [ ] Second\n',
    )
    const log = await git.log({ fs: nodeFs, dir: repoDir })
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})

describe('NodeVaultTransport.readFiles — wipe-reclone data-loss guard (S15b hazard, ported to Node)', () => {
  it('refuses to wipe when local commits are unpushed and pull fails', async () => {
    await initLocalRepo(repoDir)
    // Simulate an existing local, never-pushed commit (the offline queue) —
    // no remote tracking ref exists, so countCommitsAhead can't prove safety.
    nodeFs.mkdirSync(path.join(repoDir, 'Inbox'), { recursive: true })
    nodeFs.writeFileSync(path.join(repoDir, 'Inbox/Inbox.md'), '- [ ] Unpushed\n', 'utf8')
    await git.add({ fs: nodeFs, dir: repoDir, filepath: 'Inbox/Inbox.md' })
    await git.commit({
      fs: nodeFs,
      dir: repoDir,
      message: 'add task: Unpushed',
      author: { name: 'LifeOS Bot', email: 'noreply@lifeos' },
    })

    const transport = new NodeVaultTransport({ repoUrl: UNREACHABLE_URL, dir: repoDir })

    await expect(transport.readFiles()).rejects.toThrowError(/refusing to wipe/)

    // The local repo + unpushed commit must NOT have been wiped.
    expect(nodeFs.existsSync(path.join(repoDir, '.git'))).toBe(true)
    const log = await git.log({ fs: nodeFs, dir: repoDir, depth: 1 })
    expect(log[0].commit.message).toBe('add task: Unpushed\n')
  })

  it('propagates an error when neither pull nor clone can succeed against an unreachable remote (no local work to lose)', async () => {
    // Fresh, never-initialized directory — nothing ahead of origin, so the
    // transport is safe to attempt a wipe-reclone, but the clone itself
    // still fails against an unreachable remote and that failure surfaces
    // to the caller (matches GitTransport's documented offline behavior).
    const transport = new NodeVaultTransport({ repoUrl: UNREACHABLE_URL, dir: repoDir })

    await expect(transport.readFiles()).rejects.toBeTruthy()
  })
})

describe('NodeVaultTransport.readFiles — shallow, single-branch clone (S56 DoD #1)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('clones with depth:1 and singleBranch:true when a fresh clone is needed', async () => {
    // Spy on the shared isomorphic-git singleton (the transport dynamic-imports
    // the SAME module object). Force the clone path: pull fails → needs clone;
    // push fails (swallowed); log fails → ahead-count 0 → safe to clone.
    const cloneSpy = vi.spyOn(git, 'clone').mockResolvedValue(undefined as never)
    vi.spyOn(git, 'pull').mockRejectedValue(new Error('no pull'))
    vi.spyOn(git, 'push').mockRejectedValue(new Error('no push'))
    vi.spyOn(git, 'log').mockRejectedValue(new Error('no local repo'))

    // Fresh, empty repoDir → scanVaultFiles returns [] after the (mocked) clone.
    const transport = new NodeVaultTransport({ repoUrl: UNREACHABLE_URL, dir: repoDir })
    const files = await transport.readFiles()

    expect(files).toEqual([])
    expect(cloneSpy).toHaveBeenCalledTimes(1)

    const opts = cloneSpy.mock.calls[0]![0] as Record<string, unknown>
    expect(opts).toMatchObject({
      depth: 1,
      singleBranch: true,
      dir: repoDir,
      url: UNREACHABLE_URL,
    })
  })
})

describe('scanVaultFiles', () => {
  it('reads *.md files under domain folders + Inbox, skips non-md files and missing folders', () => {
    nodeFs.mkdirSync(path.join(repoDir, 'Career'), { recursive: true })
    nodeFs.writeFileSync(path.join(repoDir, 'Career/Inbox.md'), '- [ ] Career task\n', 'utf8')
    nodeFs.writeFileSync(path.join(repoDir, 'Career/notes.txt'), 'not a task file', 'utf8')

    nodeFs.mkdirSync(path.join(repoDir, 'Inbox'), { recursive: true })
    nodeFs.writeFileSync(path.join(repoDir, 'Inbox/Inbox.md'), '- [ ] Domain-less task\n', 'utf8')
    // 'Growth' and the other 5 domain folders are absent entirely — must not throw.

    const files = scanVaultFiles(repoDir)

    expect(files).toEqual(
      expect.arrayContaining([
        { path: 'Career/Inbox.md', content: '- [ ] Career task\n' },
        { path: 'Inbox/Inbox.md', content: '- [ ] Domain-less task\n' },
      ]),
    )
    expect(files.find((f) => f.path === 'Career/notes.txt')).toBeUndefined()
  })

  it('returns an empty array when no domain folders exist at all', () => {
    expect(scanVaultFiles(repoDir)).toEqual([])
  })
})
