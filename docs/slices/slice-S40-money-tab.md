# S40 — Money tab: net worth, burn, portfolio, bills [UI]

Phase 6 · Wave 4 · Deps: S39 · Blocks: —

## Context
Fills the `MoneyView.tsx` stub (S24) per `docs/DESIGN_LANGUAGE.md` §4.9 + §5:
top row `1.2fr 1fr` (Net worth big-metric + sparkline · Burn bars), second row
`1fr 1fr` (Portfolio donut + legend · Bills radar). All data from S39 parsers
over committed fixtures until S42's agent goes live; the view takes parsed
props / reads via the vault provider — no fetching logic of its own.

## Write-set (own dir — parallel-safe)
- MODIFY `src/components/money/MoneyView.tsx` (stub → real; layout §5).
- NEW `src/components/money/Sparkline.tsx` — canvas per §4.9 (gridlines, 2.5px
  good-line, gradient area, endpoint dot r4 emphasized).
- NEW `src/components/money/Donut.tsx` — canvas 120×120 per §4.9 (r48, lw16,
  .04rad gaps, slice palette, legend swatches).
- NEW `src/components/money/BarMeter.tsx` — §4.9 track+gradient fills.
- NEW `src/components/money/BillsList.tsx` — §4.9 rows (provenance sub-line,
  due ≤7d → `.dn` red, paid → ✓ faint).
- NEW tests per component + a MoneyView fixture render test.

## Subtasks
1. Layout rows. 2. Big metric + count-up + delta sub. 3. Sparkline. 4. Donut +
legend. 5. Burn bars (income vs spend gradients). 6. Bills rows. 7. Tests.

## Definition of Done
1. MoneyView renders entirely from S39 fixture data; every §4.9 widget present.
2. Sparkline: endpoint dot rendered; area gradient; canvas redraws on data change.
3. Donut: segment angles proportional to pct (tested via drawn-arc math or exposed computed segments); legend labels match.
4. Bills: due-soon red at ≤7 days, paid ✓ dimmed, provenance sub shown (§8).
5. Money values right-aligned tabular, formatted via S39 `formatINR`.
6. Diff confined to `src/components/money/` (+tests). Tests green.

## Tests
Vitest: fixture renders, donut segment math, bills states.

## Design refs
§4.9 (full), §5 (Money layout), §2.2 (big metric), §8 (tabular money).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Parallel-safe (own dir).
