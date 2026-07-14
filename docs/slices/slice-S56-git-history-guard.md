# S56 — Git-history guard: shallow depth + log rotation [hardening]

Phase 10 · Wave 5 · Deps: S47 · Blocks: —

## Context
Risk from the systems-architect list: agents commit constantly (runs.jsonl,
status.json, calendar rewrites), so vault history grows and the PWA's
in-browser clone slows. Two guards: (1) the browser clone stays shallow;
(2) a rotation job prunes append-only files monthly.

## Write-set
- MODIFY `src/vault/transport.ts` — ensure clone uses `depth: 1` +
  `singleBranch` (verify: may already; if present, assert via test and move
  on — do not churn).
- MODIFY `services/bot/vaultTransport.ts` — same shallow guarantee.
- NEW `agents/lib/rotate.mjs` — `rotateJsonl(path, keepMonths=3)` (splits by
  month, keeps N, archives the rest to `agents/<name>/archive/<YYYY-MM>.jsonl`)
  + `pruneNetworth(path, keepPoints=24)` (keeps last N table rows).
- NEW `.github/workflows/agent-rotate.yml` — monthly cron running rotation
  across `agents/*/runs.jsonl` + `Finance/networth-history.md`, one commit.
- NEW `agents/lib/rotate.test.mjs`.

## Subtasks
1. Depth audit + tests (browser + bot transports). 2. rotateJsonl (month
split, archive, atomic rewrite). 3. pruneNetworth (keeps table header +
last N rows). 4. Workflow. 5. Tests.

## Definition of Done
1. Both transports request depth:1 singleBranch (asserted in tests/spies).
2. rotateJsonl: 5-month fixture → 3 months kept in place, 2 archived, zero lines lost across files (sum-tested).
3. pruneNetworth keeps header + exactly N most-recent rows, still parses via S39.
4. Rotation is idempotent (second run = no-op, tested).
5. Tests green.

## Tests
Depth spies, rotation fixtures, idempotence.

## Design refs
None.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Touches transport.ts + bot vaultTransport — verify no other in-flight slice edits those (none in v2 plan).
