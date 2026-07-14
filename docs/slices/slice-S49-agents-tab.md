# S49 — Agents tab: fleet table [UI] — AgentsView chain head

Phase 8 · Wave 4 · Deps: S47 · Blocks: S53, S54 (same file)

## Context
Fills the `AgentsView.tsx` stub (S24) per `docs/DESIGN_LANGUAGE.md` §4.8:
fleet table — LED · name + purpose sub · infra badge (GH ACTIONS / THIS PC /
VPS, cadence in badge) · last run · log-tail note (last runs.jsonl note; error
notes red). Agent roster comes from a static manifest (name, purpose, infra,
cadence) + live status from S47 fixtures.

## Write-set
- MODIFY `src/components/agents/AgentsView.tsx` (stub → real; fleet table card).
- NEW `src/data/agentManifest.ts` — the roster: daily-brief, email-triage,
  calendar-sync, job-scout, finance-sync, telegram-bot, supervisor — each
  {name, purpose, infra: gha|pc|vps, cadence}.
- NEW `src/components/agents/AgentsView.test.tsx`.

## Subtasks
1. Manifest. 2. Table grid §4.8 (`14px 1.4fr 1fr 1fr 1.6fr`), hairline
dividers. 3. Infra badges (3 tints, cadence text). 4. Log-tail note from
runs fixture (error → red text). 5. Tests.

## Definition of Done
1. All 7 manifest agents render as rows; status from fixtures where present, idle otherwise.
2. Infra badges: correct tint per infra type; cadence shown ("GH ACTIONS · nightly").
3. Failed agent row: red LED blink + red note (tested).
4. Grid/typography per §4.8.
5. Diff = AgentsView + agentManifest (+test). Tests green.

## Tests
Vitest: roster render, badge variants, failure row.

## Design refs
§4.8 (full), §4.7 (LED).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. HOTSPOT: AgentsView — S53/S54 rebase on this.
