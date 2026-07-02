/**
 * vaultTransport — Node-side VaultTransport implementation (S16c, ADR-0011).
 *
 * Implements the existing VaultTransport interface (src/vault/transport.ts —
 * unmodified; the interface is reused, not the browser-facing GitTransport
 * class, which is IndexedDB/lightning-fs-backed and doesn't exist in Node).
 *
 * This is the SAME commit/push discipline GitTransport.writeFile established
 * in S15b, ported to a real Node filesystem + isomorphic-git/http/node
 * instead of lightning-fs + isomorphic-git/http/web:
 *   - readFiles(): pull (fast-forward only); on failure, best-effort push any
 *     local commits, then only wipe-and-reclone when nothing local is ahead
 *     of origin (the S15b "must-fix transport hazard" — a plain wipe would
 *     silently destroy committed offline writes). First boot has no local
 *     clone yet, so the same pull-fails -> nothing-ahead -> clone path
 *     naturally performs the initial shallow, single-branch clone.
 *   - writeFile(): mkdir -p any missing parent directories, git.add, a
 *     LOCAL-AUTHORITATIVE git.commit (always succeeds offline against the
 *     full local clone), then a best-effort git.push (failure swallowed —
 *     offline / non-fast-forward — the unpushed commit stays as the retry
 *     queue, exactly as GitTransport's does; no separate queue infra).
 *
 * Auth: BOT_VAULT_PAT (distinct from the PWA's VITE_VAULT_PAT — ADR-0011 §2),
 * flows into isomorphic-git's onAuth callback only, never logged.
 *
 * isomorphic-git is loaded lazily inside loadGit() so importing this module
 * has no side effects in environments that never call readFiles()/writeFile()
 * (mirrors GitTransport's lazy dynamic import).
 */

import nodeFs from 'node:fs'
import path from 'node:path'
import type { VaultTransport } from '../../src/vault/transport'
import { DOMAINS } from '../../src/data/domains'

export interface NodeVaultTransportOptions {
  /** Vault repo remote URL (e.g. https://github.com/<owner>/<vault-repo>.git). */
  repoUrl: string
  /** Fine-grained GitHub PAT, Contents: Read+Write, scoped to the vault repo (BOT_VAULT_PAT). Never logged. */
  pat?: string
  /**
   * Local working-copy directory. Stays warm across messages (ADR-0011
   * Decision 1 — the whole point of the long-poll-worker runtime: the clone
   * is NOT re-created per message).
   */
  dir: string
}

/** Reads *.md files under each canonical domain folder + top-level Inbox (S15b). Pure sync FS scan — no git. */
export function scanVaultFiles(dir: string): { path: string; content: string }[] {
  const result: { path: string; content: string }[] = []

  for (const folder of [...DOMAINS, 'Inbox']) {
    let entries: string[]
    try {
      entries = nodeFs.readdirSync(path.join(dir, folder))
    } catch {
      // Folder absent in this vault — skip silently
      continue
    }

    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue
      const relPath = `${folder}/${entry}`
      try {
        const content = nodeFs.readFileSync(path.join(dir, relPath), 'utf8')
        result.push({ path: relPath, content })
      } catch {
        // Unreadable file — skip gracefully (ADR-0003: never throw in transport)
      }
    }
  }

  return result
}

/** Git author stamped on every bot commit — distinct from GitTransport's 'LifeOS PWA' (S15b). */
const BOT_AUTHOR = { name: 'LifeOS Bot', email: 'noreply@lifeos' }

export class NodeVaultTransport implements VaultTransport {
  constructor(private readonly opts: NodeVaultTransportOptions) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async loadGit(): Promise<{ git: any; sharedOpts: any }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [{ default: git }, { default: http }]: [any, any] = await Promise.all([
      import('isomorphic-git'),
      import('isomorphic-git/http/node'),
    ])

    const { repoUrl, pat, dir } = this.opts
    if (!repoUrl) throw new Error('BOT_VAULT_REPO_URL is not configured')

    // Auth callback — PAT is never written to logs or console
    const onAuth = pat ? () => ({ username: 'x-access-token', password: pat }) : undefined

    const sharedOpts = {
      fs: nodeFs,
      http,
      dir,
      url: repoUrl,
      singleBranch: true,
      ...(onAuth ? { onAuth } : {}),
    }

    return { git, sharedOpts }
  }

  async readFiles(): Promise<{ path: string; content: string }[]> {
    const { git, sharedOpts } = await this.loadGit()
    const { dir } = this.opts

    // ── Attempt pull first; fall back to fresh clone only when nothing to
    //    lose (must-fix transport hazard, S15b/ADR-0010) ───────────────────
    let needsClone = false
    try {
      await git.pull({ ...sharedOpts, fastForwardOnly: true })
    } catch {
      needsClone = true
    }

    if (needsClone) {
      // Before nuking the local working copy, try to push any local commits
      // that haven't made it to origin — a wipe-reclone otherwise destroys
      // committed offline writes silently (ADR-0010 "must-fix hazard").
      try {
        await git.push(sharedOpts)
      } catch {
        // Push failed (offline / diverged / no repo yet) — fall through to
        // check the ahead-count.
      }

      let commitsAhead = 0
      try {
        commitsAhead = await this.countCommitsAhead(git, sharedOpts)
      } catch {
        // Can't determine ahead-count (e.g. no local repo yet) — treat as 0,
        // safe to (re)clone since there's nothing we know of to lose.
        commitsAhead = 0
      }

      if (commitsAhead > 0) {
        // Unpushed local work exists and push just failed — do NOT wipe.
        // Surface the pull failure so the caller can retry later instead of
        // silently discarding offline commits.
        throw new Error('vault pull failed and local commits are unpushed; refusing to wipe')
      }

      // Nothing ahead of origin — safe to wipe and re-clone from scratch.
      nodeFs.rmSync(dir, { recursive: true, force: true })
      nodeFs.mkdirSync(dir, { recursive: true })
      await git.clone({ ...sharedOpts, depth: 1 })
    }

    return scanVaultFiles(dir)
  }

  /**
   * Number of local HEAD commits not reachable from the remote tracking
   * branch — i.e. commits that would be lost by a wipe-reclone. Returns 0
   * when there's no local repo yet, or local and remote are level/behind.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async countCommitsAhead(git: any, sharedOpts: any): Promise<number> {
    const local = await git.log({ fs: sharedOpts.fs, dir: sharedOpts.dir, depth: 250 })
    const localOids = new Set(local.map((c: { oid: string }) => c.oid))

    let remoteHead: string | undefined
    try {
      remoteHead = await git.resolveRef({
        fs: sharedOpts.fs,
        dir: sharedOpts.dir,
        ref: `remotes/origin/${(await git.currentBranch({ fs: sharedOpts.fs, dir: sharedOpts.dir })) ?? 'main'}`,
      })
    } catch {
      remoteHead = undefined
    }

    // Remote ref unknown — can't prove local commits are safe on origin;
    // treat any local history as "ahead" so the caller refuses to wipe.
    if (!remoteHead) return localOids.size

    return remoteHead && localOids.has(remoteHead)
      ? local.findIndex((c: { oid: string }) => c.oid === remoteHead)
      : localOids.size
  }

  /**
   * Write (create or overwrite) a file in the vault repo and commit the
   * change. The commit is local-first and authoritative — it always
   * succeeds offline against the full local clone. Push is best-effort: on
   * failure (offline / non-fast-forward divergence) the error is swallowed
   * and the commit stays local, to be retried on the next mutation or
   * refresh (git's native queue — no separate queue infra).
   */
  async writeFile(filePath: string, content: string, message: string): Promise<void> {
    const { git, sharedOpts } = await this.loadGit()
    const { dir } = this.opts

    // ── mkdir -p for any missing parent directories ──────────────────────
    const relDir = filePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
    if (relDir) {
      nodeFs.mkdirSync(path.join(dir, relDir), { recursive: true })
    }

    nodeFs.writeFileSync(path.join(dir, filePath), content, 'utf8')

    await git.add({ fs: nodeFs, dir, filepath: filePath })
    await git.commit({
      fs: nodeFs,
      dir,
      message,
      author: BOT_AUTHOR,
    })

    // Best-effort push — never let a push failure surface as a mutation
    // failure; the local commit already resolved the write.
    try {
      await git.push(sharedOpts)
    } catch {
      // Offline / non-fast-forward — commit stays local, retried later.
    }
  }
}
