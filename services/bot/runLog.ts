/**
 * runLog — thin adapter over S47 file shapes for the Telegram bot (S51).
 *
 * Writes `agents/telegram-bot/runs.jsonl` (append) + `status.json` (overwrite)
 * via the bot's existing VaultTransport — no new git plumbing.
 *
 * Runs.jsonl content is cached in module memory and rebuilt from scratch on
 * each process restart. Status.json is always fresh (the health board reads
 * only status.json). This is acceptable: the bot is always-on and restarts
 * are infrequent; the audit trail gap is cosmetic, not structural.
 */

import type { VaultTransport } from '../../src/vault/transport'

const AGENT = 'telegram-bot'
const CADENCE_MIN = 15 // heartbeat cadence; health board uses 2×/4× for amber/red
const STATUS_PATH = `agents/${AGENT}/status.json`
const RUNS_PATH = `agents/${AGENT}/runs.jsonl`

export interface RunInfo {
  ok: boolean
  note?: string
  /** ISO timestamp; injectable for deterministic tests. */
  ts?: string
}

// In-memory runs.jsonl cache — empty on boot, grows with actions.
// Status.json (the board source) is always written fresh regardless.
let runsCache = ''

function makeRunRecord(info: RunInfo): Record<string, unknown> {
  const ts = info.ts ?? new Date().toISOString()
  const record: Record<string, unknown> = { ts, ok: info.ok }
  if (info.note !== undefined) record.note = info.note
  return record
}

function makeStatus(info: RunInfo): Record<string, unknown> {
  const ts = info.ts ?? new Date().toISOString()
  const status: Record<string, unknown> = {
    agent: AGENT,
    last_run: ts,
    ok: info.ok,
    expected_cadence_min: CADENCE_MIN,
  }
  if (info.note !== undefined) status.note = info.note
  return status
}

/**
 * Log a completed bot action (create / update / delete / photo / voice).
 * Writes runs.jsonl + status.json via the transport. Each writeFile is its
 * own commit (transport constraint — no batch-commit seam exposed).
 * Failures are swallowed + console.warn per DoD #2 (logging must never
 * break message handling).
 */
export async function logBotAction(transport: VaultTransport, info: RunInfo): Promise<void> {
  try {
    const record = makeRunRecord(info)
    runsCache += JSON.stringify(record) + '\n'

    await transport.writeFile(RUNS_PATH, runsCache, `bot: run log (${info.ok ? 'ok' : 'failed'})`)
    await transport.writeFile(STATUS_PATH, JSON.stringify(makeStatus(info), null, 2) + '\n', 'bot: status update')
  } catch (err: unknown) {
    console.warn('runLog: failed to log bot action (non-fatal):', err instanceof Error ? err.message : err)
  }
}

/**
 * Heartbeat — writes status.json only (no runs.jsonl entry). Called on a
 * 15-minute unref'd interval. ok:true, note:'polling'.
 */
export async function logHeartbeat(transport: VaultTransport): Promise<void> {
  try {
    const status = {
      agent: AGENT,
      last_run: new Date().toISOString(),
      ok: true,
      expected_cadence_min: CADENCE_MIN,
      note: 'polling',
    }
    await transport.writeFile(STATUS_PATH, JSON.stringify(status, null, 2) + '\n', 'bot: heartbeat')
  } catch (err: unknown) {
    console.warn('runLog: heartbeat failed (non-fatal):', err instanceof Error ? err.message : err)
  }
}

/** Reset module-level runs cache (test-only). */
export function _resetRunsCache(): void {
  runsCache = ''
}
