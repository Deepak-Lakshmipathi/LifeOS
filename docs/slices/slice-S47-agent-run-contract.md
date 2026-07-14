# S47 — Agent-run contract: runs.jsonl + status.json writer + parser [UI]

Phase 8 · Wave 3 · Deps: S24 (soft) · Blocks: S48, S49, S50, S51, S52, S56

## Context
The fleet-health substrate. Every agent logs runs to
`agents/<name>/runs.jsonl` (append) and overwrites `agents/<name>/status.json`
(O(1) staleness read — the health board reads ONLY status.json, never scans
logs). One shared writer helper used by all agent slices (S35/38/42/46 adopt
it opportunistically; S51 retrofits the bot). Loud amber/red, never
silent-stale.

## Contract
```jsonc
// agents/<name>/status.json (overwrite each run)
{ "agent": "email-triage", "last_run": "2026-07-14T09:30:00Z",
  "ok": true, "note": "4 flagged, 1 draft", "duration_ms": 8200,
  "expected_cadence_min": 60 }
// agents/<name>/runs.jsonl (append, one JSON per line)
{ "ts": "...", "ok": true, "note": "...", "duration_ms": 8200 }
```
Staleness: now − last_run > 2× cadence → amber; > 4× or ok:false → red.

## Write-set
- NEW `agents/lib/runLog.mjs` — `logRun(vaultDir, agent, {ok, note,
  duration_ms, cadence})`: appends jsonl + rewrites status.json (both in one
  commit when the caller commits). Plain Node, no deps.
- NEW `src/vault/agentStatus.ts` — PWA-side: `parseStatus(json)`,
  `healthOf(status, now) → "ok"|"amber"|"red"|"idle"` (idle = no status file),
  `parseRuns(jsonl)` (tolerant of truncated last line).
- NEW fixtures `src/vault/__fixtures__/agents/{good,stale,failed}/status.json`.
- NEW tests both sides (`agents/lib/runLog.test.mjs`, `src/vault/agentStatus.test.ts`).

## Subtasks
1. runLog writer (append + overwrite; creates dirs). 2. healthOf thresholds.
3. Tolerant jsonl parser. 4. Fixtures + tests.

## Definition of Done
1. runLog roundtrip: write via helper → parse via `agentStatus.ts` → identical data (cross-tested).
2. healthOf: ok within cadence → ok; >2× → amber; >4× or ok:false → red; missing → idle (all boundary-tested).
3. runs.jsonl parser survives a truncated final line (tested).
4. Helper is dependency-free Node ESM usable from GH Actions, PC, and VPS.
5. Tests green; no UI changes.

## Tests
Roundtrip, thresholds, truncation.

## Design refs
§4.7 LED semantics (ok/bad/idle) map 1:1 to healthOf.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Parallel-safe (new files only).
