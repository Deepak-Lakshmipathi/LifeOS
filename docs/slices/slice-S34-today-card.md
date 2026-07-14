# S34 — Today card: slots, event chips, gap-fit hints [UI]

Phase 4 · Wave 8 · Deps: S33 (+S32 HomeView chain) · Blocks: S37 (chain)

## Context
Home right-stack calendar card (`docs/DESIGN_LANGUAGE.md` §4.5): time slots
with GCal-style tinted event chips (NO accent bars) and italic gap hints that
ALWAYS suggest a fitting task — "a gap is an opportunity, not whitespace" (§8).
Fit source: open tasks (rankNow order) whose effort plausibly fits; simple
heuristic is fine, mark it with a `ponytail:` ceiling comment.

## Write-set
- NEW `src/components/home/TodayCard.tsx` — §4.5 anatomy: slot rows (52px time
  column, hairline dividers), chips tinted by type (call/deep/gym per §4.5
  colors), gap rows italic 12px `--faint` indented 64px with a suggested task.
- NEW `src/lib/gapFit.ts` — `gapFit(gaps, tasks) → Map<gap, task|null>`
  (top-ranked open task; suggest quiz/course-like short tasks for <60min gaps
  — naive keyword/priority heuristic, ceiling-commented).
- MODIFY `src/components/home/HomeView.tsx` — mount TodayCard.
- NEW tests.

## Subtasks
1. Card render from S33 parser (fixture). 2. Stale-date banner (file date ≠
today → dim "yesterday's plan" note). 3. gapFit + hint rows. 4. Mount. 5. Tests.

## Definition of Done
1. Fixture renders: every event as a tinted chip (correct §4.5 tint per type), times tabular, no accent bars.
2. Every gap from freeGaps renders a hint row; when a task fits, the hint names it (tested); no blank gaps.
3. Stale file date → visible staleness note (tested).
4. gapFit is pure + unit-tested separately from the DOM.
5. Diff = TodayCard, gapFit, HomeView (+tests). Tests green.

## Tests
Vitest: fixture render, gap hints present, staleness, gapFit unit.

## Design refs
§4.5 (full), §8 (suggest a use for every gap; tint don't bar).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. HomeView-chain: rebase on S32 merge.
