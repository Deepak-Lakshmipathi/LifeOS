/**
 * audit.mjs — supervisor agent (S55): weekly fleet audit → report + proposals.
 *
 * GH Actions cron agent (agent-supervisor.yml, Sunday 06:00 IST): reads every
 * OTHER agent's `agents/<name>/runs.jsonl` + `status.json` (the S47 contract,
 * see agents/lib/runLog.mjs), computes per-agent metrics for the trailing
 * week (run count, failure count, duration percentiles, staleness incidents),
 * optionally samples a bounded number of runs for output-accuracy via an
 * injectable Claude check, then writes the S52 weekly report
 * (`agents/supervisor/<date>.md`) plus zero or more proposals
 * (`proposals/<agent>-<date>.md`).
 *
 * THE CENTRAL INVARIANT (S55 DoD #2): every proposal this module writes has
 * `status: pending`, hardcoded — never read from a variable, never
 * interpolated. The supervisor NEVER edits another agent's prompt/config and
 * NEVER sets a proposal's status to `approved`; the owner approves in the PWA
 * (S54). `renderProposalMarkdown` below ignores any `status` field a caller
 * might (accidentally or maliciously) attach to a proposal object — see
 * audit.test.mjs's "cannot be overridden" test.
 *
 * Mirrors agents/calendar-sync/sync.mjs and agents/email-triage/triage.mjs's
 * shape: pure functions are exported and exercised byte-exact in
 * audit.test.mjs with zero network/filesystem access; the impure pieces
 * (reading the vault clone, the optional Claude sampling call, the file
 * writes, and the final commit+push) all take an injectable seam so `run()`
 * itself is testable end-to-end without touching a live network or git
 * remote.
 *
 * Secrets (GitHub Actions repo secrets — see agents/supervisor/README.md):
 *   ANTHROPIC_API_KEY (optional) — accuracy-sampling Claude calls. Sampling
 *     is skipped cleanly (not an error) when absent.
 *   AGENT_VAULT_PAT_SUPERVISOR — vault push token, Contents R/W on
 *     LiveOS-VaultRepo only, writing only `agents/supervisor/**` and
 *     `proposals/**` (see docs/agents/vault-tokens.md).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { logRun } from '../lib/runLog.mjs'
import { commitAndPush } from '../lib/push.mjs'

/** Commit author for every push this agent makes. */
export const COMMIT_AUTHOR = 'lifeos-supervisor <lifeos-supervisor@users.noreply.github.com>'

/** How many trailing days of runs.jsonl count as "this week" for the audit. */
export const AUDIT_WINDOW_DAYS = 7

/** agents/<name> directories that are never treated as fleet agents to audit. */
const NON_AGENT_DIRS = new Set(['lib', 'supervisor'])

// ─────────────────────────────────────────────────────────────────────────
// Parsing (pure, tolerant) — duplicates the shape of src/vault/agentStatus.ts's
// parseRuns, but this file runs under plain `node` on a GitHub Actions
// runner (not the Vite/TS build), so it can't import a .ts module at
// runtime; re-implementing here matches the fleet's existing convention of
// no cross-agent imports beyond agents/lib (see triage.mjs's own note).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Parse runs.jsonl text into an array of `{ts, ok, note?, duration_ms?}`.
 * Tolerant: a line that fails to parse (most importantly a truncated FINAL
 * line from a crash mid-append) is skipped, not fatal. Blank lines ignored.
 *
 * @param {string | null | undefined} text
 */
export function parseRunsJsonl(text) {
  if (!text) return []
  const runs = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let obj
    try {
      obj = JSON.parse(trimmed)
    } catch {
      continue
    }
    if (typeof obj !== 'object' || obj === null) continue
    if (typeof obj.ts !== 'string' || typeof obj.ok !== 'boolean') continue
    const run = { ts: obj.ts, ok: obj.ok }
    if (typeof obj.note === 'string') run.note = obj.note
    if (typeof obj.duration_ms === 'number') run.duration_ms = obj.duration_ms
    runs.push(run)
  }
  return runs
}

/** Parse status.json text; null on anything malformed (never throws). */
export function parseStatusJson(text) {
  if (!text) return null
  try {
    const obj = JSON.parse(text)
    return typeof obj === 'object' && obj !== null ? obj : null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Metrics (pure fns from runs.jsonl)
// ─────────────────────────────────────────────────────────────────────────

/** Runs with `ts` inside `[startMs, endMs)`, ascending by ts. Pure. */
export function filterRunsInWindow(runs, startMs, endMs) {
  return runs
    .filter((r) => {
      const t = Date.parse(r.ts)
      return !Number.isNaN(t) && t >= startMs && t < endMs
    })
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
}

/** Count of `ok: false` runs. Pure. */
export function computeFailureCount(runs) {
  return runs.filter((r) => r.ok === false).length
}

/** Mean of the runs' `duration_ms` (only over runs that recorded one). null if none did. */
export function computeAvgDurationMs(runs) {
  const durations = runs.map((r) => r.duration_ms).filter((d) => typeof d === 'number' && Number.isFinite(d))
  if (durations.length === 0) return null
  return durations.reduce((a, b) => a + b, 0) / durations.length
}

/**
 * Nearest-rank percentile (e.g. 50, 95) over `duration_ms` values, in ms.
 * null if no run recorded a duration. Pure.
 */
export function computeDurationPercentile(runs, percentile) {
  const durations = runs
    .map((r) => r.duration_ms)
    .filter((d) => typeof d === 'number' && Number.isFinite(d))
    .sort((a, b) => a - b)
  if (durations.length === 0) return null
  const rank = Math.min(durations.length, Math.max(1, Math.ceil((percentile / 100) * durations.length)))
  return durations[rank - 1]
}

/** Gap between consecutive runs counts as "stale" past this multiple of expected cadence. */
export const STALENESS_MULTIPLIER = 2

/**
 * Consecutive-run gaps that exceed `cadenceMin * STALENESS_MULTIPLIER`.
 * Returns `[]` when `cadenceMin` is unknown (no status.json / never set) —
 * staleness can't be judged without an expectation to compare against — or
 * when there are fewer than 2 runs (no gap to measure). Pure.
 *
 * @returns {{ts: string, gapHours: number}[]}
 */
export function detectStalenessIncidents(runs, cadenceMin) {
  if (!cadenceMin || runs.length < 2) return []
  const thresholdMs = cadenceMin * 60_000 * STALENESS_MULTIPLIER
  const incidents = []
  for (let i = 1; i < runs.length; i++) {
    const prevMs = Date.parse(runs[i - 1].ts)
    const curMs = Date.parse(runs[i].ts)
    if (Number.isNaN(prevMs) || Number.isNaN(curMs)) continue
    const gapMs = curMs - prevMs
    if (gapMs > thresholdMs) {
      incidents.push({ ts: runs[i].ts, gapHours: Math.round((gapMs / 3_600_000) * 10) / 10 })
    }
  }
  return incidents
}

/**
 * All per-agent metrics for one agent's audit window. Pure — the single
 * function audit.test.mjs asserts against hand-computed fixture values
 * (S55 DoD #1).
 *
 * @param {string} agent
 * @param {{ts: string, ok: boolean, note?: string, duration_ms?: number}[]} runs
 * @param {{cadenceMin?: number}} [opts]
 */
export function computeAgentMetrics(agent, runs, { cadenceMin } = {}) {
  return {
    agent,
    runCount: runs.length,
    failureCount: computeFailureCount(runs),
    avgDurationMs: computeAvgDurationMs(runs),
    p50DurationMs: computeDurationPercentile(runs, 50),
    p95DurationMs: computeDurationPercentile(runs, 95),
    stalenessIncidents: detectStalenessIncidents(runs, cadenceMin),
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Optional Claude accuracy sampling — MOCKABLE, capped at N=15 (S55 DoD #4)
// ─────────────────────────────────────────────────────────────────────────

/** Hard ceiling on how many runs get re-checked per agent, per audit. Never exceeded. */
export const MAX_ACCURACY_SAMPLES = 15

/** Below this sampled-correct fraction, generateProposals flags the agent. */
export const ACCURACY_THRESHOLD = 0.9

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
export const CLAUDE_MODEL = 'claude-sonnet-5'

/**
 * Default accuracy sampler: asks Claude whether a run's own note reads as a
 * plausible/correct outcome for that agent. Real network call (impure) —
 * this is the PRODUCTION default when a real ANTHROPIC_API_KEY is present;
 * every test in audit.test.mjs supplies its own `sample` mock instead, so
 * this function is never invoked under `npx vitest run` (S55 DoD #4).
 */
async function defaultAccuracySample({ agent, run, apiKey, fetchImpl = fetch }) {
  const res = await fetchImpl(CLAUDE_API_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 16,
      system:
        'You are auditing one automated agent run for a personal task-tracking system. ' +
        'Reply with exactly "yes" if the note describes a plausible, correct outcome for the ' +
        'named agent, or "no" if it looks wrong or suspicious. No other text.',
      messages: [{ role: 'user', content: `Agent: ${agent}\nRun note: ${run.note}` }],
    }),
  })
  if (!res.ok) return false
  const json = await res.json()
  const textBlock = (json.content ?? []).find((b) => b.type === 'text')
  return (textBlock?.text ?? '').trim().toLowerCase().startsWith('yes')
}

/**
 * Sample up to `cap` (hard-capped at MAX_ACCURACY_SAMPLES=15 regardless of
 * what the caller passes) of an agent's runs that carry a `note`, and
 * re-check each one's correctness via an injectable `sample` fn.
 *
 * Cleanly skipped (returns null, zero calls) when no `apiKey` is supplied or
 * there are no note-bearing runs — sampling is optional, never required for
 * a report to render (S55 Context: "samples outputs for accuracy where
 * cheap").
 *
 * @param {object} params
 * @param {string} params.agent
 * @param {object[]} params.runs
 * @param {string} [params.apiKey]
 * @param {(args: {agent: string, run: object, apiKey: string, fetchImpl: typeof fetch}) => Promise<boolean>} [params.sample]
 *   injectable re-check fn; defaults to a real Claude call. MOCK THIS IN TESTS.
 * @param {number} [params.cap]
 * @param {typeof fetch} [params.fetchImpl]
 * @returns {Promise<{sampled: number, correct: number} | null>}
 */
export async function sampleAccuracy({
  agent,
  runs,
  apiKey,
  sample = defaultAccuracySample,
  cap = MAX_ACCURACY_SAMPLES,
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) return null // sampling is optional; no key -> skip cleanly, no calls at all
  const effectiveCap = Math.min(cap, MAX_ACCURACY_SAMPLES) // hard ceiling, never overridable upward
  const candidates = runs.filter((r) => typeof r.note === 'string' && r.note.trim().length > 0).slice(0, effectiveCap)
  if (candidates.length === 0) return null

  let correct = 0
  for (const run of candidates) {
    const ok = await sample({ agent, run, apiKey, fetchImpl })
    if (ok) correct++
  }
  return { sampled: candidates.length, correct }
}

// ─────────────────────────────────────────────────────────────────────────
// Report rendering (S52 format: agents/supervisor/<date>.md)
// ─────────────────────────────────────────────────────────────────────────

/** ms -> "N.Ns" (1 decimal), or null if ms is null/undefined. Pure. */
function formatSeconds(ms) {
  if (ms === null || ms === undefined) return null
  return `${(ms / 1000).toFixed(1)}s`
}

/** One "## Fleet week" bullet for one agent (+ optional accuracy sample). Pure. */
export function renderFleetLine(metrics, accuracy) {
  const avg = formatSeconds(metrics.avgDurationMs)
  let line = `- ${metrics.agent}: ${metrics.runCount} run${metrics.runCount === 1 ? '' : 's'}, ${metrics.failureCount} failure${metrics.failureCount === 1 ? '' : 's'}`
  if (avg) line += `, avg ${avg}`
  line += '.'
  if (accuracy && accuracy.sampled > 0) {
    line += ` Accuracy sample: ${accuracy.correct}/${accuracy.sampled} correct.`
  }
  return line
}

/** One "## Concerns" bullet for one agent's staleness incidents, or null if none. Pure. */
export function renderConcernLine(metrics) {
  if (metrics.stalenessIncidents.length === 0) return null
  const count = metrics.stalenessIncidents.length
  const latest = metrics.stalenessIncidents[metrics.stalenessIncidents.length - 1]
  const latestDate = latest.ts.slice(0, 10)
  return `- ${metrics.agent} stale ${count} time${count === 1 ? '' : 's'} (>${STALENESS_MULTIPLIER}x cadence) — most recent ${latestDate} (${latest.gapHours}h gap).`
}

/**
 * Render the full weekly report in the S52 contract format. Pure.
 * Roundtrips losslessly through `src/vault/supervisor.ts`'s `parseReport`
 * (S55 DoD #1) — the H1 carries the ISO date parseReport looks for, and
 * every section is a `## ` heading it will split on.
 *
 * @param {object} params
 * @param {string} params.date - ISO date (YYYY-MM-DD).
 * @param {object[]} params.metricsList - computeAgentMetrics() output, one per agent.
 * @param {Record<string, {sampled: number, correct: number}>} [params.accuracyByAgent]
 * @param {{agent: string, date: string}[]} [params.proposalAgents] - proposals generated this run.
 */
export function renderReport({ date, metricsList, accuracyByAgent = {}, proposalAgents = [] }) {
  const lines = [`# agents/supervisor/${date}.md`, '', '## Fleet week']
  for (const metrics of metricsList) {
    lines.push(renderFleetLine(metrics, accuracyByAgent[metrics.agent]))
  }

  const concerns = metricsList.map(renderConcernLine).filter(Boolean)
  if (concerns.length > 0) {
    lines.push('', '## Concerns', ...concerns)
  }

  if (proposalAgents.length > 0) {
    lines.push('', '## Proposals')
    for (const { agent, date: proposalDate } of proposalAgents) {
      lines.push(`- [[proposals/${agent}-${proposalDate}]]`)
    }
  }

  return lines.join('\n') + '\n'
}

// ─────────────────────────────────────────────────────────────────────────
// Proposal generation — status is ALWAYS the literal 'pending' (S55 DoD #2)
// ─────────────────────────────────────────────────────────────────────────

/** Failure rate above this fraction (of the audit window's runs) triggers a proposal. */
export const FAILURE_RATE_THRESHOLD = 0.1

/**
 * Decide which agents warrant a proposal this week (pure): an elevated
 * failure rate, or a sampled accuracy below ACCURACY_THRESHOLD. This
 * function only produces proposal *content* — agent/change/diff/why — never
 * a status. The supervisor NEVER edits another agent's prompt/config
 * directly; every proposal is written with status: pending for the owner to
 * approve in the PWA (S54).
 *
 * @returns {{agent: string, date: string, change: string, diff: string, why: string}[]}
 */
export function generateProposals({ date, metricsList, accuracyByAgent = {} }) {
  const proposals = []
  for (const metrics of metricsList) {
    const failureRate = metrics.runCount > 0 ? metrics.failureCount / metrics.runCount : 0
    const accuracy = accuracyByAgent[metrics.agent]

    if (failureRate > FAILURE_RATE_THRESHOLD) {
      proposals.push({
        agent: metrics.agent,
        date,
        change: `Investigate elevated failure rate: ${metrics.failureCount}/${metrics.runCount} runs failed this week (${Math.round(failureRate * 100)}%).`,
        diff:
          '- current: no retry/backoff tuning\n' +
          '+ suggested: review the recent runs.jsonl notes for a common cause; consider a retry\n' +
          '  or alerting threshold change',
        why: `Failure rate ${Math.round(failureRate * 100)}% exceeds the audit threshold of ${Math.round(FAILURE_RATE_THRESHOLD * 100)}%.`,
      })
    }

    if (accuracy && accuracy.sampled > 0 && accuracy.correct / accuracy.sampled < ACCURACY_THRESHOLD) {
      proposals.push({
        agent: metrics.agent,
        date,
        change: `Review the classification/output prompt: accuracy sample was ${accuracy.correct}/${accuracy.sampled} correct.`,
        diff:
          '- current prompt: unchanged\n' +
          '+ suggested: tighten the prompt\'s edge-case guidance based on the incorrect samples',
        why: `Sampled accuracy ${Math.round((accuracy.correct / accuracy.sampled) * 100)}% is below the audit threshold of ${Math.round(ACCURACY_THRESHOLD * 100)}%.`,
      })
    }
  }
  return proposals
}

/**
 * Render one proposal to the S52 contract file format
 * (`proposals/<agent>-<date>.md`). Pure.
 *
 * CRITICAL: `status` below is the string literal `'pending'`, written
 * directly into the template — it is NEVER read from `proposal.status`.
 * There is no branch, variable, or interpolation slot through which a
 * caller (however malformed the object it passes) can make this function
 * emit `approved` or `rejected`. See audit.test.mjs's invariant test, which
 * feeds a `proposal.status: 'approved'` object in and asserts the parsed
 * output is still `pending` (S55 DoD #2).
 *
 * @param {{agent: string, date: string, change: string, diff: string, why: string}} proposal
 */
export function renderProposalMarkdown(proposal) {
  return (
    `---\n` +
    `agent: ${proposal.agent}\n` +
    `date: ${proposal.date}\n` +
    `status: pending # pending | approved | rejected\n` +
    `---\n` +
    `## Change\n${proposal.change}\n` +
    `## Diff\n\`\`\`\n${proposal.diff}\n\`\`\`\n` +
    `## Why\n${proposal.why}\n`
  )
}

/** Repo-relative path a proposal is written to. Pure. */
export function proposalFilePath(proposal) {
  return join('proposals', `${proposal.agent}-${proposal.date}.md`).split('\\').join('/')
}

// ─────────────────────────────────────────────────────────────────────────
// Reading the fleet (impure — filesystem)
// ─────────────────────────────────────────────────────────────────────────

/**
 * List agent directories under `<vaultDir>/agents/` that are fleet agents to
 * audit (excludes `agents/lib` and `agents/supervisor` itself — the
 * supervisor never treats its own history as a fleet row). Impure (fs).
 */
export function listFleetAgentDirs(vaultDir) {
  const agentsDir = join(vaultDir, 'agents')
  if (!existsSync(agentsDir)) return []
  return readdirSync(agentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !NON_AGENT_DIRS.has(e.name))
    .map((e) => e.name)
    .sort()
}

/**
 * Read one agent's runs.jsonl + status.json (for its expected cadence) from
 * a vault clone. Missing files are tolerated (an agent that has never run
 * yet) -> `{runs: [], cadenceMin: undefined}`. Impure (fs).
 */
export function readAgentRunData(vaultDir, agent) {
  const runsPath = join(vaultDir, 'agents', agent, 'runs.jsonl')
  const statusPath = join(vaultDir, 'agents', agent, 'status.json')
  const runsText = existsSync(runsPath) ? readFileSync(runsPath, 'utf8') : null
  const statusText = existsSync(statusPath) ? readFileSync(statusPath, 'utf8') : null
  const status = parseStatusJson(statusText)
  return {
    runs: parseRunsJsonl(runsText),
    cadenceMin: typeof status?.expected_cadence_min === 'number' ? status.expected_cadence_min : undefined,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Full run
// ─────────────────────────────────────────────────────────────────────────

/**
 * Full audit run: list every fleet agent -> read its trailing-week runs ->
 * compute metrics -> (optionally) sample accuracy -> render the report ->
 * generate proposals (always status: pending) -> write everything under
 * `agents/supervisor/**` + `proposals/**` -> log its own run (S47) -> commit
 * + push (own PAT). `vaultDir` is a working-copy clone of LiveOS-VaultRepo.
 * `push` and `sample` are both overridable for tests/dry-runs (S55 DoD #3/#4).
 *
 * Commits + pushes ONLY the report file, any proposal files written this
 * run, and its own runs.jsonl/status.json — nothing outside
 * `agents/supervisor/**` + `proposals/**` (S55 DoD #3).
 */
export async function run({
  vaultDir,
  now = new Date(),
  apiKey = process.env.ANTHROPIC_API_KEY,
  sample,
  fetchImpl = fetch,
  push = commitAndPush,
  windowDays = AUDIT_WINDOW_DAYS,
} = {}) {
  if (!vaultDir) throw new Error('run: vaultDir is required')

  const wallClockStart = Date.now()
  const windowEndMs = now.getTime()
  const windowStartMs = windowEndMs - windowDays * 24 * 60 * 60_000
  const dateStr = now.toISOString().slice(0, 10)

  const agents = listFleetAgentDirs(vaultDir)
  const metricsList = []
  const accuracyByAgent = {}

  for (const agent of agents) {
    const { runs: allRuns, cadenceMin } = readAgentRunData(vaultDir, agent)
    const weekRuns = filterRunsInWindow(allRuns, windowStartMs, windowEndMs)
    metricsList.push(computeAgentMetrics(agent, weekRuns, { cadenceMin }))

    const accuracy = await sampleAccuracy({ agent, runs: weekRuns, apiKey, sample, fetchImpl })
    if (accuracy) accuracyByAgent[agent] = accuracy
  }

  const proposals = generateProposals({ date: dateStr, metricsList, accuracyByAgent })
  const proposalAgents = proposals.map((p) => ({ agent: p.agent, date: p.date }))

  const reportMd = renderReport({ date: dateStr, metricsList, accuracyByAgent, proposalAgents })
  const reportRelPath = `agents/supervisor/${dateStr}.md`
  await mkdir(join(vaultDir, 'agents', 'supervisor'), { recursive: true })
  await writeFile(join(vaultDir, 'agents', 'supervisor', `${dateStr}.md`), reportMd, 'utf8')

  const proposalFiles = []
  if (proposals.length > 0) {
    await mkdir(join(vaultDir, 'proposals'), { recursive: true })
    for (const proposal of proposals) {
      const relPath = proposalFilePath(proposal)
      await writeFile(join(vaultDir, relPath), renderProposalMarkdown(proposal), 'utf8')
      proposalFiles.push(relPath)
    }
  }

  const durationMs = Date.now() - wallClockStart
  const { statusPath, runsPath } = logRun(vaultDir, 'supervisor', {
    ok: true,
    note: `${metricsList.length} agent${metricsList.length === 1 ? '' : 's'} audited, ${proposals.length} proposal${proposals.length === 1 ? '' : 's'}`,
    duration_ms: durationMs,
    cadence: AUDIT_WINDOW_DAYS * 24 * 60, // weekly cadence, in minutes
    ts: now.toISOString(),
  })

  const files = [
    reportRelPath,
    ...proposalFiles,
    relative(vaultDir, statusPath).split('\\').join('/'),
    relative(vaultDir, runsPath).split('\\').join('/'),
  ]

  await push(vaultDir, {
    files,
    message: `supervisor: fleet audit ${dateStr} (${metricsList.length} agents, ${proposals.length} proposals)`,
    author: COMMIT_AUTHOR,
  })

  return { ok: true, dateStr, metricsList, proposals, reportPath: reportRelPath, proposalFiles }
}

// Run directly when invoked as a script (`node agents/supervisor/audit.mjs`),
// not when imported (e.g. by audit.test.mjs).
if (import.meta.url === `file://${process.argv[1]}`) {
  const vaultDir = process.env.VAULT_DIR
  if (!vaultDir) {
    console.error('audit.mjs: VAULT_DIR env var is required (path to a LiveOS-VaultRepo clone)')
    process.exit(1)
  }
  run({ vaultDir })
    .then((result) => {
      console.log(
        `supervisor: audited ${result.metricsList.length} agents, ${result.proposals.length} proposal(s) -> ${result.reportPath}`,
      )
    })
    .catch((err) => {
      console.error('supervisor: run failed:', err)
      process.exit(1)
    })
}
