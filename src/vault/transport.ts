/**
 * VaultTransport — transport interface + git implementation (S14, ADR-0009).
 *
 * The interface decouples the parser (parseVault.ts) from concrete I/O.
 * The parser never imports this module — transport is behind the seam.
 *
 * Git implementation:
 *   Clones or pulls the vault repo into an IndexedDB-backed virtual FS
 *   via isomorphic-git + @isomorphic-git/lightning-fs, then reads all
 *   *.md files under the 7 canonical domain folders plus the top-level
 *   Inbox/ folder (S15b — home for domain-less/project-less writes),
 *   Habits/ folder (S32/#148 — habits.md + log.md, the append-only hit
 *   log appendHabitHit does read-modify-write against), Calendar/
 *   folder (S34/#151 — today.md, which TodayCard's live self-load reads
 *   via `files.find(f => f.path === 'Calendar/today.md')`), and Mail/
 *   folder (S37/#154 — attention.md, which AttentionCard's live self-load
 *   reads via `files.find(f => f.path === 'Mail/attention.md')`).
 *
 * All isomorphic-git / lightning-fs imports are deferred to readFiles()
 * so that importing this module in tests never triggers browser-only side
 * effects (IndexedDB, etc.) — only the DOMAINS constant is loaded eagerly.
 *
 * Environment config (Vite env vars):
 *   VITE_VAULT_REPO_URL   — remote repository URL (required)
 *   VITE_VAULT_CORS_PROXY — CORS proxy URL (optional)
 *   VITE_VAULT_PAT        — fine-grained PAT scoped to the single vault repo
 *                           with Contents: Read AND Write (S15b — write needs
 *                           push, not just clone/pull). Optional; NEVER logged.
 *
 * Offline behavior (ADR-0003):
 *   If neither pull nor clone succeeds (e.g. no network), the error
 *   propagates to VaultSync.list(), which the UI surfaces as an empty
 *   task list or loading error.  Cached data from a previous clone
 *   remains in IndexedDB and could be read on a future call.
 */

import { DOMAINS } from '../data/domains'
import { getVaultPat } from './pat'

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * The only contract the rest of the app depends on.
 * VaultSync and unit tests program to this interface — never to GitTransport.
 */
export interface VaultTransport {
  readFiles(): Promise<{ path: string; content: string }[]>
  /**
   * Write (create or overwrite) a vault file and commit the change
   * (interface: S15a; git implementation: S15b).
   *
   * @param path    - Relative vault path, e.g. `Growth/Reading.md`.
   * @param content - Full file content to write (UTF-8 string).
   * @param message - Commit message for the git commit.
   */
  writeFile(path: string, content: string, message: string): Promise<void>
}

// ─── Git implementation ────────────────────────────────────────────────────────

/** IndexedDB store name; changing this wipes all cached clone data. */
const FS_NAME = 'lifeos-vault'
/** Root directory inside the virtual FS where the repo is cloned. */
const DIR = '/vault'

/**
 * Git-as-transport implementation (ADR-0009).
 *
 * isomorphic-git and @isomorphic-git/lightning-fs are loaded lazily inside
 * readFiles() so this module can be imported without browser-only side effects
 * (e.g. in the Vitest jsdom environment where VITE_VAULT is not set).
 *
 * First call: shallow-clones the vault repo (depth=1, single branch) into an
 * in-browser IndexedDB FS.  Subsequent calls do a fast-forward pull; if that
 * fails (force-push, corrupted FS, etc.) the transport first tries to push
 * any local commits, then only wipes-and-reclones when nothing local is
 * ahead of origin — a plain wipe would otherwise silently destroy committed
 * offline writes (ADR-0010 "must-fix transport hazard").
 */
export class GitTransport implements VaultTransport {
  // Lazily initialised on first call to readFiles() / writeFile()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fs: any = null

  // In-flight readFiles() promise. App fires two list() calls on mount
  // (seedIfEmpty + useTasks) — without this, both run a git clone into the
  // same lightning-fs dir concurrently, race, and reject, hanging the app.
  private inflight: Promise<{ path: string; content: string }[]> | null = null

  /**
   * Lazy-load isomorphic-git / lightning-fs and build the options object
   * shared by every git operation (clone/pull/push). Dynamic imports ensure
   * no top-level side effects when this module is imported in test
   * environments where isomorphic-git / lightning-fs are not needed
   * (VITE_VAULT is unset, so neither readFiles() nor writeFile() is called).
   *
   * PAT is read from VITE_VAULT_PAT and flows into `onAuth` only — never
   * logged, never returned as a plain string.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async loadGit(): Promise<{ git: any; http: any; LightningFS: any; sharedOpts: any }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [{ default: git }, { default: http }, { default: LightningFS }]: [any, any, any] =
      await Promise.all([
        import('isomorphic-git'),
        import('isomorphic-git/http/web'),
        import('@isomorphic-git/lightning-fs'),
      ])

    // ── Validate config BEFORE touching the FS backend ───────────────────────
    // Constructing LightningFS kicks off its own internal async _init() that
    // the constructor never awaits (a real fire-and-forget promise chain
    // reaching into DefaultBackend, which references `navigator`). If this
    // transport is unconfigured (VITE_VAULT_REPO_URL unset — the default in
    // any environment/test that never stubs it), throwing here first means
    // that dangling init promise is never created in the first place, rather
    // than being created and then abandoned when the `!url` throw below
    // unwound the caller. A caller that swallows this error (e.g.
    // HabitsCard's self-load try/catch) would otherwise leave that promise
    // to settle later — potentially after its test's environment has torn
    // down — surfacing as an unhandled-rejection "navigator is not defined"
    // with no connection to the actual failing assertion.
    const url = import.meta.env.VITE_VAULT_REPO_URL as string | undefined
    const corsProxy = import.meta.env.VITE_VAULT_CORS_PROXY as string | undefined
    const pat = getVaultPat()

    if (!url) throw new Error('VITE_VAULT_REPO_URL is not configured')

    // ── Initialise FS on first call (only once we know we're configured) ────
    if (this.fs === null) {
      this.fs = new LightningFS(FS_NAME)
    }

    // Auth callback — PAT is never written to logs or console
    const onAuth = pat ? () => ({ username: 'x-access-token', password: pat }) : undefined

    const sharedOpts = {
      fs: this.fs,
      http,
      dir: DIR,
      url,
      ...(corsProxy ? { corsProxy } : {}),
      ...(onAuth ? { onAuth } : {}),
      singleBranch: true,
    }

    return { git, http, LightningFS, sharedOpts }
  }

  async readFiles(): Promise<{ path: string; content: string }[]> {
    // Collapse concurrent callers into a single clone/pull.
    if (this.inflight) return this.inflight
    this.inflight = this._readFiles().finally(() => {
      this.inflight = null
    })
    return this.inflight
  }

  private async _readFiles(): Promise<{ path: string; content: string }[]> {
    const { git, LightningFS, sharedOpts } = await this.loadGit()

    // ── Attempt pull first; fall back to fresh clone only when nothing to
    //    lose (must-fix transport hazard, ADR-0010) ───────────────────────────
    let needsClone = false
    try {
      await git.pull({ ...sharedOpts, fastForwardOnly: true })
    } catch {
      needsClone = true
    }

    if (needsClone) {
      // Before nuking local storage, try to push any local commits that
      // haven't made it to origin — a wipe-reclone otherwise destroys
      // committed offline writes silently (ADR-0010 "must-fix hazard").
      let commitsAhead = 0
      try {
        await git.push(sharedOpts)
      } catch {
        // Push failed (offline / diverged) — fall through to check ahead-count
      }

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
      this.fs = new LightningFS(FS_NAME, { wipe: true })
      await git.clone({
        ...sharedOpts,
        fs: this.fs,
        depth: 1,
      })
    }

    // ── Read *.md files under each canonical domain folder + top-level
    //    Inbox + Habits (S32/#148 — Habits/log.md must round-trip through
    //    the snapshot so appendHabitHit's read-modify-write sees prior hits
    //    instead of degrading to an overwrite) + Calendar (S34/#151 —
    //    today.md must round-trip so TodayCard's live self-load finds it
    //    instead of permanently rendering "No calendar data yet") + Mail
    //    (S37/#154 — attention.md must round-trip so AttentionCard's live
    //    self-load finds it instead of permanently rendering "Nothing needs
    //    you right now") ────────────────────────────────────────────────
    const result: { path: string; content: string }[] = []
    const pfs = this.fs.promises

    for (const folder of [...DOMAINS, 'Inbox', 'Habits', 'Calendar', 'Mail']) {
      let entries: string[]
      try {
        entries = await pfs.readdir(`${DIR}/${folder}`)
      } catch {
        // Folder absent in this vault — skip silently
        continue
      }

      for (const entry of (entries as string[])) {
        if (!entry.endsWith('.md')) continue
        const relPath = `${folder}/${entry}`
        try {
          const content = await pfs.readFile(`${DIR}/${relPath}`, { encoding: 'utf8' }) as string
          result.push({ path: relPath, content })
        } catch {
          // Unreadable file — skip gracefully (ADR-0003: never throw in transport)
        }
      }
    }

    return result
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
   * change (S15b, ADR-0010 §7). The commit is local-first and authoritative
   * — it always succeeds offline against the full local clone. Push is
   * best-effort: on failure (offline / non-fast-forward divergence) the
   * error is swallowed and the commit stays local, to be retried on the
   * next mutation or refresh (git's native queue — no separate queue infra).
   */
  async writeFile(path: string, content: string, message: string): Promise<void> {
    const { git, sharedOpts } = await this.loadGit()
    const pfs = this.fs.promises

    // ── mkdir -p for any missing parent directories ──────────────────────────
    const relDir = path.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
    if (relDir) {
      const segments = relDir.split('/')
      let acc = DIR
      for (const seg of segments) {
        acc = `${acc}/${seg}`
        try {
          await pfs.mkdir(acc)
        } catch {
          // Already exists — fine
        }
      }
    }

    await pfs.writeFile(`${DIR}/${path}`, content, { encoding: 'utf8' })

    await git.add({ fs: this.fs, dir: DIR, filepath: path })
    await git.commit({
      fs: this.fs,
      dir: DIR,
      message,
      author: { name: 'LifeOS PWA', email: 'noreply@lifeos' },
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
