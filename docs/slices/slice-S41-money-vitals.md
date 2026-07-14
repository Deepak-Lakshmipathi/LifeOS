# S41 — Wire net-worth + burn vital tiles [UI] — VitalsRow chain

Phase 6 · Wave 5 · Deps: S39, S26 · Blocks: S45 (same file)

## Context
Replace two stub tiles in `VitalsRow.tsx` (S26) with real values from the S39
finance parsers: Net worth (value + monthly delta ▲/▼) and Burn/income
(month-to-date spend vs income). Fixture-backed; live once S42 lands.

## Write-set
- MODIFY `src/components/cockpit/VitalsRow.tsx` — two tiles wired; delta sub
  `.up/.dn` per sign; formatINR values; count-up preserved.
- NEW `src/lib/vitalsData.ts` — pure selectors `netWorthVital(series)`,
  `burnVital(burn)` returning {value, sub, dir}.
- MODIFY/extend `src/components/cockpit/VitalsRow.test.tsx` + vitalsData test.

## Subtasks
1. Selectors (delta math: last vs prev networth point; % change). 2. Wire
tiles. 3. Tests.

## Definition of Done
1. Net worth tile shows last series value + signed % delta vs previous point (`.up` gain / `.dn` loss), fixture-tested both directions.
2. Burn tile shows spend vs income for the latest month (sub line names both).
3. Missing/empty finance files → tile falls back to stub `—` (no crash, tested).
4. Selectors pure + unit-tested; VitalsRow test extended.
5. Diff = VitalsRow, vitalsData (+tests). Tests green.

## Tests
Vitest: selector math (gain/loss/empty), tile render.

## Design refs
§4.2 (tile anatomy .up/.dn), §8 (tabular money).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. HOTSPOT: VitalsRow — do not batch with S45; S45 rebases on this.
