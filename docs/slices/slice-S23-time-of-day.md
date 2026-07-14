# S23 — useTimeOfDay: greeting, body class, aurora palette [UI]

Phase 0 · Wave 1 · Deps: S20 · Blocks: S25

## Context
One page, three emphases (`docs/DESIGN_LANGUAGE.md` §6): morning (default) /
midday (`body.mid`) / evening (`body.pm`). v1 already has `src/lib/timeOfDay.ts`
(glass skin) — EXTEND it, do not fork a parallel notion of time.

## Write-set
- MODIFY `src/lib/timeOfDay.ts` — export a v2 mapping: `cockpitMode(date) →
  "am"|"mid"|"pm"` with boundaries: am <12:00, mid 12:00–17:59, pm ≥18:00
  (keep existing v1 exports intact).
- NEW `src/hooks/useTimeOfDay.ts` — returns `{ mode, greeting, palette }`;
  greeting per §6 ("Good morning, Deepak" / "Back at it, Deepak" / "Winding
  down, Deepak"); palette = §6 aurora hex quads; applies/removes `mid`/`pm`
  class on `document.body`; accepts optional override (the seg control drives
  it in-product).
- MODIFY `src/lib/timeOfDay.test.ts` — boundary tests (11:59/12:00/17:59/18:00).
- NEW `src/hooks/useTimeOfDay.test.ts`.

## Subtasks
1. cockpitMode + boundaries. 2. Hook: greeting/palette/body-class + override.
3. Cleanup on unmount (class removed). 4. Tests.

## Definition of Done
1. `cockpitMode` returns am/mid/pm at exact boundaries (tested at 11:59, 12:00, 17:59, 18:00).
2. Hook returns the 3 §6 greetings and the 3 §6 palettes verbatim.
3. Body class: none for am, `mid`, `pm`; override prop wins over clock; class cleaned up on unmount.
4. v1 `timeOfDay` exports unchanged (no existing test breaks).
5. All tests green.

## Tests
Vitest: boundaries, greeting/palette table, body-class lifecycle.

## Design refs
§6 (entire table).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet.
