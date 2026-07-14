# S30 — Habits vault contract + parser [UI]

Phase 3 · Wave 3 · Deps: S24 (soft — parser itself is standalone) · Blocks: S31, S32

## Context
First new vault contract. Habits live in the vault as an append-only markdown
log — the vault is the bus (see docs/slices/README.md). This slice ships the
contract + parser + committed fixture ONLY (no UI, no warmth change): the
fixture-first rule lets S32 (card) and S31 (warmth feed) build on it.

## Contract — `Habits/log.md` (vault) + `Habits/habits.md` (definitions)
```markdown
# Habits/habits.md — one line per habit
- Course study block (domain:: Growth) (min:: 45m)
- Gym session (domain:: Body & Mind)

# Habits/log.md — append-only hits
- [x] Course study block (date:: 2026-07-14) (source:: pwa)
- [x] Gym session (date:: 2026-07-13) (source:: telegram)
```
Same inline-field style as task lines (`parseTaskLine` precedent,
`src/vault/parseVault.ts`). Unknown fields ignored; malformed lines skipped,
never thrown.

## Write-set
- NEW `src/vault/habits.ts` — types `Habit {name, domain, min?}`,
  `HabitHit {habit, date, source}`; `parseHabits(md)`, `parseHabitLog(md)`,
  `serializeHabitHit(hit)` (exact roundtrip); `weekGrid(hits, habit, today) →
  7 booleans`; `streak(hits, habit, today) → {n, broken}`.
- NEW `src/vault/__fixtures__/habits.md` + `__fixtures__/habits-log.md`.
- NEW `src/vault/habits.test.ts`.

## Subtasks
1. Types + parsers (skip-malformed). 2. Serializer (parse∘serialize = id).
3. weekGrid + streak helpers. 4. Fixtures + tests.

## Definition of Done
1. `parseHabitLog(serializeHabitHit(h) )` roundtrips exactly (property-style test on ≥3 cases).
2. Parser tolerates malformed/unknown lines without throwing (tested).
3. weekGrid returns 7 slots aligned to today; streak counts consecutive days and flags broken (boundary tests: hit today vs yesterday-only).
4. Fixtures committed; domain values constrained to the 7 canonical domains (invalid domain → hit kept, domain undefined).
5. NO changes outside `src/vault/` — no UI, no computeWarmth.
6. Tests green.

## Tests
Vitest: roundtrip, malformed, weekGrid, streak boundaries.

## Design refs
None (no UI). Vault-contract slice.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Fully parallel-safe (own file).
