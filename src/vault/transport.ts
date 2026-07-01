/**
 * VaultTransport — transport interface + git implementation (S14, ADR-0009).
 *
 * The interface decouples the parser (parseVault.ts) from concrete I/O.
 * The parser never imports this module — transport is behind the seam.
 *
 * Git implementation:
 *   Clones or pulls the vault repo into an IndexedDB-backed virtual FS
 *   via isomorphic-git + @isomorphic-git/lightning-fs, then reads all
 *   *.md files under the 7 canonical domain folders.
 *
 * All isomorphic-git / lightning-fs imports are deferred to readFiles()
 * so that importing this module in tests never triggers browser-only side
 * effects (IndexedDB, etc.) — only the DOMAINS constant is loaded eagerly.
 *
 * Environment config (Vite env vars):
 *   VITE_VAULT_REPO_URL   — remote repository URL (required)
 *   VITE_VAULT_CORS_PROXY — CORS proxy URL (optional)
 *   VITE_VAULT_PAT        — read-only fine-grained PAT (optional; NEVER logged)
 *
 * Offline behavior (ADR-0003):
 *   If neither pull nor clone succeeds (e.g. no network), the error
 *   propagates to VaultSync.list(), which the UI surfaces as an empty
 *   task list or loading error.  Cached data from a previous clone
 *   remains in IndexedDB and could be read on a future call.
 */

import { DOMAINS } from '../data/domains'

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * The only contract the rest of the app depends on.
 * VaultSync and unit tests program to this interface — never to GitTransport.
 */
export interface VaultTransport {
  readFiles(): Promise<{ path: string; content: string }[]>
  /**
   * Write (create or overwrite) a vault file and commit the change (S15a).
   *
   * @param path    - Relative vault path, e.g. `Growth/Reading.md`.
   * @param content - Full file content to write (UTF-8 string).
   * @param message - Commit message for the git commit (S15b wires this up).
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
 * fails (force-push, corrupted FS, etc.) the FS is wiped and re-cloned.
 */
export class GitTransport implements VaultTransport {
  // Lazily initialised on first call to readFiles()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fs: any = null

  async readFiles(): Promise<{ path: string; content: string }[]> {
    // ── Lazy-load browser-only dependencies ─────────────────────────────────
    // Dynamic imports ensure no top-level side effects when this module is
    // imported in test environments where isomorphic-git / lightning-fs are
    // not needed (VITE_VAULT is unset, so readFiles() is never called).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [{ default: git }, { default: http }, { default: LightningFS }]: [any, any, any] =
      await Promise.all([
        import('isomorphic-git'),
        import('isomorphic-git/http/web'),
        import('@isomorphic-git/lightning-fs'),
      ])

    // ── Initialise FS on first call ──────────────────────────────────────────
    if (this.fs === null) {
      this.fs = new LightningFS(FS_NAME)
    }

    const url = import.meta.env.VITE_VAULT_REPO_URL as string | undefined
    const corsProxy = import.meta.env.VITE_VAULT_CORS_PROXY as string | undefined
    const pat = import.meta.env.VITE_VAULT_PAT as string | undefined

    if (!url) throw new Error('VITE_VAULT_REPO_URL is not configured')

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

    // ── Attempt pull first; fall back to fresh clone on any failure ──────────
    let needsClone = false
    try {
      await git.pull({ ...sharedOpts, fastForwardOnly: true })
    } catch {
      needsClone = true
    }

    if (needsClone) {
      // Wipe the virtual FS and re-clone from scratch
      this.fs = new LightningFS(FS_NAME, { wipe: true })
      await git.clone({
        ...sharedOpts,
        fs: this.fs,
        depth: 1,
      })
    }

    // ── Read *.md files under each canonical domain folder ───────────────────
    const result: { path: string; content: string }[] = []
    const pfs = this.fs.promises

    for (const domain of DOMAINS) {
      let entries: string[]
      try {
        entries = await pfs.readdir(`${DIR}/${domain}`)
      } catch {
        // Domain folder absent in this vault — skip silently
        continue
      }

      for (const entry of (entries as string[])) {
        if (!entry.endsWith('.md')) continue
        const relPath = `${domain}/${entry}`
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
   * Write a file back to the vault repo (S15b).
   *
   * Real git commit + push is deferred to S15b; this stub keeps the
   * VaultTransport interface satisfied so VaultSync can be unit-tested
   * against a fake transport without ever reaching GitTransport at runtime
   * (VITE_VAULT is off by default — GitTransport is never constructed in MVP).
   */
  async writeFile(_path: string, _content: string, _message: string): Promise<void> {
    throw new Error('not implemented until S15b')
  }
}
