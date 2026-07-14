# S53 — Supervisor report card on Agents tab [UI]

Phase 9 · Wave 5 · Deps: S52, S49 (AgentsView chain) · Blocks: S54 (chain)

## Context
Below the fleet table (`docs/DESIGN_LANGUAGE.md` §4.8 supervisor card spec):
render the latest weekly report — purple-tinted card, prose 13.5/1.55, inline
metrics as `#c4b5fd` 600 (growth accent token).

## Write-set
- NEW `src/components/agents/SupervisorCard.tsx` — latest report via S52
  parser; sections rendered (Fleet week / Concerns / Proposals count);
  no report yet → quiet empty state ("No supervisor report yet").
- MODIFY `src/components/agents/AgentsView.tsx` — mount below fleet table.
- NEW `src/components/agents/SupervisorCard.test.tsx`.

## Subtasks
1. Card styling per §4.8 (border rgba(167,139,250,.35), bg .06). 2. Section
render + metric highlighting. 3. Empty state. 4. Mount. 5. Tests.

## Definition of Done
1. S52 report fixture renders all sections; numbers inside prose get the metric accent treatment.
2. Missing report → empty state, no crash (tested).
3. Proposal links render as a count/pointer (approval UI is S54, not here).
4. Diff = SupervisorCard + AgentsView (+test). Tests green.

## Tests
Vitest: fixture render, empty state.

## Design refs
§4.8 (supervisor card).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. HOTSPOT: AgentsView — rebase on S49 merge.
