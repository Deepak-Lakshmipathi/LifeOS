/**
 * agentStatus.test.ts — S47 PWA-side coverage for src/vault/agentStatus.ts.
 *
 * Covers all five DoD items:
 *   #1 roundtrip — writes via the real agents/lib/runLog.mjs helper, then parses
 *      the bytes back through parseStatus/parseRuns and asserts identical data
 *      (the cross-module contract test).
 *   #2 healthOf thresholds — every boundary of the 2×/4× cadence + ok:false +
 *      missing rules.
 *   #3 truncated jsonl — parseRuns survives a half-written final line.
 *   plus parseStatus tolerance and the fixtures under __fixtures__/agents/.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// The writer half is plain Node ESM — imported here to prove the cross-module
// contract (writer output parses cleanly on the PWA side).
import { logRun } from '../../agents/lib/runLog.mjs'
import { parseStatus, parseRuns, healthOf } from './agentStatus'

// vitest runs with cwd = project root; fixtures live at a fixed repo path.
const FIX = join(process.cwd(), 'src', 'vault', '__fixtures__', 'agents')
const readFix = (name: string) => readFileSync(join(FIX, name, 'status.json'), 'utf8')

// ── DoD #1: roundtrip write → parse → identical ──────────────────────────────
describe('roundtrip: runLog writer → agentStatus parser (DoD #1)', () => {
  let vaultDir: string
  beforeEach(() => {
    vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-roundtrip-'))
  })
  afterEach(() => {
    rmSync(vaultDir, { recursive: true, force: true })
  })

  it('status.json written by logRun parses back to identical data', () => {
    const written = logRun(vaultDir, 'email-triage', {
      ok: true,
      note: '4 flagged, 1 draft',
      duration_ms: 8200,
      cadence: 60,
      ts: '2026-07-14T09:30:00Z',
    })
    const raw = readFileSync(written.statusPath, 'utf8')
    const parsed = parseStatus(raw)
    expect(parsed).toEqual({
      agent: 'email-triage',
      last_run: '2026-07-14T09:30:00Z',
      ok: true,
      note: '4 flagged, 1 draft',
      duration_ms: 8200,
      expected_cadence_min: 60,
    })
  })

  it('runs.jsonl appended by logRun parses back to every run in order', () => {
    const w1 = logRun(vaultDir, 'calendar-sync', {
      ok: true,
      note: 'run 1',
      duration_ms: 100,
      ts: '2026-07-14T06:00:00Z',
    })
    logRun(vaultDir, 'calendar-sync', { ok: false, note: 'run 2', ts: '2026-07-14T07:00:00Z' })
    logRun(vaultDir, 'calendar-sync', { ok: true, note: 'run 3', ts: '2026-07-14T08:00:00Z' })

    const runs = parseRuns(readFileSync(w1.runsPath, 'utf8'))
    expect(runs).toEqual([
      { ts: '2026-07-14T06:00:00Z', ok: true, note: 'run 1', duration_ms: 100 },
      { ts: '2026-07-14T07:00:00Z', ok: false, note: 'run 2' },
      { ts: '2026-07-14T08:00:00Z', ok: true, note: 'run 3' },
    ])
  })

  it('the parsed status of a written run drives a green LED when fresh (writer→parser→health)', () => {
    const written = logRun(vaultDir, 'email-triage', {
      ok: true,
      cadence: 60,
      ts: '2026-07-14T09:30:00Z',
    })
    const status = parseStatus(readFileSync(written.statusPath, 'utf8'))
    // 10 minutes later — well within the 60-min cadence.
    const now = Date.parse('2026-07-14T09:40:00Z')
    expect(healthOf(status, now)).toBe('ok')
  })
})

// ── parseStatus tolerance ────────────────────────────────────────────────────
describe('parseStatus', () => {
  it('parses a well-formed status', () => {
    const s = parseStatus(readFix('good'))
    expect(s?.agent).toBe('email-triage')
    expect(s?.ok).toBe(true)
    expect(s?.expected_cadence_min).toBe(60)
  })

  it('returns null on a missing file (null/empty input)', () => {
    expect(parseStatus(null)).toBeNull()
    expect(parseStatus(undefined)).toBeNull()
    expect(parseStatus('')).toBeNull()
  })

  it('returns null on unparseable JSON rather than throwing', () => {
    expect(parseStatus('{ not json')).toBeNull()
  })

  it('returns null when a required field is missing or wrong-typed (never a false green)', () => {
    expect(parseStatus('{"last_run":"x","ok":true}')).toBeNull() // no agent
    expect(parseStatus('{"agent":"a","ok":true}')).toBeNull() // no last_run
    expect(parseStatus('{"agent":"a","last_run":"x"}')).toBeNull() // no ok
    expect(parseStatus('{"agent":"a","last_run":"x","ok":"yes"}')).toBeNull() // ok not bool
    expect(parseStatus('"a string"')).toBeNull()
    expect(parseStatus('null')).toBeNull()
  })

  it('drops optional fields that are the wrong type but keeps the core', () => {
    const s = parseStatus('{"agent":"a","last_run":"x","ok":true,"duration_ms":"nope"}')
    expect(s).toEqual({ agent: 'a', last_run: 'x', ok: true })
  })
})

// ── DoD #2: healthOf thresholds (all boundaries) ─────────────────────────────
describe('healthOf thresholds (DoD #2)', () => {
  const cadence = 60 // minutes
  const min = 60_000
  const base = Date.parse('2026-07-14T00:00:00Z')
  const status = (overrides: Partial<ReturnType<typeof parseStatus>> = {}) => ({
    agent: 'a',
    last_run: '2026-07-14T00:00:00Z',
    ok: true,
    expected_cadence_min: cadence,
    ...overrides,
  })

  it('missing status → idle', () => {
    expect(healthOf(null, base)).toBe('idle')
  })

  it('ok run within cadence → ok', () => {
    expect(healthOf(status(), base + 30 * min)).toBe('ok') // 0.5× cadence
    expect(healthOf(status(), base + cadence * min)).toBe('ok') // exactly 1×
  })

  it('exactly 2× cadence → still ok (boundary is strictly greater-than)', () => {
    expect(healthOf(status(), base + 2 * cadence * min)).toBe('ok')
  })

  it('just past 2× cadence → amber', () => {
    expect(healthOf(status(), base + 2 * cadence * min + 1)).toBe('amber')
    expect(healthOf(status(), base + 3 * cadence * min)).toBe('amber')
  })

  it('exactly 4× cadence → still amber (boundary is strictly greater-than)', () => {
    expect(healthOf(status(), base + 4 * cadence * min)).toBe('amber')
  })

  it('just past 4× cadence → red', () => {
    expect(healthOf(status(), base + 4 * cadence * min + 1)).toBe('red')
  })

  it('ok:false → red regardless of freshness (a failed run is never green)', () => {
    expect(healthOf(status({ ok: false }), base)).toBe('red') // brand new but failed
    expect(healthOf(status({ ok: false }), base + 1 * min)).toBe('red')
  })

  it('defaults to a 60-min cadence when expected_cadence_min is absent', () => {
    const noCadence = { agent: 'a', last_run: '2026-07-14T00:00:00Z', ok: true }
    expect(healthOf(noCadence, base + 90 * min)).toBe('ok') // < 2×60
    expect(healthOf(noCadence, base + 130 * min)).toBe('amber') // > 2×60
    expect(healthOf(noCadence, base + 250 * min)).toBe('red') // > 4×60
  })

  it('future last_run (clock skew) reads as ok, not stale', () => {
    expect(healthOf(status(), base - 30 * min)).toBe('ok')
  })

  it('an unparseable last_run on an ok status is red, not a trusted green', () => {
    expect(healthOf(status({ last_run: 'not-a-date' }), base)).toBe('red')
  })

  it('the three status fixtures map to their intended LEDs at a fixed now', () => {
    // now = 2026-07-14T10:00:00Z
    const now = Date.parse('2026-07-14T10:00:00Z')
    // good: last_run 09:30, cadence 60 → 30 min stale → ok
    expect(healthOf(parseStatus(readFix('good')), now)).toBe('ok')
    // stale: last_run 06:00, cadence 60 → 240 min = 4× → boundary amber
    expect(healthOf(parseStatus(readFix('stale')), now)).toBe('amber')
    // failed: ok:false → red
    expect(healthOf(parseStatus(readFix('failed')), now)).toBe('red')
  })
})

// ── DoD #3: parseRuns truncation tolerance ───────────────────────────────────
describe('parseRuns (DoD #3: tolerant of a truncated final line)', () => {
  it('parses a clean multi-line jsonl', () => {
    const jsonl =
      '{"ts":"2026-07-14T06:00:00Z","ok":true,"note":"a"}\n' +
      '{"ts":"2026-07-14T07:00:00Z","ok":false,"note":"b","duration_ms":50}\n'
    expect(parseRuns(jsonl)).toEqual([
      { ts: '2026-07-14T06:00:00Z', ok: true, note: 'a' },
      { ts: '2026-07-14T07:00:00Z', ok: false, note: 'b', duration_ms: 50 },
    ])
  })

  it('keeps every good line and drops a truncated FINAL line (crash mid-append)', () => {
    const jsonl =
      '{"ts":"2026-07-14T06:00:00Z","ok":true}\n' +
      '{"ts":"2026-07-14T07:00:00Z","ok":true}\n' +
      '{"ts":"2026-07-14T08:00:00Z","ok":tr' // ← truncated, no newline
    const runs = parseRuns(jsonl)
    expect(runs).toHaveLength(2)
    expect(runs.map((r) => r.ts)).toEqual(['2026-07-14T06:00:00Z', '2026-07-14T07:00:00Z'])
  })

  it('ignores blank lines and a trailing newline', () => {
    const jsonl = '\n{"ts":"2026-07-14T06:00:00Z","ok":true}\n\n'
    expect(parseRuns(jsonl)).toHaveLength(1)
  })

  it('skips a corrupt interior line but keeps the good lines around it', () => {
    const jsonl =
      '{"ts":"2026-07-14T06:00:00Z","ok":true}\n' +
      'GARBAGE not json at all\n' +
      '{"ts":"2026-07-14T08:00:00Z","ok":true}\n'
    expect(parseRuns(jsonl).map((r) => r.ts)).toEqual([
      '2026-07-14T06:00:00Z',
      '2026-07-14T08:00:00Z',
    ])
  })

  it('skips lines missing required fields (ts / ok)', () => {
    const jsonl = '{"ok":true}\n{"ts":"x"}\n{"ts":"y","ok":true}\n'
    expect(parseRuns(jsonl)).toEqual([{ ts: 'y', ok: true }])
  })

  it('returns [] on null/empty input', () => {
    expect(parseRuns(null)).toEqual([])
    expect(parseRuns(undefined)).toEqual([])
    expect(parseRuns('')).toEqual([])
  })
})
