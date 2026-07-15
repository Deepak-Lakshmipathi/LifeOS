/**
 * push — shared commit/push wrapper for the agent fleet (S57).
 *
 * Every scheduled agent (calendar-sync, email-triage, career/job-scout,
 * daily-brief, supervisor, finance) writes to its own path-partition of the
 * vault repo, but the repo itself is a single live git remote pushed to
 * concurrently. This wrapper is the ONE place that survives that: stage only
 * the files the caller names, commit, then `pull --rebase` + push with
 * jittered-backoff retry so a same-second collision from a sibling agent
 * doesn't need a human to unstick it.
 *
 * Design notes:
 * - `exec` is injectable (defaults to a real `git` child_process runner) so
 *   tests can simulate a rejected push without touching a live repo or the
 *   network — see push.test.mjs.
 * - Staging is explicit (`git add -- <files>`), never `git add -A`/`.`, so a
 *   stray dirty file elsewhere in the working tree is never swept into an
 *   agent's commit (agents run against a long-lived clone, not a fresh
 *   checkout).
 * - A push rejection (remote has commits we don't) is retryable: rebase and
 *   try again. Any other push failure (auth, network, etc.) is not — it's
 *   rethrown immediately so the caller's runLog sees the real cause instead
 *   of three padded-out retries of a non-retryable error.
 */

import { execFile } from 'node:child_process'

/** Substrings git prints on a rejected (non-fast-forward) push. */
const REJECT_SIGNATURES = [
  '[rejected]',
  'non-fast-forward',
  'fetch first',
  'failed to push some refs',
]

/**
 * Default `exec`: runs a real `git` subcommand via child_process, no shell.
 * Rejects with an Error carrying `.stdout`/`.stderr` (as Node's execFile
 * attaches on failure) so callers can inspect the git output.
 *
 * @param {string[]} args - argv after `git`, e.g. ['push'].
 * @param {{cwd: string}} opts
 */
function defaultExec(args, opts) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: opts.cwd }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout
        err.stderr = stderr
        reject(err)
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

/** Default `sleep`: a real timer. Tests inject a no-op/fast stand-in. */
function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** True if a push failure looks like a remote-ahead rejection (retryable). */
export function isRejection(err) {
  const text = `${err?.stderr ?? ''}\n${err?.message ?? ''}`
  return REJECT_SIGNATURES.some((sig) => text.includes(sig))
}

/** Full jitter backoff: random delay in [0, base * 2^(attempt-1)]. */
function backoffMs(attempt, baseDelayMs) {
  const cap = baseDelayMs * 2 ** (attempt - 1)
  return Math.floor(Math.random() * cap)
}

/**
 * Stage the named files, commit, and push — surviving concurrent writers to
 * the same remote via pull-rebase-retry.
 *
 * @param {string} repoDir - working-copy directory of the target repo clone.
 * @param {object} params
 * @param {string[]} params.files - paths (relative to repoDir) to stage.
 *   ONLY these are staged; nothing else in the working tree is touched.
 * @param {string} params.message - commit message.
 * @param {string} [params.author] - `"Name <email>"` passed through as
 *   `git commit --author=`. Omitted entirely if not given (falls back to the
 *   clone's configured identity).
 * @param {number} [params.maxAttempts=3] - total push attempts before giving
 *   up. Each rejected attempt (except the last) is followed by
 *   `pull --rebase` and a jittered backoff before retrying.
 * @param {number} [params.baseDelayMs=300] - backoff base, doubled per
 *   attempt (full jitter).
 * @param {(args: string[], opts: {cwd: string}) => Promise<{stdout: string, stderr: string}>} [params.exec]
 *   injectable git runner; defaults to a real `git` child_process call.
 * @param {(ms: number) => Promise<void>} [params.sleep] - injectable delay;
 *   defaults to a real timer.
 * @returns {Promise<{ok: true, attempts: number}>}
 * @throws if files is empty, if commit fails, or if every push attempt is
 *   rejected (error message names the repo dir and attempt count) or a push
 *   fails for a non-rejection reason (rethrown immediately, not retried).
 */
export async function commitAndPush(
  repoDir,
  {
    files,
    message,
    author,
    maxAttempts = 3,
    baseDelayMs = 300,
    exec = defaultExec,
    sleep = defaultSleep,
  },
) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('commitAndPush: files must be a non-empty array of paths to stage')
  }
  if (!message) {
    throw new Error('commitAndPush: message is required')
  }

  // Stage ONLY the listed files — never `add -A` / `add .`. A stray dirty
  // file elsewhere in the clone must never ride along in an agent's commit.
  await exec(['add', '--', ...files], { cwd: repoDir })

  const commitArgs = ['commit', '-m', message]
  if (author) commitArgs.push(`--author=${author}`)
  await exec(commitArgs, { cwd: repoDir })

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await exec(['push'], { cwd: repoDir })
      return { ok: true, attempts: attempt }
    } catch (err) {
      if (!isRejection(err)) {
        // Not a remote-ahead rejection (auth/network/etc.) — not retryable.
        // Wrap so the caller's runLog gets the actual git stderr, not just
        // execFile's generic "Command failed: git push".
        const wrapped = new Error(
          `commitAndPush: push to ${repoDir} failed (non-retryable): ${err.stderr || err.message}`,
        )
        wrapped.cause = err
        throw wrapped
      }
      if (attempt === maxAttempts) {
        throw new Error(
          `commitAndPush: push to ${repoDir} rejected on all ${maxAttempts} attempts ` +
            `(remote kept moving faster than the rebase-retry loop) — giving up. ` +
            `Last git error: ${err.stderr || err.message}`,
        )
      }
      await sleep(backoffMs(attempt, baseDelayMs))
      await exec(['pull', '--rebase'], { cwd: repoDir })
    }
  }

  // Unreachable (loop always returns or throws), but keeps the function's
  // static return type honest.
  throw new Error(`commitAndPush: exhausted ${maxAttempts} attempts without success or a thrown error`)
}
