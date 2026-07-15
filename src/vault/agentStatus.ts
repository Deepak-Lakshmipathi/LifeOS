/**
 * agentStatus — PWA-side reader for the agent-run contract (S47).
 *
 * The writer half (agents/lib/runLog.mjs, plain Node) records each agent run to
 * `agents/<name>/status.json` (latest run, overwritten) and
 * `agents/<name>/runs.jsonl` (append-only audit trail). This module is the PWA
 * half: it parses those files and computes fleet health.
 *
 * Health board contract: the board reads ONLY status.json per agent (O(1)),
 * never scans the jsonl. `parseRuns` exists for a drill-down log-tail view, and
 * is deliberately tolerant of a truncated final line — a crash mid-append (or a
 * push that raced a write) leaves a half-written last line, and one bad tail
 * must never blank the whole history.
 *
 * `healthOf` maps 1:1 onto DESIGN_LANGUAGE §4.7 LED semantics:
 *   ok    → .led.ok   (green, steady)
 *   amber → (stale, drifting — board renders a warning tint, still steady)
 *   red   → .led.bad  (failed OR badly stale — the only LED that blinks)
 *   idle  → .led.idle (no status file yet — never run; faint, no glow)
 */

/** A parsed status.json — the latest run of one agent. */
export interface AgentStatus {
  agent: string
  /** ISO timestamp of the last run. */
  last_run: string
  ok: boolean
  note?: string
  duration_ms?: number
  /** Expected minutes between runs; drives staleness thresholds. */
  expected_cadence_min?: number
}

/** A single parsed line of runs.jsonl. */
export interface AgentRun {
  ts: string
  ok: boolean
  note?: string
  duration_ms?: number
}

/** Fleet-health verdict — maps 1:1 to the §4.7 LED classes. */
export type Health = 'ok' | 'amber' | 'red' | 'idle'

/**
 * Parse one agent's status.json text into an AgentStatus.
 *
 * Tolerant: returns null on anything that isn't a well-formed status object
 * (unparseable JSON, missing/`wrong-typed` required fields). A null status is
 * treated as "idle" by healthOf — an agent whose status file is absent or
 * corrupt reads as "never ran", never as a false green.
 *
 * @param json - raw file contents of status.json (or null/undefined if the
 *   file is missing, which the transport layer signals).
 */
export function parseStatus(json: string | null | undefined): AgentStatus | null {
  if (!json) return null
  let obj: unknown
  try {
    obj = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>
  // Required, correctly-typed core fields — otherwise it isn't a status we trust.
  if (typeof o.agent !== 'string') return null
  if (typeof o.last_run !== 'string') return null
  if (typeof o.ok !== 'boolean') return null

  const status: AgentStatus = { agent: o.agent, last_run: o.last_run, ok: o.ok }
  if (typeof o.note === 'string') status.note = o.note
  if (typeof o.duration_ms === 'number') status.duration_ms = o.duration_ms
  if (typeof o.expected_cadence_min === 'number') {
    status.expected_cadence_min = o.expected_cadence_min
  }
  return status
}

/** Default cadence (minutes) when a status omits expected_cadence_min. */
const DEFAULT_CADENCE_MIN = 60

/**
 * Compute an agent's health LED from its status and the current time.
 *
 * Thresholds (S47 contract, DESIGN_LANGUAGE §4.7):
 *   - no status (never ran / corrupt)      → idle
 *   - ok:false                              → red   (a failed run is always red)
 *   - staleness > 4× cadence                → red   (silently dead — loud red)
 *   - staleness > 2× cadence                → amber (drifting behind schedule)
 *   - otherwise                             → ok
 *
 * "Staleness" is now − last_run. A future last_run (clock skew) yields a
 * negative staleness, which is well within cadence → ok.
 *
 * @param status - parsed status, or null for a missing/corrupt status file.
 * @param now - reference time in ms since epoch (Date.now() in production;
 *   injected in tests for deterministic boundaries).
 */
export function healthOf(status: AgentStatus | null, now: number): Health {
  if (status === null) return 'idle'
  // A failed run is red regardless of freshness — a green-but-recent failure
  // would be the worst possible lie for a health board to tell.
  if (!status.ok) return 'red'

  const cadenceMin = status.expected_cadence_min ?? DEFAULT_CADENCE_MIN
  const cadenceMs = cadenceMin * 60_000
  const lastRun = Date.parse(status.last_run)
  // Unparseable timestamp on an otherwise-ok status: treat as stale-red rather
  // than trust an ok we can't date.
  if (Number.isNaN(lastRun)) return 'red'

  const staleness = now - lastRun
  if (staleness > 4 * cadenceMs) return 'red'
  if (staleness > 2 * cadenceMs) return 'amber'
  return 'ok'
}

/**
 * Parse runs.jsonl text into AgentRun[], newest-last (file order).
 *
 * Tolerant by design (S47 DoD #3): each line is parsed independently and a
 * line that fails to parse — most importantly a truncated FINAL line from a
 * crash mid-append — is skipped, not fatal. Blank lines are ignored. One bad
 * tail never blanks the history.
 *
 * @param jsonl - raw file contents of runs.jsonl (or null/undefined if absent).
 */
export function parseRuns(jsonl: string | null | undefined): AgentRun[] {
  if (!jsonl) return []
  const runs: AgentRun[] = []
  for (const line of jsonl.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue // blank / trailing newline
    let obj: unknown
    try {
      obj = JSON.parse(trimmed)
    } catch {
      // Truncated or corrupt line (e.g. the last line of a crashed append) —
      // skip it, keep every well-formed line before it.
      continue
    }
    if (typeof obj !== 'object' || obj === null) continue
    const o = obj as Record<string, unknown>
    if (typeof o.ts !== 'string') continue
    if (typeof o.ok !== 'boolean') continue
    const run: AgentRun = { ts: o.ts, ok: o.ok }
    if (typeof o.note === 'string') run.note = o.note
    if (typeof o.duration_ms === 'number') run.duration_ms = o.duration_ms
    runs.push(run)
  }
  return runs
}
