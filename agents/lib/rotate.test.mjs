/**
 * rotate.test.mjs — S56 coverage for agents/lib/rotate.mjs.
 *
 * Exercises the real filesystem (a throwaway dir under the OS tmpdir), like
 * runLog.test.mjs — rotation's whole job is "the bytes on disk are correct",
 * and the files are tiny, so real writes are the honest test.
 *
 * DoD coverage:
 *   #2 rotateJsonl — 5-month fixture → 3 kept in place, 2 archived, zero lines
 *      lost across files (sum-tested).
 *   #3 pruneNetworth — keeps header + exactly N most-recent rows, still parses
 *      via S39's parseNetworthHistory.
 *   #4 idempotence — a second run is a byte-for-byte no-op (changed:false).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rotateJsonl, pruneNetworth } from './rotate.mjs'
import { parseNetworthHistory } from '../../src/vault/finance'

let root

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'lifeos-rotate-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

/** Count non-empty lines in a file (0 if absent). */
function lineCount(p) {
  if (!existsSync(p)) return 0
  return readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => l !== '').length
}

/** Build an agents/<name>/runs.jsonl with `perMonth` records for each of `months`. */
function seedRuns(name, months, perMonth = 4) {
  const dir = join(root, 'agents', name)
  mkdirSync(dir, { recursive: true })
  const lines = []
  for (const month of months) {
    for (let i = 0; i < perMonth; i++) {
      const day = String(i + 1).padStart(2, '0')
      lines.push(
        JSON.stringify({ ts: `${month}-${day}T09:00:00.000Z`, ok: true, note: `${month} #${i}` }),
      )
    }
  }
  const p = join(dir, 'runs.jsonl')
  writeFileSync(p, lines.join('\n') + '\n')
  return p
}

describe('rotateJsonl — month split + archive (DoD #2)', () => {
  it('keeps 3 most-recent months in place, archives the older 2, loses zero lines', () => {
    // 5 months, 4 records each = 20 lines.
    const months = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07']
    const p = seedRuns('email-triage', months, 4)
    const originalLines = lineCount(p)
    expect(originalLines).toBe(20)

    const res = rotateJsonl(p, 3)

    // Kept in place: 2026-05, 2026-06, 2026-07 (3 months × 4 = 12 lines).
    expect(res.changed).toBe(true)
    expect(res.archivedMonths.sort()).toEqual(['2026-03', '2026-04'])
    expect(lineCount(p)).toBe(12)

    // Archived: 2026-03 + 2026-04 (4 lines each).
    const archiveDir = join(root, 'agents', 'email-triage', 'archive')
    expect(lineCount(join(archiveDir, '2026-03.jsonl'))).toBe(4)
    expect(lineCount(join(archiveDir, '2026-04.jsonl'))).toBe(4)

    // Zero line loss: kept + archived == original (sum-tested).
    const archivedTotal =
      lineCount(join(archiveDir, '2026-03.jsonl')) + lineCount(join(archiveDir, '2026-04.jsonl'))
    expect(lineCount(p) + archivedTotal).toBe(originalLines)
    expect(res.keptLines + res.archivedLines).toBe(originalLines)

    // The kept file holds exactly the recent months; archived months are gone from it.
    const keptContent = readFileSync(p, 'utf8')
    expect(keptContent).not.toContain('2026-03')
    expect(keptContent).not.toContain('2026-04')
    expect(keptContent).toContain('2026-07')
  })

  it('keeps undateable (malformed) lines in place, never archived or lost', () => {
    const p = seedRuns('job-scout', ['2026-01', '2026-07'], 3) // 6 dateable lines
    // Inject a malformed line (no ts) — must stay in place.
    const withBad = readFileSync(p, 'utf8') + 'not-json-at-all\n'
    writeFileSync(p, withBad)
    const original = lineCount(p) // 7

    const res = rotateJsonl(p, 1) // keep only 2026-07

    const archiveDir = join(root, 'agents', 'job-scout', 'archive')
    const archived = lineCount(join(archiveDir, '2026-01.jsonl'))
    expect(archived).toBe(3)
    // Kept file = 2026-07 (3) + the malformed line (1) = 4.
    expect(lineCount(p)).toBe(4)
    expect(readFileSync(p, 'utf8')).toContain('not-json-at-all')
    expect(lineCount(p) + archived).toBe(original) // zero loss
    expect(res.changed).toBe(true)
  })

  it('is idempotent — a second run is a byte-for-byte no-op (DoD #4)', () => {
    const months = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07']
    const p = seedRuns('finance-sync', months, 2)
    rotateJsonl(p, 3)

    const afterFirst = readFileSync(p, 'utf8')
    const archiveDir = join(root, 'agents', 'finance-sync', 'archive')
    const arch03 = readFileSync(join(archiveDir, '2026-03.jsonl'), 'utf8')
    const mtimeFirst = statSync(p).mtimeMs

    const res2 = rotateJsonl(p, 3)

    expect(res2.changed).toBe(false)
    expect(res2.archivedMonths).toEqual([])
    // File content untouched, and no re-append to the archive.
    expect(readFileSync(p, 'utf8')).toBe(afterFirst)
    expect(readFileSync(join(archiveDir, '2026-03.jsonl'), 'utf8')).toBe(arch03)
    // No write happened at all (mtime stable).
    expect(statSync(p).mtimeMs).toBe(mtimeFirst)
  })

  it('no-op on a missing or empty file', () => {
    const missing = join(root, 'agents', 'nope', 'runs.jsonl')
    expect(rotateJsonl(missing, 3).changed).toBe(false)
  })
})

describe('pruneNetworth — header + last N rows (DoD #3)', () => {
  /** Build a networth-history.md with `n` valid rows, newest-last, plus preamble + header. */
  function seedNetworth(n) {
    const rows = []
    for (let i = 0; i < n; i++) {
      // Ascending dates so the LAST N are the most-recent.
      const month = String((i % 12) + 1).padStart(2, '0')
      const year = 2024 + Math.floor(i / 12)
      const value = 1000000 + i * 10000
      rows.push(`| ${year}-${month}-01 | ${value} |`)
    }
    const content =
      '# Finance/networth-history.md — append-only table\n\n' +
      '| date | networth |\n' +
      '|------|----------|\n' +
      rows.join('\n') +
      '\n'
    const p = join(root, 'networth-history.md')
    writeFileSync(p, content)
    return p
  }

  it('keeps the header + separator + exactly N most-recent rows, still parses via S39', () => {
    const p = seedNetworth(30)
    const before = parseNetworthHistory(readFileSync(p, 'utf8'))
    expect(before).toHaveLength(30)

    const res = pruneNetworth(p, 24)
    expect(res.changed).toBe(true)
    expect(res.keptRows).toBe(24)
    expect(res.prunedRows).toBe(6)

    const out = readFileSync(p, 'utf8')
    // Header + separator preserved.
    expect(out).toContain('| date | networth |')
    expect(out).toContain('|------|----------|')

    // Parses via S39 → exactly 24 points, and they are the MOST-RECENT 24.
    const after = parseNetworthHistory(out)
    expect(after).toHaveLength(24)
    const mostRecent24 = before.slice(-24) // parser returns ascending by date
    expect(after.map((pt) => pt.date)).toEqual(mostRecent24.map((pt) => pt.date))
    expect(after.map((pt) => pt.networth)).toEqual(mostRecent24.map((pt) => pt.networth))
  })

  it('is idempotent — a second prune is a byte-for-byte no-op (DoD #4)', () => {
    const p = seedNetworth(30)
    pruneNetworth(p, 24)
    const afterFirst = readFileSync(p, 'utf8')
    const mtimeFirst = statSync(p).mtimeMs

    const res2 = pruneNetworth(p, 24)
    expect(res2.changed).toBe(false)
    expect(res2.prunedRows).toBe(0)
    expect(readFileSync(p, 'utf8')).toBe(afterFirst)
    expect(statSync(p).mtimeMs).toBe(mtimeFirst)
  })

  it('no-op when already within budget', () => {
    const p = seedNetworth(10)
    expect(pruneNetworth(p, 24).changed).toBe(false)
    expect(parseNetworthHistory(readFileSync(p, 'utf8'))).toHaveLength(10)
  })
})
