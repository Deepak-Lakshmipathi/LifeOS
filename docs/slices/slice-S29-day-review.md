# S29 — Evening Day Review card [UI]

Phase 2 · Wave 6 · Deps: S27 (+S23 modes) · Blocks: S32 (HomeView chain)

## Context
Evening-only reflection card (`docs/DESIGN_LANGUAGE.md` §6): first on Home
when `body.pm`, hidden otherwise. Purple-tinted card with stat pairs:
mission done · tasks completed · domains warmed (computed from today's
completions), plus placeholder pairs (debts owed, tomorrow's seed) for later.

## Write-set
- NEW `src/components/home/DayReview.tsx` — §6 spec: border
  `rgba(167,139,250,.35)`, bg `rgba(167,139,250,.07)`, flex row of stat pairs
  (19px value / 13.5px label). Counts from tasks with `completed_at` = today
  (field shipped in v1) + missionPicks state.
- NEW `src/lib/dayStats.ts` — pure `dayStats(tasks, picks, now) → {missionDone,
  tasksCompleted, domainsWarmed}`.
- MODIFY `src/components/home/HomeView.tsx` — prepend DayReview full-width;
  visibility driven by pm mode (render-gated, not CSS-only, so tests can assert).
- NEW tests.

## Subtasks
1. dayStats pure fn. 2. Card render. 3. pm-only visibility via useTimeOfDay.
4. Tests am vs pm.

## Definition of Done
1. Card renders ONLY in pm mode (test: am/mid hidden, pm shown, using override).
2. dayStats counts correct on fixture (N tasks completed today, M of them mission picks, K distinct domains) — unit-tested.
3. Card is first child on Home in pm.
4. Styling matches §6 (purple tint tokens; stat pair sizes).
5. Tests green; only DayReview/dayStats/HomeView in diff.

## Tests
Vitest: dayStats fixture; visibility per mode.

## Design refs
§6 (Day Review row + card spec).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. HomeView-chain: rebase on S28 merge.
