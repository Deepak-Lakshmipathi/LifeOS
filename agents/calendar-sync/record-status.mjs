/**
 * record-status.mjs — S47 status-line write for the calendar-sync agent.
 *
 * Deliberately a SEPARATE script (and a separate commit) from sync.mjs's
 * Calendar/today.md write: this slice's DoD #2 requires the sync commit
 * itself to touch ONLY Calendar/today.md, so the runs.jsonl/status.json
 * write (agents/lib/runLog.mjs, S47) is staged and pushed on its own here,
 * never folded into commitAndPush's file list for the calendar write.
 *
 * Invoked by .github/workflows/agent-calendar-sync.yml as a post-sync step
 * with `if: always()` so a failed sync still records `ok: false`.
 *
 * Usage: node agents/calendar-sync/record-status.mjs <ok:true|false>
 * Env: VAULT_DIR (required) — same vault clone sync.mjs wrote to.
 */
import { relative } from 'node:path'
import { logRun } from '../lib/runLog.mjs'
import { commitAndPush } from '../lib/push.mjs'

const AUTHOR = 'lifeos-calendar-sync <lifeos-calendar-sync@users.noreply.github.com>'
const CADENCE_MIN = 30 // matches the workflow's */30 cron

async function main() {
  const okArg = process.argv[2]
  if (okArg !== 'true' && okArg !== 'false') {
    console.error('record-status.mjs: first arg must be "true" or "false" (job.status success/failure)')
    process.exit(1)
  }
  const vaultDir = process.env.VAULT_DIR
  if (!vaultDir) {
    console.error('record-status.mjs: VAULT_DIR env var is required')
    process.exit(1)
  }

  const ok = okArg === 'true'
  const { statusPath, runsPath } = logRun(vaultDir, 'calendar-sync', { ok, cadence: CADENCE_MIN })

  await commitAndPush(vaultDir, {
    files: [relative(vaultDir, statusPath), relative(vaultDir, runsPath)],
    message: `calendar-sync: run status (${ok ? 'ok' : 'failed'})`,
    author: AUTHOR,
  })
}

main().catch((err) => {
  // Status recording is best-effort — never fail the whole workflow run
  // over a status-write hiccup (the sync step already ran/failed on its
  // own merits by the time this runs).
  console.error('record-status.mjs: failed to record status (non-fatal):', err)
})
