# S28 — Mission dot-tap completes task → warms domain [UI]

Phase 2 · Wave 5 · Deps: S27 · Blocks: S29 (HomeView chain)

## Context
Wire the mission dot to the existing complete flow: tap the §4.3 dot →
task completes through the SyncProvider seam (same path as v1 tap-the-dot,
S8) → vault write when `VITE_VAULT=1` → domain warmth recomputes. Reuse,
do not reimplement: the complete mutation + undo toast already exist
(`src/hooks/useTasks.ts`, `src/components/UndoToast.tsx`).

## Write-set
- MODIFY `src/components/home/MissionCard.tsx` — dot onClick → existing
  complete mutation; hover glow affordance §4.3 (`.dot:hover` fill + 12px
  glow); completed pick leaves the mission list (next pick may backfill).
- NEW/extend `src/components/home/MissionCard.test.tsx`.

## Subtasks
1. Wire dot → complete (via useTasks / SyncProvider — no direct db calls).
2. Undo path still works (toast). 3. Warmth recompute reflected (vitals strip
+ any warmth consumer re-renders via existing reactivity). 4. Tests.

## Definition of Done
1. Tapping a mission dot marks the task done through the existing seam (assert the same mutation fn v1 uses is called — no new write path).
2. Completed task disappears from mission picks; backfill pick appears when available (tested).
3. Undo restores the task and it reappears in picks.
4. Warmth output changes after completion in test fixture (complete → domain heats).
5. Diff touches only MissionCard (+test). Tests green.

## Tests
Vitest: tap → complete called; backfill; undo roundtrip.

## Design refs
§4.3 (dot affordance), §7 (hover glow).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. HomeView-chain: rebase on S27 merge.
