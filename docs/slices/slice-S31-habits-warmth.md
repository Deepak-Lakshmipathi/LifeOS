# S31 — Habit hits feed domain warmth [UI]

Phase 3 · Wave 4 · Deps: S30 · Blocks: —

## Context
Habits exist to heat domains: a habit hit is a warmth event for its domain,
exactly like completing a task there (`docs/DESIGN_LANGUAGE.md` §4.6 "habits
feed domain warmth"). Extend the shipped pure seam
`src/warmth/computeWarmth.ts` — v1 lesson: ranking/derivation never lives in
the view.

## Write-set
- MODIFY `src/warmth/computeWarmth.ts` — accept an optional second input:
  `computeWarmth(tasks, events?: WarmthEvent[])` where `WarmthEvent = {domain,
  date}`; habit hits map to events. Backwards-compatible: existing single-arg
  calls unchanged (all current tests must pass untouched).
- NEW `src/warmth/habitEvents.ts` — `habitHitsToEvents(hits, habits)` (joins
  hit → habit → domain, drops unknown habits).
- MODIFY/extend `src/warmth/computeWarmth.test.ts` + NEW habitEvents test.

## Subtasks
1. Widen computeWarmth signature (optional param, no behavior change when
absent). 2. habitEvents mapper. 3. Tests: hit raises warmth.

## Definition of Done
1. All PRE-EXISTING computeWarmth tests pass WITHOUT modification (signature widening only).
2. A habit hit today measurably raises its domain warmth vs the same fixture without the hit (tested).
3. Hits for undefined habits are dropped silently (tested).
4. No UI files in diff.
5. Tests green.

## Tests
Vitest: back-compat, hit-raises-warmth, unknown-habit drop.

## Design refs
§4.6 (habit ↔ domain), §8 (cold looks cold).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Parallel-safe (warmth files only).
