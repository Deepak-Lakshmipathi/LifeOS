# S48 — Fleet mini strip on Home [UI]

Phase 8 · Wave 10 · Deps: S47 (+S37 HomeView chain) · Blocks: S50 (chain)

## Context
Home right-stack bottom: one §4.7 mini pill per agent — LED (ok/bad/idle,
staleness → amber/red via S47 `healthOf`) + agent name + last-run. Only
failures blink. Reads `agents/*/status.json` fixtures through the vault
provider.

## Write-set
- NEW `src/components/home/FleetStrip.tsx` — §4.7 mini pills; LED classes per
  health; blink ONLY on red/failed (respects reduced-motion global rule);
  relative last-run ("12m ago", tabular).
- MODIFY `src/components/home/HomeView.tsx` — mount at right-stack bottom.
- NEW `src/components/home/FleetStrip.test.tsx`.

## Subtasks
1. Pills from S47 fixtures (good/stale/failed → ok/amber/red LED). 2. Idle
(no file) rendering. 3. Relative time. 4. Mount. 5. Tests.

## Definition of Done
1. Three S47 fixtures render ok/amber/red correctly; missing status → idle LED, no glow.
2. Blink animation class present only on red (tested).
3. Relative last-run correct at minute/hour/day granularity (tested with fixed now).
4. Diff = FleetStrip + HomeView (+test). Tests green.

## Tests
Vitest: health→LED mapping, blink-only-red, relative time.

## Design refs
§4.7 (LED + mini pill), §7 (blink = failures only), §8 (state form+color).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. HomeView-chain: rebase on S37 merge.
