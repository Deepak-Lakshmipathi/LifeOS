# S44 — Career tab: pipeline kanban + courses [UI]

Phase 7 · Wave 4 · Deps: S43 · Blocks: —

## Context
Fills the `CareerView.tsx` stub (S24) per `docs/DESIGN_LANGUAGE.md` §4.10 + §5:
full-width 4-column pipeline kanban (Found · Applied · Interview · Closed)
from `Career/pipeline.md`, then a Courses card with progress bars + next-lesson
pointers. Fixture-backed (S43); live entries arrive via owner edits + S46.

## Write-set (own dir)
- MODIFY `src/components/career/CareerView.tsx` (stub → real).
- NEW `src/components/career/PipelineBoard.tsx` — §4.10: 4 cols (2 cols
  ≤840px), col header uppercase + right count, job cards (13px title, 11.5px
  dim sub: source/match/age/next), `.hot` = sky border + ⚡, closed opacity .55.
- NEW `src/components/career/CoursesCard.tsx` — title+% row, BarMeter (reuse
  S40 `src/components/money/BarMeter.tsx` — do NOT duplicate it; §4.9 growth/
  body gradients), next-lesson line with `#a5b4fc` pointer.
- NEW tests.

## Subtasks
1. Board + grouping via S43 `groupByStage`. 2. Job card states (hot/closed/
scout-sourced provenance). 3. Courses card (reused BarMeter). 4. Tests.

## Definition of Done
1. Fixture renders 4 columns in canonical order with correct counts; empty stage renders empty column (not missing).
2. Hot card shows §4.10 urgent treatment; closed cards dimmed; scout-sourced cards show provenance (§8).
3. CoursesCard reuses the existing BarMeter component (import path asserted in review — no copy).
4. Course rows: % value, gradient bar, next-lesson pointer styled per §4.10.
5. Diff confined to `src/components/career/` (+tests). Tests green.

## Tests
Vitest: fixture render, stage grouping, card states.

## Design refs
§4.10 (full), §5 (Career layout).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Parallel-safe (own dir; BarMeter import-only).
