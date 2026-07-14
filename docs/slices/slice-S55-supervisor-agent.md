# S55 — supervisor agent (GH Actions weekly audit → report + proposals) [AGENT]

Phase 9 · Wave 5 · Deps: S52 (contracts; S47 data) · Blocks: —

## Context
Weekly GH Actions agent: reads every `agents/*/runs.jsonl` + status.json,
computes per-agent metrics (runs, failure rate, duration percentiles,
staleness incidents), samples outputs for accuracy where cheap (e.g. attention
labels vs a Claude re-check on N samples), writes the S52 report + zero or
more proposals with `status: pending`. NEVER edits agent prompts/config
itself — proposals only; the owner approves in the PWA (S54). Owns
`agents/supervisor/**` + `proposals/**`.

## Write-set (new dir)
- NEW `agents/supervisor/audit.mjs` — metrics from runs.jsonl (pure fns);
  optional Claude accuracy sampling (mockable, capped N=15); report renderer
  (S52 format); proposal generator (template + Claude-suggested change,
  ALWAYS status: pending); commit/push own PAT `AGENT_VAULT_PAT_SUPERVISOR`;
  logs its own run via S47 helper.
- NEW `agents/supervisor/audit.test.mjs` — fixture runs.jsonl set → metrics
  asserted; report roundtrips via `src/vault/supervisor.ts` parser; generated
  proposal parses with status pending.
- NEW `.github/workflows/agent-supervisor.yml` — cron Sunday 06:00 IST + dispatch.
- NEW `agents/supervisor/README.md` — what it may/may not do (proposals-only
  invariant), sampling cost cap.

## Subtasks
1. Metrics (pure). 2. Report render. 3. Proposal gen (pending-only invariant
enforced in code — status hardcoded). 4. Workflow + README. 5. Tests.

## Definition of Done
1. Fixture fleet week → report with per-agent metrics matching hand-computed values (tested), parsing via S52.
2. Every generated proposal has status pending — grep/assert the literal; no code path can emit approved (tested).
3. Writes ONLY `agents/supervisor/**` + `proposals/**` (+ own runLog).
4. Claude sampling mockable + capped; zero live calls in tests.
5. Tests green.

## Tests
Metrics, roundtrip, pending-only invariant.

## Design refs
None.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Fully parallel-safe (own dir).
