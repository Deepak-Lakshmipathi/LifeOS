/**
 * audit.test.mjs — S55 DoD coverage for agents/supervisor/audit.mjs.
 *
 * Fixture runs.jsonl sets -> metrics asserted against hand-computed values
 * (DoD #1), report + proposal rendering roundtripped through the REAL S52
 * parser (`src/vault/supervisor.ts`) to prove they land in the exact
 * contract shape, and the pending-only invariant is proven structurally: no
 * code path — however malformed the input — can make a generated proposal
 * carry any status but `pending` (DoD #2). Accuracy sampling is exercised
 * with an injected mock, capped at 15, and a fully live-network scenario is
 * never constructed — `sampleAccuracy`/`run()` are only ever called here
 * with an injected `sample`, or with no `apiKey` at all (DoD #4). Zero
 * network, zero live git — the commit/push step is exercised with an
 * injected mock `push`.
 */
import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseReport, parseProposal } from '../../src/vault/supervisor.ts'
import {
  parseRunsJsonl,
  parseStatusJson,
  filterRunsInWindow,
  computeFailureCount,
  computeAvgDurationMs,
  computeDurationPercentile,
  detectStalenessIncidents,
  computeAgentMetrics,
  sampleAccuracy,
  MAX_ACCURACY_SAMPLES,
  renderFleetLine,
  renderConcernLine,
  renderReport,
  generateProposals,
  renderProposalMarkdown,
  proposalFilePath,
  listFleetAgentDirs,
  readAgentRunData,
  run,
  FAILURE_RATE_THRESHOLD,
  ACCURACY_THRESHOLD,
  STALENESS_MULTIPLIER,
} from './audit.mjs'

// ── Fixture: a "healthy" agent (10 runs, 0 failures, tight hourly cadence,
// same day so consecutive gaps are always 1h -- well inside a 60min-cadence
// agent's 2h staleness threshold). ──────────────────────────────────────────
const HEALTHY_RUNS = [
  { ts: '2026-07-17T06:00:00Z', ok: true, duration_ms: 4000, note: 'ok' },
  { ts: '2026-07-17T07:00:00Z', ok: true, duration_ms: 6000, note: 'ok' },
  { ts: '2026-07-17T08:00:00Z', ok: true, duration_ms: 5000, note: 'ok' },
  { ts: '2026-07-17T09:00:00Z', ok: true, duration_ms: 7000, note: 'ok' },
  { ts: '2026-07-17T10:00:00Z', ok: true, duration_ms: 3000, note: 'ok' },
  { ts: '2026-07-17T11:00:00Z', ok: true, duration_ms: 8000, note: 'ok' },
  { ts: '2026-07-17T12:00:00Z', ok: true, duration_ms: 5000, note: 'ok' },
  { ts: '2026-07-17T13:00:00Z', ok: true, duration_ms: 9000, note: 'ok' },
  { ts: '2026-07-17T14:00:00Z', ok: true, duration_ms: 2000, note: 'ok' },
  { ts: '2026-07-17T15:00:00Z', ok: true, duration_ms: 1000, note: 'ok' },
]
// Hand-computed: avg = (4+6+5+7+3+8+5+9+2+1)/10 * 1000 = 5000ms.
// Sorted durations (ms): 1000,2000,3000,4000,5000,5000,6000,7000,8000,9000
// p50: rank=ceil(0.5*10)=5 -> durations[4] = 5000
// p95: rank=ceil(0.95*10)=10 -> durations[9] = 9000

// ── Fixture: a "flaky" agent (10 runs, 3 failures = 30% > 10% threshold;
// one deliberate 6.5h gap between the 09:00 and 15:30 runs -- the only gap
// exceeding a 60min-cadence agent's 2h staleness threshold). ───────────────
const FLAKY_RUNS = [
  { ts: '2026-07-17T06:00:00Z', ok: true, duration_ms: 1000, note: 'ok run' },
  { ts: '2026-07-17T07:00:00Z', ok: false, duration_ms: 500, note: 'timeout' },
  { ts: '2026-07-17T08:00:00Z', ok: true, duration_ms: 1500, note: 'ok run' },
  { ts: '2026-07-17T09:00:00Z', ok: false, duration_ms: 500, note: 'timeout' },
  { ts: '2026-07-17T15:30:00Z', ok: true, duration_ms: 1200, note: 'ok run' }, // 6.5h gap from prior
  { ts: '2026-07-17T16:30:00Z', ok: true, duration_ms: 1100, note: 'ok run' },
  { ts: '2026-07-17T17:30:00Z', ok: false, duration_ms: 500, note: 'timeout' },
  { ts: '2026-07-17T18:30:00Z', ok: true, duration_ms: 1300, note: 'ok run' },
  { ts: '2026-07-17T19:30:00Z', ok: true, duration_ms: 1400, note: 'ok run' },
  { ts: '2026-07-17T20:30:00Z', ok: true, duration_ms: 1600, note: 'ok run' },
]
const FLAKY_CADENCE_MIN = 60 // hourly cron -> staleness threshold is 2h

describe('parseRunsJsonl', () => {
  it('parses well-formed lines and skips a truncated/malformed final line', () => {
    const text =
      '{"ts":"2026-07-15T06:00:00Z","ok":true,"note":"a","duration_ms":100}\n' +
      '{"ts":"2026-07-15T07:00:00Z","ok":false}\n' +
      '{"ts":"2026-07-15T08:00' // truncated
    const runs = parseRunsJsonl(text)
    expect(runs).toHaveLength(2)
    expect(runs[0]).toEqual({ ts: '2026-07-15T06:00:00Z', ok: true, note: 'a', duration_ms: 100 })
    expect(runs[1]).toEqual({ ts: '2026-07-15T07:00:00Z', ok: false })
  })

  it('returns [] for null/undefined/empty input', () => {
    expect(parseRunsJsonl(null)).toEqual([])
    expect(parseRunsJsonl(undefined)).toEqual([])
    expect(parseRunsJsonl('')).toEqual([])
  })
})

describe('parseStatusJson', () => {
  it('parses a well-formed status object', () => {
    expect(parseStatusJson('{"agent":"a","expected_cadence_min":60}')).toEqual({
      agent: 'a',
      expected_cadence_min: 60,
    })
  })
  it('returns null on malformed JSON or non-object', () => {
    expect(parseStatusJson('not json')).toBeNull()
    expect(parseStatusJson('null')).toBeNull()
    expect(parseStatusJson(null)).toBeNull()
  })
})

describe('metrics — hand-computed against HEALTHY_RUNS', () => {
  it('computeFailureCount', () => {
    expect(computeFailureCount(HEALTHY_RUNS)).toBe(0)
    expect(computeFailureCount(FLAKY_RUNS)).toBe(3)
  })

  it('computeAvgDurationMs', () => {
    expect(computeAvgDurationMs(HEALTHY_RUNS)).toBe(5000)
  })

  it('computeAvgDurationMs is null when no run recorded a duration', () => {
    expect(computeAvgDurationMs([{ ts: '2026-07-15T06:00:00Z', ok: true }])).toBeNull()
  })

  it('computeDurationPercentile: p50 and p95', () => {
    expect(computeDurationPercentile(HEALTHY_RUNS, 50)).toBe(5000)
    expect(computeDurationPercentile(HEALTHY_RUNS, 95)).toBe(9000)
  })

  it('computeDurationPercentile is null with no durations present', () => {
    expect(computeDurationPercentile([{ ts: '2026-07-15T06:00:00Z', ok: true }], 50)).toBeNull()
  })
})

describe('detectStalenessIncidents', () => {
  it('flags a gap exceeding cadenceMin * STALENESS_MULTIPLIER', () => {
    // FLAKY_RUNS: cadence 60min -> threshold 2h. The 09:00->15:30 gap
    // is 6.5h, well past 2h -> exactly one incident.
    const incidents = detectStalenessIncidents(FLAKY_RUNS, FLAKY_CADENCE_MIN)
    expect(incidents).toHaveLength(1)
    expect(incidents[0].ts).toBe('2026-07-17T15:30:00Z')
    expect(incidents[0].gapHours).toBe(6.5)
  })

  it('returns [] when cadenceMin is unknown', () => {
    expect(detectStalenessIncidents(FLAKY_RUNS, undefined)).toEqual([])
  })

  it('returns [] with fewer than 2 runs', () => {
    expect(detectStalenessIncidents([HEALTHY_RUNS[0]], 60)).toEqual([])
  })

  it('returns [] when every gap is within cadence', () => {
    expect(detectStalenessIncidents(HEALTHY_RUNS, 60)).toEqual([])
  })
})

describe('computeAgentMetrics — full object matches hand-computed values (S55 DoD #1)', () => {
  it('healthy agent', () => {
    expect(computeAgentMetrics('healthy-agent', HEALTHY_RUNS, { cadenceMin: 60 })).toEqual({
      agent: 'healthy-agent',
      runCount: 10,
      failureCount: 0,
      avgDurationMs: 5000,
      p50DurationMs: 5000,
      p95DurationMs: 9000,
      stalenessIncidents: [],
    })
  })

  it('flaky agent', () => {
    const metrics = computeAgentMetrics('flaky-agent', FLAKY_RUNS, { cadenceMin: FLAKY_CADENCE_MIN })
    expect(metrics.agent).toBe('flaky-agent')
    expect(metrics.runCount).toBe(10)
    expect(metrics.failureCount).toBe(3)
    expect(metrics.stalenessIncidents).toHaveLength(1)
  })
})

describe('filterRunsInWindow', () => {
  it('keeps only runs inside [start, end) and sorts ascending', () => {
    const shuffled = [HEALTHY_RUNS[2], HEALTHY_RUNS[0], HEALTHY_RUNS[1]]
    const result = filterRunsInWindow(shuffled, Date.parse('2026-07-17T00:00:00Z'), Date.parse('2026-07-17T07:30:00Z'))
    expect(result.map((r) => r.ts)).toEqual([
      '2026-07-17T06:00:00Z',
      '2026-07-17T07:00:00Z',
    ])
  })

  it('excludes runs at/after the end boundary and before the start boundary', () => {
    const result = filterRunsInWindow(HEALTHY_RUNS, Date.parse('2026-07-17T06:00:00Z'), Date.parse('2026-07-17T08:00:00Z'))
    expect(result.map((r) => r.ts)).toEqual(['2026-07-17T06:00:00Z', '2026-07-17T07:00:00Z'])
  })
})

describe('renderReport <-> parseReport roundtrip (real S52 parser, DoD #1)', () => {
  const healthyMetrics = computeAgentMetrics('healthy-agent', HEALTHY_RUNS, { cadenceMin: 60 })
  const flakyMetrics = computeAgentMetrics('flaky-agent', FLAKY_RUNS, { cadenceMin: FLAKY_CADENCE_MIN })
  const accuracyByAgent = { 'healthy-agent': { sampled: 5, correct: 5 } }
  const proposalAgents = [{ agent: 'flaky-agent', date: '2026-07-19' }]

  const md = renderReport({
    date: '2026-07-19',
    metricsList: [healthyMetrics, flakyMetrics],
    accuracyByAgent,
    proposalAgents,
  })

  it('parses via the real S52 parseReport with the expected date', () => {
    const parsed = parseReport(md)
    expect(parsed.date).toBe('2026-07-19')
  })

  it('Fleet week section carries every agent\'s exact hand-computed run/failure counts', () => {
    const parsed = parseReport(md)
    const fleetWeek = parsed.sections['Fleet week']
    expect(fleetWeek).toContain('healthy-agent: 10 runs, 0 failures, avg 5.0s. Accuracy sample: 5/5 correct.')
    // FLAKY_RUNS durations sum to 10600ms / 10 runs = 1060ms avg -> "1.1s".
    expect(fleetWeek).toContain('flaky-agent: 10 runs, 3 failures, avg 1.1s.')
  })

  it('Concerns section carries the flaky agent\'s staleness incident, not the healthy agent', () => {
    const parsed = parseReport(md)
    expect(parsed.sections['Concerns']).toContain('flaky-agent stale 1 time')
    expect(parsed.sections['Concerns']).not.toContain('healthy-agent')
  })

  it('Proposals section links to the generated proposal file', () => {
    const parsed = parseReport(md)
    expect(parsed.sections['Proposals']).toBe('- [[proposals/flaky-agent-2026-07-19]]')
  })

  it('omits Concerns/Proposals sections entirely when there is nothing to report', () => {
    const cleanMd = renderReport({ date: '2026-07-19', metricsList: [healthyMetrics] })
    const parsed = parseReport(cleanMd)
    expect(parsed.sections['Concerns']).toBeUndefined()
    expect(parsed.sections['Proposals']).toBeUndefined()
    expect(parsed.sections['Fleet week']).toContain('healthy-agent')
  })
})

describe('renderFleetLine / renderConcernLine (pure formatting)', () => {
  it('renders run/failure counts with correct pluralization', () => {
    expect(renderFleetLine({ agent: 'a', runCount: 1, failureCount: 1, avgDurationMs: null })).toBe(
      '- a: 1 run, 1 failure.',
    )
    expect(renderFleetLine({ agent: 'a', runCount: 0, failureCount: 0, avgDurationMs: null })).toBe(
      '- a: 0 runs, 0 failures.',
    )
  })

  it('renderConcernLine returns null when there are no incidents', () => {
    expect(renderConcernLine({ agent: 'a', stalenessIncidents: [] })).toBeNull()
  })
})

describe('generateProposals — threshold-triggered, content only (no status field)', () => {
  it('flags the flaky agent (30% failure rate > 10% threshold) and not the healthy one', () => {
    const healthyMetrics = computeAgentMetrics('healthy-agent', HEALTHY_RUNS, { cadenceMin: 60 })
    const flakyMetrics = computeAgentMetrics('flaky-agent', FLAKY_RUNS, { cadenceMin: FLAKY_CADENCE_MIN })
    const proposals = generateProposals({ date: '2026-07-19', metricsList: [healthyMetrics, flakyMetrics] })
    expect(proposals).toHaveLength(1)
    expect(proposals[0].agent).toBe('flaky-agent')
    expect(proposals[0]).not.toHaveProperty('status')
    expect(proposals[0].change).toContain('3/10 runs failed')
  })

  it('also flags on a low accuracy sample, independent of failure rate', () => {
    const metrics = computeAgentMetrics('quiet-agent', HEALTHY_RUNS, { cadenceMin: 60 })
    const proposals = generateProposals({
      date: '2026-07-19',
      metricsList: [metrics],
      accuracyByAgent: { 'quiet-agent': { sampled: 10, correct: 7 } }, // 70% < 90% threshold
    })
    expect(proposals).toHaveLength(1)
    expect(proposals[0].why).toContain('70%')
  })

  it('returns [] for a fully healthy fleet', () => {
    const metrics = computeAgentMetrics('healthy-agent', HEALTHY_RUNS, { cadenceMin: 60 })
    expect(generateProposals({ date: '2026-07-19', metricsList: [metrics] })).toEqual([])
  })

  it('thresholds are the documented constants', () => {
    expect(FAILURE_RATE_THRESHOLD).toBe(0.1)
    expect(ACCURACY_THRESHOLD).toBe(0.9)
    expect(STALENESS_MULTIPLIER).toBe(2)
  })
})

describe('renderProposalMarkdown <-> parseProposal roundtrip (real S52 parser)', () => {
  const proposal = {
    agent: 'flaky-agent',
    date: '2026-07-19',
    change: 'Investigate elevated failure rate.',
    diff: '- before\n+ after',
    why: 'Failure rate exceeded threshold.',
  }
  const md = renderProposalMarkdown(proposal)

  it('parses to status pending with every field intact', () => {
    const parsed = parseProposal(md)
    expect(parsed.agent).toBe('flaky-agent')
    expect(parsed.date).toBe('2026-07-19')
    expect(parsed.status).toBe('pending')
    expect(parsed.change).toBe('Investigate elevated failure rate.')
    expect(parsed.diff).toContain('- before')
    expect(parsed.why).toBe('Failure rate exceeded threshold.')
  })

  it('proposalFilePath matches the S52 proposals/<agent>-<date>.md naming', () => {
    expect(proposalFilePath(proposal)).toBe('proposals/flaky-agent-2026-07-19.md')
  })
})

describe('pending-only invariant: no code path can emit approved (S55 DoD #2)', () => {
  it('renderProposalMarkdown IGNORES an injected proposal.status field entirely', () => {
    // A maliciously (or accidentally) constructed proposal object carrying its
    // own `status: 'approved'` must still be rendered — and parse — as pending.
    // This is the load-bearing assertion for DoD #2: the function never reads
    // proposal.status at all.
    const malicious = {
      agent: 'flaky-agent',
      date: '2026-07-19',
      status: 'approved',
      change: 'x',
      diff: 'y',
      why: 'z',
    }
    const md = renderProposalMarkdown(malicious)
    expect(parseProposal(md).status).toBe('pending')
    expect(md).toContain('status: pending')
    expect(md).not.toMatch(/status:\s*approved(?!\s*\|)/) // "approved" only ever inside the "pending | approved | rejected" comment
  })

  it('every proposal generated from a mixed/unhealthy fixture fleet parses to pending', () => {
    const flakyMetrics = computeAgentMetrics('flaky-agent', FLAKY_RUNS, { cadenceMin: FLAKY_CADENCE_MIN })
    const proposals = generateProposals({
      date: '2026-07-19',
      metricsList: [flakyMetrics],
      accuracyByAgent: { 'flaky-agent': { sampled: 10, correct: 2 } },
    })
    expect(proposals.length).toBeGreaterThan(0)
    for (const p of proposals) {
      const parsed = parseProposal(renderProposalMarkdown(p))
      expect(parsed.status).toBe('pending')
    }
  })

  it('the literal "pending" is hardcoded in the template; status is never interpolated from a variable', () => {
    // Read the source relative to the repo root (how every documented
    // `npx vitest run agents/...` invocation in this repo is run), rather
    // than via import.meta.url -- Vitest's SSR transform for a directly
    // imported .mjs test file doesn't always yield a proper file:// URL.
    const source = readFileSync(join(process.cwd(), 'agents', 'supervisor', 'audit.mjs'), 'utf8')
    expect(source).toContain('status: pending #')
    // No `status: ${...}` anywhere -- proves the frontmatter status value is
    // never built from an interpolated expression (i.e. never from a variable).
    expect(source).not.toMatch(/status:\s*\$\{/)
  })
})

describe('sampleAccuracy — mockable, hard-capped at 15, zero live calls (S55 DoD #4)', () => {
  it('returns null (no calls) when apiKey is absent', async () => {
    const sample = vi.fn()
    const result = await sampleAccuracy({ agent: 'a', runs: FLAKY_RUNS, sample })
    expect(result).toBeNull()
    expect(sample).not.toHaveBeenCalled()
  })

  it('returns null (no calls) when no runs carry a note', async () => {
    const sample = vi.fn()
    const result = await sampleAccuracy({
      agent: 'a',
      runs: [{ ts: '2026-07-15T06:00:00Z', ok: true }],
      apiKey: 'fake-key',
      sample,
    })
    expect(result).toBeNull()
    expect(sample).not.toHaveBeenCalled()
  })

  it('caps sampling at MAX_ACCURACY_SAMPLES=15 even when more note-bearing runs exist', async () => {
    const manyRuns = Array.from({ length: 20 }, (_, i) => ({
      ts: `2026-07-1${(i % 9) + 1}T06:00:00Z`,
      ok: true,
      note: `run ${i}`,
    }))
    const sample = vi.fn().mockResolvedValue(true)
    const result = await sampleAccuracy({ agent: 'a', runs: manyRuns, apiKey: 'fake-key', sample })
    expect(MAX_ACCURACY_SAMPLES).toBe(15)
    expect(sample).toHaveBeenCalledTimes(15)
    expect(result).toEqual({ sampled: 15, correct: 15 })
  })

  it('a caller-passed cap can only lower the effective cap, never raise it past 15', async () => {
    const manyRuns = Array.from({ length: 20 }, (_, i) => ({
      ts: `2026-07-1${(i % 9) + 1}T06:00:00Z`,
      ok: true,
      note: `run ${i}`,
    }))
    const sample = vi.fn().mockResolvedValue(true)
    await sampleAccuracy({ agent: 'a', runs: manyRuns, apiKey: 'fake-key', sample, cap: 999 })
    expect(sample).toHaveBeenCalledTimes(15)
  })

  it('counts correct vs sampled from the injected mock, never touching a real fetch', async () => {
    const fetchImpl = vi.fn(() => {
      throw new Error('sampleAccuracy must never call fetch directly when `sample` is injected')
    })
    const sample = vi.fn(({ run }) => Promise.resolve(run.note === 'good'))
    const runs = [
      { ts: '2026-07-15T06:00:00Z', ok: true, note: 'good' },
      { ts: '2026-07-15T07:00:00Z', ok: true, note: 'bad' },
      { ts: '2026-07-15T08:00:00Z', ok: true, note: 'good' },
    ]
    const result = await sampleAccuracy({ agent: 'a', runs, apiKey: 'fake-key', sample, fetchImpl })
    expect(result).toEqual({ sampled: 3, correct: 2 })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('listFleetAgentDirs / readAgentRunData (fs, temp dir)', () => {
  // Each `it` below builds and tears down its own temp dir explicitly
  // (rather than a shared beforeEach/afterEach) for isolation and clarity.
  let vaultDir

  it('excludes agents/lib and agents/supervisor from the fleet list', () => {
    vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-supervisor-'))
    try {
      mkdirSync(join(vaultDir, 'agents', 'email-triage'), { recursive: true })
      mkdirSync(join(vaultDir, 'agents', 'lib'), { recursive: true })
      mkdirSync(join(vaultDir, 'agents', 'supervisor'), { recursive: true })
      expect(listFleetAgentDirs(vaultDir)).toEqual(['email-triage'])
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })

  it('returns [] when there is no agents/ dir yet', () => {
    vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-supervisor-'))
    try {
      expect(listFleetAgentDirs(vaultDir)).toEqual([])
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })

  it('readAgentRunData tolerates a missing runs.jsonl/status.json (never-ran agent)', () => {
    vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-supervisor-'))
    try {
      mkdirSync(join(vaultDir, 'agents', 'brand-new'), { recursive: true })
      expect(readAgentRunData(vaultDir, 'brand-new')).toEqual({ runs: [], cadenceMin: undefined })
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })

  it('readAgentRunData reads real runs.jsonl + cadence from status.json', () => {
    vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-supervisor-'))
    try {
      const dir = join(vaultDir, 'agents', 'email-triage')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'runs.jsonl'), '{"ts":"2026-07-15T06:00:00Z","ok":true}\n')
      writeFileSync(join(dir, 'status.json'), JSON.stringify({ agent: 'email-triage', expected_cadence_min: 60 }))
      const data = readAgentRunData(vaultDir, 'email-triage')
      expect(data.runs).toHaveLength(1)
      expect(data.cadenceMin).toBe(60)
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })
})

describe('run() — full pipeline against a temp vault dir, mocked push (DoD #1/#3)', () => {
  function makeVault() {
    const vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-supervisor-run-'))
    const healthyDir = join(vaultDir, 'agents', 'healthy-agent')
    const flakyDir = join(vaultDir, 'agents', 'flaky-agent')
    mkdirSync(healthyDir, { recursive: true })
    mkdirSync(flakyDir, { recursive: true })
    writeFileSync(join(healthyDir, 'runs.jsonl'), HEALTHY_RUNS.map((r) => JSON.stringify(r)).join('\n') + '\n')
    writeFileSync(healthyDir + '/status.json', JSON.stringify({ agent: 'healthy-agent', expected_cadence_min: 60 }))
    writeFileSync(join(flakyDir, 'runs.jsonl'), FLAKY_RUNS.map((r) => JSON.stringify(r)).join('\n') + '\n')
    writeFileSync(flakyDir + '/status.json', JSON.stringify({ agent: 'flaky-agent', expected_cadence_min: 60 }))
    return vaultDir
  }

  it('writes a parseable report + a pending proposal, logs its own run, and pushes only its own Write-set', async () => {
    const vaultDir = makeVault()
    try {
      const push = vi.fn().mockResolvedValue({ ok: true, attempts: 1 })
      const now = new Date('2026-07-22T00:30:00Z') // Sunday 06:00 IST

      const result = await run({ vaultDir, now, push }) // no apiKey -> sampling skipped entirely

      expect(result.ok).toBe(true)
      expect(result.dateStr).toBe('2026-07-22')

      // Report file written and parses via the real S52 parser.
      const reportPath = join(vaultDir, 'agents', 'supervisor', '2026-07-22.md')
      expect(existsSync(reportPath)).toBe(true)
      const parsedReport = parseReport(readFileSync(reportPath, 'utf8'))
      expect(parsedReport.date).toBe('2026-07-22')
      expect(parsedReport.sections['Fleet week']).toContain('healthy-agent')
      expect(parsedReport.sections['Fleet week']).toContain('flaky-agent')

      // Proposal file written (flaky-agent's 30% failure rate) and parses to pending.
      expect(result.proposals.length).toBeGreaterThan(0)
      const proposalPath = join(vaultDir, 'proposals', 'flaky-agent-2026-07-22.md')
      expect(existsSync(proposalPath)).toBe(true)
      const parsedProposal = parseProposal(readFileSync(proposalPath, 'utf8'))
      expect(parsedProposal.status).toBe('pending')
      expect(parsedProposal.agent).toBe('flaky-agent')

      // Own S47 run log written under its own directory.
      expect(existsSync(join(vaultDir, 'agents', 'supervisor', 'runs.jsonl'))).toBe(true)
      expect(existsSync(join(vaultDir, 'agents', 'supervisor', 'status.json'))).toBe(true)

      // Push called exactly once, with files strictly inside the Write-set
      // (agents/supervisor/** + proposals/**) -- DoD #3.
      expect(push).toHaveBeenCalledTimes(1)
      const [pushedVaultDir, pushOpts] = push.mock.calls[0]
      expect(pushedVaultDir).toBe(vaultDir)
      expect(pushOpts.files.length).toBeGreaterThan(0)
      for (const f of pushOpts.files) {
        expect(f.startsWith('agents/supervisor/') || f.startsWith('proposals/')).toBe(true)
      }
      expect(pushOpts.author).toContain('lifeos-supervisor')
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })

  it('generates zero proposals and no Proposals section for an all-healthy fleet', async () => {
    const vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-supervisor-run-'))
    try {
      const healthyDir = join(vaultDir, 'agents', 'healthy-agent')
      mkdirSync(healthyDir, { recursive: true })
      writeFileSync(join(healthyDir, 'runs.jsonl'), HEALTHY_RUNS.map((r) => JSON.stringify(r)).join('\n') + '\n')

      const push = vi.fn().mockResolvedValue({ ok: true, attempts: 1 })
      const now = new Date('2026-07-22T00:30:00Z')
      const result = await run({ vaultDir, now, push })

      expect(result.proposals).toEqual([])
      expect(existsSync(join(vaultDir, 'proposals'))).toBe(false)
      const parsed = parseReport(readFileSync(join(vaultDir, 'agents', 'supervisor', '2026-07-22.md'), 'utf8'))
      expect(parsed.sections['Proposals']).toBeUndefined()
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })

  it('wires an injected accuracy `sample` through to the report and proposals, never touching real fetch', async () => {
    const vaultDir = makeVault()
    try {
      const push = vi.fn().mockResolvedValue({ ok: true, attempts: 1 })
      const fetchImpl = vi.fn(() => {
        throw new Error('must never be called: sample is injected')
      })
      // Low accuracy for healthy-agent (which has no failures) so its proposal
      // trigger is isolated to the accuracy path, proving that wiring end-to-end.
      const sample = vi.fn().mockResolvedValue(false)
      const now = new Date('2026-07-22T00:30:00Z')

      const result = await run({ vaultDir, now, push, apiKey: 'fake-key', sample, fetchImpl })

      expect(fetchImpl).not.toHaveBeenCalled()
      const healthyProposal = result.proposals.find((p) => p.agent === 'healthy-agent')
      expect(healthyProposal).toBeDefined()
      expect(healthyProposal.why).toContain('0%') // 0/10 correct
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })

  it('throws when vaultDir is missing', async () => {
    await expect(run({})).rejects.toThrow(/vaultDir/)
  })
})
