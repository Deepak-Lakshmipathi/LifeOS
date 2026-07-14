# S25 — Cockpit header: greeting + time control + mission note [UI]

Phase 1 · Wave 3 · Deps: S24, S23 · Blocks: —

## Context
Fills the `Header.tsx` stub (S24): H1 greeting with shine, date/mission-note
subtitle, and the Morning/Midday/Evening segmented control that drives
`useTimeOfDay` override (`docs/DESIGN_LANGUAGE.md` §5 header row, §6).

## Write-set
- MODIFY `src/components/cockpit/Header.tsx` (stub → real). Uses glass
  `Segmented` (S21) + `useTimeOfDay` (S23). Greeting 30/700, shine gradient
  §7 (6s linear infinite; disabled under reduced-motion via the global rule).
  Mission-note subtitle with §6 append pattern (CSS ::after keyed off body class).
- NEW `src/components/cockpit/Header.test.tsx`.

## Subtasks
1. Greeting + shine. 2. Seg control wired to override. 3. Mission-note +
per-mode appends. 4. Tests per mode.

## Definition of Done
1. Header renders §6 greeting for am/mid/pm (test all three via override).
2. Seg control switches mode: body class + greeting + note all change together.
3. Shine animation only on the greeting (nothing else animated).
4. Only Header.tsx (+test) in the diff — App.tsx untouched.
5. Tests green.

## Tests
Vitest: renders per time-of-day; seg click flips mode.

## Design refs
§2.2 (H1), §4.1, §6, §7 (shine).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Parallel-safe with S26/S30/S33/S36/S39/S43/S47.
