# S45 — Pipeline vital tile + course as mission candidate [UI] — VitalsRow chain

Phase 7 · Wave 6 · Deps: S43, S41 (VitalsRow serial), S27 (mission source) · Blocks: —

## Context
Two wirings: (1) the Pipeline vital tile shows live counts from
`Career/pipeline.md` ("3 active · 1 interview"); (2) the top in-progress
course's `next::` surfaces as a mission candidate — a course lesson can be one
of today's 1–3 picks (career/growth balance pressure made visible).

## Write-set
- MODIFY `src/components/cockpit/VitalsRow.tsx` — pipeline tile wired
  (active = found+applied+interview; sub = interview count or hottest next).
- MODIFY `src/lib/missionPicks.ts` (S27 file) — accept optional
  `courseCandidate` input: synthesized pseudo-task from the most-progressed
  unfinished course (`title = next::`, domain from course, priority 2);
  eligible for picks under the same ranking rules (never displaces a rescue).
- MODIFY `src/lib/vitalsData.ts` — `pipelineVital(entries)` selector.
- Extend tests: vitalsData, missionPicks, VitalsRow.

## Subtasks
1. pipelineVital selector. 2. Tile wire + empty-file fallback. 3. Course →
candidate synthesis + missionPicks integration. 4. Tests.

## Definition of Done
1. Pipeline tile: counts from fixture correct; closed excluded; empty file → `—` stub (tested).
2. Course candidate appears in mission picks when ranked in (fixture: sparse task list → course pick present, with its domain chip); rescue logic unaffected (existing rescue tests still green).
3. Course candidate carries provenance ("from course: <name>") in the why line (§8).
4. missionPicks stays pure; all S27 tests pass unmodified.
5. Diff = VitalsRow, missionPicks, vitalsData (+tests). Tests green.

## Tests
Vitest: selector, candidate inject, rescue unaffected.

## Design refs
§4.2 (tile), §4.3 (why line), §8 (provenance).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. HOTSPOT: VitalsRow + missionPicks — rebase on S41; do not batch with S27/S41.
