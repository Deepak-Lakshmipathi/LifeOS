/**
 * push.test.mjs — S57 DoD coverage for agents/lib/push.mjs.
 *
 * Every test injects a mock `exec` (and a no-op `sleep`) so nothing here
 * touches a live git binary, a real repo, or the network — the wrapper's
 * `exec`/`sleep` injection points exist specifically for this.
 */
import { describe, it, expect, vi } from 'vitest'
import { commitAndPush } from './push.mjs'

const REPO_DIR = '/fake/vault-clone'

/** No-op sleep — skips real backoff delay in tests. */
const noSleep = () => Promise.resolve()

/** Builds a rejected-push error shaped like a real git non-fast-forward reject. */
function rejectedPushError() {
  const err = new Error('Command failed: git push')
  err.stderr =
    '! [rejected]        main -> main (fetch first)\n' +
    "error: failed to push some refs to 'https://github.com/example/vault.git'\n"
  return err
}

describe('commitAndPush — staging isolation', () => {
  it('stages ONLY the listed files, never the whole working tree', async () => {
    const calls = []
    const exec = vi.fn(async (args) => {
      calls.push(args)
      return { stdout: '', stderr: '' }
    })

    await commitAndPush(REPO_DIR, {
      files: ['Calendar/2026-07-14.md'],
      message: 'sync: 2026-07-14',
      author: 'calendar-sync-agent <agents+calendar@lifeos.local>',
      exec,
      sleep: noSleep,
    })

    const addCall = calls.find((c) => c[0] === 'add')
    expect(addCall).toEqual(['add', '--', 'Calendar/2026-07-14.md'])
    // Never a blanket stage — a stray dirty file elsewhere in the clone
    // (e.g. left over from another agent's partial work) must not ride along.
    expect(addCall).not.toContain('-A')
    expect(addCall).not.toContain('.')
  })

  it('stages exactly a multi-file list, in order, none implied', async () => {
    const calls = []
    const exec = vi.fn(async (args) => {
      calls.push(args)
      return { stdout: '', stderr: '' }
    })

    await commitAndPush(REPO_DIR, {
      files: ['Career/roles.md', 'Career/pipeline.md'],
      message: 'career: update pipeline',
      exec,
      sleep: noSleep,
    })

    const addCall = calls.find((c) => c[0] === 'add')
    expect(addCall).toEqual(['add', '--', 'Career/roles.md', 'Career/pipeline.md'])
  })

  it('rejects up front on an empty file list rather than falling back to add -A', async () => {
    const exec = vi.fn()
    await expect(
      commitAndPush(REPO_DIR, { files: [], message: 'oops', exec, sleep: noSleep }),
    ).rejects.toThrow(/non-empty array/)
    expect(exec).not.toHaveBeenCalled()
  })
})

describe('commitAndPush — author passthrough', () => {
  it('flows the caller-provided author string into the commit call', async () => {
    const calls = []
    const exec = vi.fn(async (args) => {
      calls.push(args)
      return { stdout: '', stderr: '' }
    })

    await commitAndPush(REPO_DIR, {
      files: ['Mail/triage.md'],
      message: 'triage: inbox zero',
      author: 'email-triage-agent <agents+mail@lifeos.local>',
      exec,
      sleep: noSleep,
    })

    const commitCall = calls.find((c) => c[0] === 'commit')
    expect(commitCall).toContain('--author=email-triage-agent <agents+mail@lifeos.local>')
  })

  it('omits --author entirely when none is given (falls back to clone identity)', async () => {
    const calls = []
    const exec = vi.fn(async (args) => {
      calls.push(args)
      return { stdout: '', stderr: '' }
    })

    await commitAndPush(REPO_DIR, {
      files: ['Finance/ledger.md'],
      message: 'finance: sync',
      exec,
      sleep: noSleep,
    })

    const commitCall = calls.find((c) => c[0] === 'commit')
    expect(commitCall.some((a) => a.startsWith('--author='))).toBe(false)
  })
})

describe('commitAndPush — retry on rejected push', () => {
  it('rebases and retries once on a single rejection, then succeeds', async () => {
    const calls = []
    let pushAttempts = 0
    const exec = vi.fn(async (args) => {
      calls.push(args)
      if (args[0] === 'push') {
        pushAttempts += 1
        if (pushAttempts === 1) {
          throw rejectedPushError()
        }
        return { stdout: '', stderr: '' }
      }
      return { stdout: '', stderr: '' }
    })
    const sleep = vi.fn(noSleep)

    const result = await commitAndPush(REPO_DIR, {
      files: ['Calendar/2026-07-14.md'],
      message: 'sync: 2026-07-14',
      exec,
      sleep,
    })

    expect(result).toEqual({ ok: true, attempts: 2 })
    expect(pushAttempts).toBe(2)
    // rebase happened between the two push attempts
    const opOrder = calls.map((c) => c[0])
    const firstPush = opOrder.indexOf('push')
    const rebaseIdx = opOrder.indexOf('pull')
    expect(rebaseIdx).toBeGreaterThan(firstPush)
    expect(opOrder.lastIndexOf('push')).toBeGreaterThan(rebaseIdx)
    expect(calls.find((c) => c[0] === 'pull')).toEqual(['pull', '--rebase'])
    // backoff was invoked before the retry
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('retries through two rejections before succeeding on the third attempt', async () => {
    let pushAttempts = 0
    const exec = vi.fn(async (args) => {
      if (args[0] === 'push') {
        pushAttempts += 1
        if (pushAttempts < 3) throw rejectedPushError()
        return { stdout: '', stderr: '' }
      }
      return { stdout: '', stderr: '' }
    })

    const result = await commitAndPush(REPO_DIR, {
      files: ['Briefs/2026-07-14.md'],
      message: 'brief: daily',
      maxAttempts: 3,
      exec,
      sleep: noSleep,
    })

    expect(result).toEqual({ ok: true, attempts: 3 })
    expect(pushAttempts).toBe(3)
  })
})

describe('commitAndPush — retry exhaustion', () => {
  it('throws a clear, loud error after 3 consecutive rejections', async () => {
    let pushAttempts = 0
    const exec = vi.fn(async (args) => {
      if (args[0] === 'push') {
        pushAttempts += 1
        throw rejectedPushError()
      }
      return { stdout: '', stderr: '' }
    })

    await expect(
      commitAndPush(REPO_DIR, {
        files: ['Supervisor/proposals.md'],
        message: 'supervisor: weekly proposal',
        maxAttempts: 3,
        exec,
        sleep: noSleep,
      }),
    ).rejects.toThrow(/rejected on all 3 attempts/)

    expect(pushAttempts).toBe(3)
  })

  it('does not retry a non-rejection push failure (e.g. auth error) — rethrows immediately', async () => {
    let pushAttempts = 0
    const authError = new Error('Command failed: git push')
    authError.stderr = 'remote: Permission to example/vault.git denied.\nfatal: unable to access\n'

    const exec = vi.fn(async (args) => {
      if (args[0] === 'push') {
        pushAttempts += 1
        throw authError
      }
      return { stdout: '', stderr: '' }
    })

    await expect(
      commitAndPush(REPO_DIR, {
        files: ['Career/roles.md'],
        message: 'career: update',
        maxAttempts: 3,
        exec,
        sleep: noSleep,
      }),
    ).rejects.toThrow(/Permission/)

    // Fails fast on the first non-retryable error — no padded-out retries.
    expect(pushAttempts).toBe(1)
  })
})
