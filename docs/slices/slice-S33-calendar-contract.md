# S33 — Calendar vault contract + parser [UI]

Phase 4 · Wave 3 · Deps: S24 (soft) · Blocks: S34, S35

## Context
Calendar data lands in the vault as markdown written by the calendar-sync
agent (S35); the PWA only ever reads the file. This slice: contract + parser
+ fixture. Gap derivation is pure logic here so the Today card (S34) stays dumb.

## Contract — `Calendar/today.md`
```markdown
# 2026-07-14
- 08:00-09:00 Gym — legs (type:: gym)
- 10:00-11:00 Client call — NorthStar handoff (type:: call)
- 14:00-16:00 Deep work — Module 4 (type:: deep)
```
Types: `call | deep | gym | other` (unknown → other). Day header = ISO date.
Malformed lines skipped, never thrown. File may be stale (yesterday's date) —
parser exposes the date so UI can mark staleness.

## Write-set
- NEW `src/vault/calendar.ts` — `CalEvent {start, end, title, type}`;
  `parseCalendar(md) → {date, events}` ; `freeGaps(events, dayStart="08:00",
  dayEnd="22:00") → Gap[] {start, end, minutes}` (sorted, non-overlapping
  events assumed; overlaps merged defensively).
- NEW `src/vault/__fixtures__/calendar-today.md`.
- NEW `src/vault/calendar.test.ts`.

## Subtasks
1. Parser (+date header, malformed-skip). 2. freeGaps (merge overlaps,
clamp to day bounds). 3. Fixture + tests.

## Definition of Done
1. Fixture parses to the exact expected events (times, titles, types).
2. freeGaps on the fixture returns the correct gap list with minute counts (tested, incl. an overlap-merge case and an empty-day case → one full-day gap).
3. Malformed lines skipped without throwing; unknown type → `other`.
4. Parser exposes the file's date (staleness detectable).
5. NO changes outside `src/vault/`. Tests green.

## Tests
Vitest: parse fixture, gaps (normal/overlap/empty), malformed.

## Design refs
None (no UI). Vault-contract slice.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Fully parallel-safe (own file).
