/**
 * runLog — shared run-logging helper for the agent fleet (S47).
 *
 * Every scheduled agent records each run to two files under its own
 * path-partition of the vault repo:
 *
 *   agents/<name>/runs.jsonl   — APPEND one JSON object per line, forever.
 *                                 The durable audit trail; grows unbounded.
 *   agents/<name>/status.json  — OVERWRITE with the latest run only.
 *                                 An O(1) staleness read: the fleet-health
 *                                 board reads ONLY this file, never scans the
 *                                 log. This is the whole point — a health
 *                                 board that scanned every agent's full jsonl
 *                                 would get slower as the fleet aged.
 *
 * `logRun` writes both files but does NOT commit or push — staging is the
 * caller's job (via agents/lib/push.mjs commitAndPush), so both files land in
 * ONE commit alongside whatever else the agent changed. That keeps the vault's
 * git history one-run-per-commit and lets the status.json + runs.jsonl move
 * atomically.
 *
 * Plain Node ESM, zero dependencies — runs identically from a GitHub Actions
 * runner, the user's PC, and the VPS. Uses only node:fs/node:path.
 */

import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Append a run to runs.jsonl and overwrite status.json for one agent.
 *
 * Both files live under `<vaultDir>/agents/<agent>/`; the directory is created
 * if it does not exist (first run of a brand-new agent).
 *
 * @param {string} vaultDir - working-copy root of the vault repo.
 * @param {string} agent - agent name, e.g. "email-triage" (becomes the folder).
 * @param {object} run
 * @param {boolean} run.ok - did the run succeed?
 * @param {string} [run.note] - short human note, e.g. "4 flagged, 1 draft".
 * @param {number} [run.duration_ms] - wall-clock duration of the run.
 * @param {number} [run.cadence] - expected minutes between runs; written to
 *   status.json as `expected_cadence_min` so the health board can compute
 *   staleness thresholds (2× amber, 4× red) without hard-coding per-agent
 *   cadence on the PWA side.
 * @param {string} [run.ts] - ISO timestamp of the run; defaults to now. Injectable
 *   so tests are deterministic.
 * @returns {{ statusPath: string, runsPath: string, status: object, run: object }}
 *   the paths written and the exact objects serialised (handy for the caller's
 *   commit stage list and for round-trip assertions).
 */
export function logRun(vaultDir, agent, { ok, note, duration_ms, cadence, ts } = {}) {
  if (!vaultDir) throw new Error('logRun: vaultDir is required')
  if (!agent) throw new Error('logRun: agent is required')
  if (typeof ok !== 'boolean') throw new Error('logRun: run.ok must be a boolean')

  const stamp = ts ?? new Date().toISOString()
  const dir = join(vaultDir, 'agents', agent)
  const runsPath = join(dir, 'runs.jsonl')
  const statusPath = join(dir, 'status.json')

  // runs.jsonl line: the append-only audit record. Keep it lean — no agent
  // name (implied by the folder) and no cadence (a config concern, not a
  // per-run fact); status.json carries those.
  const runRecord = { ts: stamp, ok }
  if (note !== undefined) runRecord.note = note
  if (duration_ms !== undefined) runRecord.duration_ms = duration_ms

  // status.json: the latest run, self-describing (carries agent + cadence) so
  // the health board can read one file and know everything it needs.
  const status = { agent, last_run: stamp, ok }
  if (note !== undefined) status.note = note
  if (duration_ms !== undefined) status.duration_ms = duration_ms
  if (cadence !== undefined) status.expected_cadence_min = cadence

  mkdirSync(dir, { recursive: true })
  // Append newline-terminated so the file is always a clean sequence of lines
  // (and a crash mid-append truncates at most the trailing line — which the
  // parser tolerates by design).
  appendFileSync(runsPath, JSON.stringify(runRecord) + '\n')
  // Overwrite: status.json is always exactly the last run, pretty-printed so a
  // human peeking at the vault repo can read it.
  writeFileSync(statusPath, JSON.stringify(status, null, 2) + '\n')

  return { statusPath, runsPath, status, run: runRecord }
}
