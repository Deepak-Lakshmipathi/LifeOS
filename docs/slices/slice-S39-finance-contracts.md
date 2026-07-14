# S39 — Finance vault contracts + parsers [UI]

Phase 6 · Wave 3 · Deps: S24 (soft) · Blocks: S40, S41, S42

## Context
Money tab reads four vault files owned by the finance-sync agent (S42).
Contracts + parsers + fixtures only. Currency: INR, values may carry `₹` and
lakh shorthand (`18.4L`) — parse both raw numbers and shorthand.

## Contracts — `Finance/`
```markdown
# Finance/networth-history.md — append-only table
| date | networth |
|------|----------|
| 2026-06-01 | 1780000 |
| 2026-07-01 | 1840000 |

# Finance/portfolio.md
- Equity (value:: 920000) (pct:: 50)
- Mutual funds (value:: 552000) (pct:: 30)
- Cash (value:: 368000) (pct:: 20)

# Finance/burn.md
- income (month:: 2026-07) (amount:: 210000)
- spend (month:: 2026-07) (amount:: 96000)

# Finance/bills.md
- [ ] Electricity (amount:: 2340) (due:: 2026-07-20) (source:: gmail)
- [x] Rent (amount:: 32000) (due:: 2026-07-05) (source:: manual)
```

## Write-set
- NEW `src/vault/finance.ts` — types + `parseNetworthHistory` (table →
  sorted series), `parsePortfolio`, `parseBurn` (per-month income/spend
  pairs), `parseBills` (`[x]` = paid; due-in-days helper vs a passed today);
  `formatINR(n)` (₹ + lakh, tabular-friendly).
- NEW fixtures: `src/vault/__fixtures__/finance-{networth,portfolio,burn,bills}.md`.
- NEW `src/vault/finance.test.ts`.

## Subtasks
1. Four parsers (malformed-skip everywhere). 2. formatINR (1840000 → ₹18.4L).
3. dueInDays helper. 4. Fixtures + tests per parser.

## Definition of Done
1. Each of the 4 fixtures parses to the exact expected structure (4 test groups).
2. Networth series sorted by date; delta between last two points computable (tested).
3. Bills: paid flag, dueInDays (≤7 flagged, tested at boundary 7/8 days).
4. formatINR: 1840000→"₹18.4L", 96000→"₹96k" (or documented rule), tabular-safe (tested).
5. NO changes outside `src/vault/`. Tests green.

## Tests
Vitest: 4 fixture groups + helpers.

## Design refs
§4.9 uses these shapes; no UI here.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Fully parallel-safe (own file).
