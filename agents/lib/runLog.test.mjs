/**
 * runLog.test.mjs — S47 writer-side coverage for agents/lib/runLog.mjs.
 *
 * Exercises the real filesystem (a throwaway dir under the OS tmpdir) rather
 * than mocking node:fs — logRun's whole job is "the bytes on disk are correct",
 * and the files are tiny, so a real write is the honest test. Each test uses a
 * fresh unique dir and cleans up after itself.
 *
 * The cross-module roundtrip (write here → parse via agentStatus.ts) lives in
 * src/vault/agentStatus.test.ts (DoD #1); this file proves the writer mechanics
 * in isolation: append vs overwrite, dir creation, field shaping.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { logRun } from './runLog.mjs'

let vaultDir

beforeEach(() => {
  vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-runlog-'))
})
afterEach(() => {
  rmSync(vaultDir, { recursive: true, force: true })
})

/** Read runs.jsonl back as an array of parsed objects. */
function readRuns(agent) {
  const p = join(vaultDir, 'agents', agent, 'runs.jsonl')
  return readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
}

/** Read status.json back as a parsed object. */
function readStatus(agent) {
  const p = join(vaultDir, 'agents', agent, 'status.json')
  return JSON.parse(readFileSync(p, 'utf8'))
}

describe('logRun — directory creation', () => {
  it('creates agents/<name>/ on the first run of a brand-new agent', () => {
    logRun(vaultDir, 'email-triage', {
      ok: true,
      note: '4 flagged',
      duration_ms: 8200,
      cadence: 60,
      ts: '2026-07-14T09:30:00Z',
    })
    expect(existsSync(join(vaultDir, 'agents', 'email-triage', 'runs.jsonl'))).toBe(true)
    expect(existsSync(join(vaultDir, 'agents', 'email-triage', 'status.json'))).toBe(true)
  })
})

describe('logRun — runs.jsonl append semantics', () => {
  it('appends one line per run, never overwriting earlier lines', () => {
    logRun(vaultDir, 'calendar-sync', { ok: true, note: 'run 1', ts: '2026-07-14T06:00:00Z' })
    logRun(vaultDir, 'calendar-sync', { ok: false, note: 'run 2', ts: '2026-07-14T07:00:00Z' })
    logRun(vaultDir, 'calendar-sync', { ok: true, note: 'run 3', ts: '2026-07-14T08:00:00Z' })

    const runs = readRuns('calendar-sync')
    expect(runs).toHaveLength(3)
    expect(runs.map((r) => r.note)).toEqual(['run 1', 'run 2', 'run 3'])
    expect(runs.map((r) => r.ok)).toEqual([true, false, true])
  })

  it('writes newline-terminated lines (so a mid-append crash truncates only the tail)', () => {
    logRun(vaultDir, 'a', { ok: true, ts: '2026-07-14T06:00:00Z' })
    logRun(vaultDir, 'a', { ok: true, ts: '2026-07-14T07:00:00Z' })
    const raw = readFileSync(join(vaultDir, 'agents', 'a', 'runs.jsonl'), 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
    expect(raw.split('\n').filter((l) => l).length).toBe(2)
  })

  it('omits optional fields from the jsonl record when not provided', () => {
    logRun(vaultDir, 'lean', { ok: true, ts: '2026-07-14T06:00:00Z' })
    const [run] = readRuns('lean')
    expect(run).toEqual({ ts: '2026-07-14T06:00:00Z', ok: true })
    expect('note' in run).toBe(false)
    expect('duration_ms' in run).toBe(false)
  })
})

describe('logRun — status.json overwrite semantics', () => {
  it('overwrites status.json so it always reflects only the LATEST run', () => {
    logRun(vaultDir, 'calendar-sync', { ok: true, note: 'old', ts: '2026-07-14T06:00:00Z' })
    logRun(vaultDir, 'calendar-sync', {
      ok: false,
      note: 'newest',
      duration_ms: 500,
      cadence: 60,
      ts: '2026-07-14T09:00:00Z',
    })

    const status = readStatus('calendar-sync')
    expect(status).toEqual({
      agent: 'calendar-sync',
      last_run: '2026-07-14T09:00:00Z',
      ok: false,
      note: 'newest',
      duration_ms: 500,
      expected_cadence_min: 60,
    })
  })

  it('carries agent name + cadence into status.json (self-describing for the health board)', () => {
    logRun(vaultDir, 'job-scout', { ok: true, cadence: 1440, ts: '2026-07-14T09:00:00Z' })
    const status = readStatus('job-scout')
    expect(status.agent).toBe('job-scout')
    expect(status.expected_cadence_min).toBe(1440)
  })
})

describe('logRun — argument validation', () => {
  it('throws when vaultDir is missing', () => {
    expect(() => logRun('', 'a', { ok: true })).toThrow(/vaultDir/)
  })
  it('throws when agent is missing', () => {
    expect(() => logRun(vaultDir, '', { ok: true })).toThrow(/agent/)
  })
  it('throws when ok is not a boolean (a run must declare success or failure)', () => {
    expect(() => logRun(vaultDir, 'a', {})).toThrow(/ok must be a boolean/)
  })
})

describe('logRun — return value', () => {
  it('returns the paths and objects it wrote (for the caller commit stage + assertions)', () => {
    const result = logRun(vaultDir, 'email-triage', {
      ok: true,
      note: 'ok',
      duration_ms: 100,
      cadence: 60,
      ts: '2026-07-14T09:30:00Z',
    })
    expect(result.runsPath).toContain('runs.jsonl')
    expect(result.statusPath).toContain('status.json')
    expect(result.status.agent).toBe('email-triage')
    expect(result.run.ts).toBe('2026-07-14T09:30:00Z')
  })
})
