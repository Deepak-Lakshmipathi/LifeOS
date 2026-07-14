# S22 — Aurora canvas background [UI]

Phase 0 · Wave 1 · Deps: S20 · Blocks: S24 (mounts it)

## Context
The living ground under all glass: 4 drifting radial-gradient blobs on a fixed
canvas (`docs/DESIGN_LANGUAGE.md` §7 row 1, §2.3 Z). Palette will be swapped by
time-of-day (S23) — accept colors as a prop.

## Write-set
- NEW `src/components/glass/Aurora.tsx` — fixed canvas `inset:0; z-index:0;
  opacity:.55; pointer-events:none`; rAF loop `tick+=.004`, blob offset
  `sin/cos × .05` viewport, radius 280–380, color-stop `blob+"cc"→transparent`.
  Prop: `palette: [string,string,string,string]` (default morning palette §6).
  Resize handler. Cleanup on unmount (cancel rAF, remove listeners).
- NEW `src/components/glass/Aurora.test.tsx`.

## Subtasks
1. Canvas draw loop per spec. 2. Palette prop. 3. Reduced-motion: check
`matchMedia("(prefers-reduced-motion: reduce)")` — paint ONE static frame,
never schedule rAF. 4. Unmount cleanup. 5. Tests.

## Definition of Done
1. Component exists; mounts a fixed, pointer-events-none canvas at z0, opacity .55.
2. Under reduced-motion, `requestAnimationFrame` is NOT called after the first static paint (test with a spy).
3. Palette prop changes the drawn colors; default = morning palette `#312e81 #155e75 #4c1d95 #134e4a`.
4. Unmount cancels the rAF loop (no leaked timers in test).
5. Tests green; nothing else in the app modified.

## Tests
Vitest/jsdom: mounts, rAF spy under reduced-motion, cleanup.

## Design refs
§2.3 (Z), §6 (palettes), §7 (aurora drift + reduced-motion contract).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet.
