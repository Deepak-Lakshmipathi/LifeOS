# S26 — Vitals row shell: 5 tiles, warmth live, rest stubbed [UI] — VitalsRow chain head

Phase 1 · Wave 3 · Deps: S24, S21 · Blocks: S41, S45 (they extend this file)

## Context
Fills the `VitalsRow.tsx` stub (S24): auto-fit grid of 5 `Vital` tiles
(`docs/DESIGN_LANGUAGE.md` §4.2, §5): **Warmth · Net worth · Burn/income ·
Pipeline · Streak**. Only Warmth is real now (from shipped
`src/warmth/computeWarmth.ts`); the other four show placeholder values marked
stubbed — S41 (money) and S45 (pipeline) wire them to vault files later.

## Write-set
- MODIFY `src/components/cockpit/VitalsRow.tsx` (stub → real). Warmth tile =
  strip variant §4.2: 7 bars, canonical domain order (Building · Career ·
  Growth · Life Admin · Body & Mind · Finance · Relationship), opacity =
  warmth (hot ≈.9 → cold ≈.2), colors = domain tokens.
- NEW `src/components/cockpit/VitalsRow.test.tsx`.

## Subtasks
1. Grid `repeat(auto-fit,minmax(150px,1fr))`. 2. Warmth strip from
computeWarmth output. 3. Four stub tiles via glass `Vital` (count-up works).
4. Tests: warmth mapping.

## Definition of Done
1. 5 tiles render in the named order; grid per §4.2.
2. Warmth tile: 7 bars, fixed canonical order, bar opacity derived from computeWarmth (test: hot domain high-opacity band, cold low band), domain token colors.
3. Stub tiles clearly placeholder (e.g. `—`), no fake-real data.
4. Only VitalsRow.tsx (+test) in diff.
5. Tests green.

## Tests
Vitest: warmth output → bar opacities; 5 tiles present.

## Design refs
§4.2 (tile + warmth strip), §5 (vitals row), §8 Do/Don't (fixed domain order, cold looks cold).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Parallel-safe wave 3.
