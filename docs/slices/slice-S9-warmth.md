# Slice S9 — Domain warmth (derived) + Domains map

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** B · **Depends on:** S8 · **Status:** planned

## Why
The core feedback loop: **warmth is derived, never logged.** Completing a task heats its domain; silence cools it. The Domains tab becomes a map of glowing/frosting tiles so you *feel* neglect before it's a problem. This also feeds the balance brain (S10).

## Scope — this slice only
- Record `completed_at` on a Task when `done` flips true (cleared when un-done).
- Compute per-domain warmth from the most recent `completed_at` in that domain, bucketed by age into states: **hot / warm / ok / stale / cold** (define thresholds, e.g. ≤2d / ≤5d / ≤10d / ≤20d / older or never).
- Domains tab: a tile per domain showing **glow intensity (domain color) + a one-word state**. No raw numbers.

## Out of scope
- Using warmth to rank NOW (that's S10). Glass material (S11) — tiles can be styled-but-simple now. Pulse trends (S13).

## Data / model change
- `src/types/index.ts`: add `completed_at?: number`.
- `LocalOnly.toggleDone`: set `completed_at = Date.now()` when completing, unset when un-completing.
- Dexie: index `completed_at` if needed for the "latest per domain" query → schema bump.

## Vertical
- UI: `DomainsMap` with warmth tiles (glow + word), reusing the domain palette (S5).
- Logic: pure `computeWarmth(tasks, now): Record<domain, WarmthState>` helper + thresholds, unit-tested with fixed clock.
- Seam/store: `completed_at` persisted.
- PWA: offline unaffected.

## Acceptance criteria (done_when)
- [ ] Completing a task sets `completed_at`; un-completing clears it.
- [ ] `computeWarmth` is pure, deterministic with an injected `now`, and unit-tested across all buckets incl. "never".
- [ ] Domains tab shows one tile per domain with glow + state word; coldest visibly frosted.
- [ ] Dexie upgrade preserves existing tasks.
- [ ] PWA e2e green.

## Relevant files
`src/types/index.ts`, `src/sync/LocalOnly.ts`, `src/db/LifeOSDb.ts`, new `src/warmth/computeWarmth.ts` (+ test), new `src/components/DomainsMap.tsx`, `src/data/domains.ts`.

## Notes for executor
Inject `now` for testability; never call `Date.now()` inside the pure helper. Thresholds live in one named constant so they're tunable.
