# S50 — daily-brief agent + Home surface [AGENT]

Phase 8 · Wave 11 · Deps: S47 (+S48 for the tiny HomeView edit) · Blocks: —

## Context
GH Actions morning agent: reads the WHOLE vault (tasks, habits, calendar,
attention, finance, career), composes `Briefs/<date>.md` — a 5-line morning
brief (mission preview, first calendar block, top attention item, streak note,
one money fact). Claude-composed (`claude-sonnet-5`) with a strict template.
Home shows today's brief as a dim intro line under the header greeting
(morning mode only). Owns `Briefs/**`.

## Write-set
- NEW `agents/daily-brief/brief.mjs` — vault read (local clone) → context pack
  (compact digest of each file, token-capped) → Claude compose (structured:
  {lines: string[5]}) → write `Briefs/<date>.md` → runLog (S47) → commit/push
  own PAT `AGENT_VAULT_PAT_BRIEFS`.
- NEW `agents/daily-brief/brief.test.mjs` — fixture vault + mocked Claude →
  file written, format asserted; context pack respects cap.
- NEW `.github/workflows/agent-daily-brief.yml` — cron 05:30 IST + dispatch.
- NEW `src/vault/briefs.ts` — `parseBrief(md)`, `latestBriefPath(today)`.
- MODIFY `src/components/home/HomeView.tsx` — morning mode: render brief lines
  dim under header region (1 small block; fixture-backed).
- NEW `agents/daily-brief/README.md` + PWA-side test.

## Subtasks
1. Context pack builder (pure, capped). 2. Compose call (mockable, template-
validated: exactly 5 non-empty lines). 3. Workflow. 4. PWA parse + surface
(am only). 5. Tests both sides.

## Definition of Done
1. Fixture vault + mocked Claude → `Briefs/<date>.md` with exactly 5 lines; malformed model output → retry once then fail loudly via runLog ok:false (tested).
2. Home shows the brief in morning mode only (tested via time override); missing brief → nothing (no error UI).
3. Agent logs runs via S47 helper (status.json written).
4. Writes ONLY `Briefs/**` + its own `agents/daily-brief/` status.
5. Tests green; no live calls in tests.

## Tests
Compose validation, retry-then-fail, am-only surface.

## Design refs
§6 (morning emphasis); brief line = 13px dim text.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. HomeView touch is 1 block — rebase on S48 merge.
