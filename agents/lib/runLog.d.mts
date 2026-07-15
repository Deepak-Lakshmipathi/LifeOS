/**
 * Type declarations for runLog.mjs (S47).
 *
 * The helper itself is plain, dependency-free Node ESM (runLog.mjs) so it runs
 * unchanged on GH Actions / PC / VPS. This sibling .d.mts exists only so the
 * TypeScript PWA side (which imports it in agentStatus.test.ts to prove the
 * cross-module roundtrip) typechecks under `strict` — it is erased at runtime.
 */

/** A run as appended to runs.jsonl (one JSON object per line). */
export interface LoggedRun {
  ts: string
  ok: boolean
  note?: string
  duration_ms?: number
}

/** The latest-run snapshot overwritten into status.json. */
export interface LoggedStatus {
  agent: string
  last_run: string
  ok: boolean
  note?: string
  duration_ms?: number
  expected_cadence_min?: number
}

export interface LogRunResult {
  statusPath: string
  runsPath: string
  status: LoggedStatus
  run: LoggedRun
}

export function logRun(
  vaultDir: string,
  agent: string,
  run: {
    ok: boolean
    note?: string
    duration_ms?: number
    cadence?: number
    ts?: string
  },
): LogRunResult
