# S32 — Habits card: 7-day grid, streaks, tap-today [UI]

Phase 3 · Wave 7 · Deps: S30 (+S29 HomeView chain) · Blocks: S34 (chain)

## Context
Home right-stack card (`docs/DESIGN_LANGUAGE.md` §4.6): one row per habit —
name + sub, 7-day week grid colored by the habit's domain, streak column.
Tapping today's dashed square appends a hit line to `Habits/log.md` via the
vault layer (fixture-backed in tests; live via SyncProvider/VaultSync path).

## Write-set
- NEW `src/components/home/HabitsCard.tsx` — §4.6 anatomy exactly: grid
  `1fr auto auto`, week squares 11×11 r4 (miss faint, hit `--hc`, today dashed
  clickable), streak column (🔥 hot / ✕ broken / fraction), sub-line ties habit
  to domain ("heats Body & Mind").
- NEW `src/vault/habitsWrite.ts` — `appendHabitHit(transport, hit)`: read
  `Habits/log.md`, append serialized line (S30 serializer), write back.
- MODIFY `src/components/home/HomeView.tsx` — mount HabitsCard (right stack).
- NEW tests (render fixture; tap appends).

## Subtasks
1. Card render from S30 parser output. 2. Tap-today → appendHabitHit → square
flips to hit optimistically. 3. HomeView mount. 4. Tests.

## Definition of Done
1. Renders the committed S30 fixtures: per-habit week grid matches log dates; streak states (hot/broken/fraction) each covered by a fixture row.
2. Tap today: exactly one line appended (S30 serialize format, `source:: pwa`), square flips, second tap is a no-op (already hit).
3. Hit squares use the habit's domain token color (`--hc`).
4. No direct fs/git calls in the component — writes go through the transport/provider seam.
5. Tests green; diff = HabitsCard, habitsWrite, HomeView (+tests).

## Tests
Vitest: fixture render (3 streak states), tap → append payload asserted, idempotent tap.

## Design refs
§4.6 (full), §8 (state in form + color).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. HomeView-chain: rebase on S29 merge.
