/**
 * rotate — log-rotation helpers for the agent fleet + finance history (S56).
 *
 * Agents commit constantly (runs.jsonl grows forever; networth-history.md is
 * append-only), so the vault's git history — and the PWA's in-browser shallow
 * clone — grow unbounded. A monthly rotation job (`.github/workflows/
 * agent-rotate.yml`) prunes both append-only shapes in one commit:
 *
 *   rotateJsonl(path, keepMonths)   — month-splits an <agent>/runs.jsonl,
 *     keeps the N most-recent months in place, archives older months to
 *     <agent>/archive/<YYYY-MM>.jsonl. Zero lines are lost (kept + archived
 *     always sums to the original line count).
 *   pruneNetworth(path, keepPoints) — trims Finance/networth-history.md to its
 *     header + the last N data rows. The result still parses via S39's
 *     parseNetworthHistory (header/separator preserved, rows untouched).
 *
 * Both operations are:
 *   - ATOMIC: written to a temp sibling then renamed over the target.
 *   - IDEMPOTENT: a second run with nothing new to prune leaves the target
 *     file byte-for-byte untouched (no write at all) — the file's mtime and
 *     git blob are stable, so the workflow's "one commit" produces an empty
 *     diff on a quiet month.
 *   - ZERO-DEPENDENCY plain Node ESM (node:fs / node:path only) so they run
 *     identically from a GitHub Actions runner, the user's PC, and the VPS.
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  appendFileSync,
  mkdirSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Write `content` to `path` atomically (temp sibling + rename). The rename is
 * atomic on the same filesystem, so a reader/committer never sees a half-written
 * file.
 */
function atomicWrite(path, content) {
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, content)
  renameSync(tmp, path)
}

/** ISO timestamp → `YYYY-MM`, or null when the value isn't a parseable ts. */
function monthOf(ts) {
  if (typeof ts !== 'string') return null
  // Fast path: an ISO string starts `YYYY-MM`. Validate the shape before slicing.
  const m = ts.match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}` : null
}

/**
 * Rotate an append-only JSONL run-log: keep the `keepMonths` most-recent
 * calendar months in place, archive everything older.
 *
 * Grouping is by the `ts` field's `YYYY-MM`. Lines whose `ts` is missing or
 * unparseable are ALWAYS kept in place (never archived, never dropped) — the
 * rotation must never lose or misfile a record it can't date.
 *
 * Archives are APPENDED to `<dir>/archive/<YYYY-MM>.jsonl` (a month archived in
 * a later run merges with any earlier archive of the same month), preserving
 * per-month line order.
 *
 * Atomic + idempotent: when no month needs archiving the target file is left
 * completely untouched (no write). When months are archived, the in-place file
 * is rewritten (atomically) with the kept lines in their ORIGINAL order.
 *
 * @param {string} path - path to `<...>/agents/<name>/runs.jsonl`.
 * @param {number} [keepMonths=3] - number of most-recent months to keep in place.
 * @returns {{ archivedMonths: string[], keptLines: number, archivedLines: number,
 *   totalLines: number, changed: boolean }} a summary (handy for logging/tests).
 */
export function rotateJsonl(path, keepMonths = 3) {
  const empty = {
    archivedMonths: [],
    keptLines: 0,
    archivedLines: 0,
    totalLines: 0,
    changed: false,
  }
  if (!existsSync(path)) return empty

  const raw = readFileSync(path, 'utf8')
  // Preserve every non-empty line verbatim; a trailing newline yields one empty
  // trailing token which we drop (it is not a record).
  const lines = raw.split('\n')
  const hadTrailingNewline = lines.length > 0 && lines[lines.length - 1] === ''
  if (hadTrailingNewline) lines.pop()
  const records = lines.filter((l) => l !== '')
  const dropped = lines.length - records.length // blank interior lines, if any

  if (records.length === 0) return { ...empty, totalLines: 0 }

  // Distinct dateable months, newest → oldest.
  const monthsPresent = new Set()
  for (const line of records) {
    let month = null
    try {
      month = monthOf(JSON.parse(line).ts)
    } catch {
      month = null // malformed JSON — undateable, kept in place
    }
    if (month) monthsPresent.add(month)
  }
  const sortedMonths = [...monthsPresent].sort().reverse() // desc
  const keepSet = new Set(sortedMonths.slice(0, keepMonths))
  const archiveMonths = sortedMonths.slice(keepMonths)

  // Nothing older than the keep-window → true no-op (leave the file untouched).
  if (archiveMonths.length === 0) {
    return {
      archivedMonths: [],
      keptLines: records.length,
      archivedLines: 0,
      totalLines: records.length + dropped,
      changed: false,
    }
  }

  const archiveSet = new Set(archiveMonths)
  const kept = []
  /** @type {Map<string, string[]>} month → lines to archive, in file order. */
  const toArchive = new Map()

  for (const line of records) {
    let month = null
    try {
      month = monthOf(JSON.parse(line).ts)
    } catch {
      month = null
    }
    if (month && archiveSet.has(month)) {
      if (!toArchive.has(month)) toArchive.set(month, [])
      toArchive.get(month).push(line)
    } else {
      // In keep-window, or undateable → stays in place.
      kept.push(line)
    }
  }

  // Append each archived month to its archive file (create archive/ on demand).
  const archiveDir = join(dirname(path), 'archive')
  mkdirSync(archiveDir, { recursive: true })
  let archivedLines = 0
  for (const month of archiveMonths) {
    const monthLines = toArchive.get(month) ?? []
    if (monthLines.length === 0) continue
    appendFileSync(join(archiveDir, `${month}.jsonl`), monthLines.join('\n') + '\n')
    archivedLines += monthLines.length
  }

  // Rewrite the in-place file with the kept lines, original order, atomically.
  atomicWrite(path, kept.length ? kept.join('\n') + '\n' : '')

  return {
    archivedMonths: archiveMonths,
    keptLines: kept.length,
    archivedLines,
    totalLines: records.length + dropped,
    changed: true,
  }
}

/** A markdown table separator row, e.g. `|------|----------|` or `| :--- | ---: |`. */
function isSeparatorRow(line) {
  return /^\|[\s:|-]+\|?\s*$/.test(line.trim()) && line.includes('-')
}

/**
 * Prune `Finance/networth-history.md` to its header + the last `keepPoints`
 * data rows.
 *
 * The file is a markdown table (optionally with a preamble line or two above
 * it): a header row, a `|---|` separator, then one data row per net-worth
 * point. This keeps the preamble + header + separator intact and retains only
 * the final `keepPoints` data rows (the append-only agent writes newest-last,
 * so "last N" == the N most-recent points). The output still parses via S39's
 * `parseNetworthHistory` — that parser reads only `|`-rows with an ISO date in
 * cell 1, all of which are preserved unchanged.
 *
 * Atomic + idempotent: when there are already ≤ keepPoints data rows the file
 * is left completely untouched (no write).
 *
 * @param {string} path - path to `Finance/networth-history.md`.
 * @param {number} [keepPoints=24] - number of most-recent data rows to keep.
 * @returns {{ keptRows: number, prunedRows: number, changed: boolean }} summary.
 */
export function pruneNetworth(path, keepPoints = 24) {
  if (!existsSync(path)) return { keptRows: 0, prunedRows: 0, changed: false }

  const raw = readFileSync(path, 'utf8')
  const endsWithNewline = raw.endsWith('\n')
  const lines = raw.split('\n')
  if (endsWithNewline) lines.pop() // drop the empty trailing token

  // Locate the table rows (contiguous run of `|`-lines). Everything before the
  // first `|`-line is preamble kept verbatim; header + separator are the first
  // two table lines; the remainder are data rows.
  const firstTableIdx = lines.findIndex((l) => l.trim().startsWith('|'))
  if (firstTableIdx === -1) return { keptRows: 0, prunedRows: 0, changed: false }

  const preamble = lines.slice(0, firstTableIdx)
  const tableLines = lines.slice(firstTableIdx).filter((l) => l.trim().startsWith('|'))

  // Header is the first table line; a separator is the next line if it looks
  // like one. Data rows are whatever follows.
  const header = tableLines[0]
  let dataStart = 1
  const structural = [header]
  if (tableLines.length > 1 && isSeparatorRow(tableLines[1])) {
    structural.push(tableLines[1])
    dataStart = 2
  }
  const dataRows = tableLines.slice(dataStart)

  if (dataRows.length <= keepPoints) {
    // Already within budget — true no-op, leave the file untouched.
    return { keptRows: dataRows.length, prunedRows: 0, changed: false }
  }

  const keptRows = dataRows.slice(-keepPoints)
  const prunedRows = dataRows.length - keptRows.length
  const out = [...preamble, ...structural, ...keptRows].join('\n') + '\n'
  atomicWrite(path, out)

  return { keptRows: keptRows.length, prunedRows, changed: true }
}
