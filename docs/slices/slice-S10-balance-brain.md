# Slice S10 — Balance brain v1

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** B · **Depends on:** S9 · **Status:** planned

## Why
The command center lives or dies on *how NOW is chosen*. Upgrade the dumb ranking (S6) to the balance brain: keep it loud where it matters but force life-balance, and surface the domain going cold so nothing rots in silence.

## Scope — this slice only
- Replace/extend `rankNow` with the balance algorithm:
  1. Order open tasks by priority (desc), age (asc).
  2. **Cap ~2 tasks per domain** in the live NOW set so no single domain floods it.
  3. **Inject 1 "rescue" task** from the **coldest** domain (from `computeWarmth`, S9), marked distinctly (the ❄ rescue card).
- NOW card for the rescue task shows its cold state.

## Out of scope
- Momentum/streak weighting, nightly hand-pick, glass styling. Per-domain cap count is a tunable constant.

## Data / model change
- None. Pure logic over tasks + warmth.

## Vertical
- Logic: `rankNow(tasks, warmth, opts)` — pure, unit-tested: caps, rescue injection, tie-breaks, edge cases (no cold domain, fewer tasks than slots).
- UI: `NowView` consumes the new ranking; rescue card styled distinctly (reuse warmth word/glow).
- Seam/store: read-only.
- PWA: offline unaffected.

## Acceptance criteria (done_when)
- [ ] NOW never shows more than the cap per domain in the live set.
- [ ] Exactly one rescue task from the coldest domain is injected when one exists; none if all domains warm/empty.
- [ ] Rescue card is visually distinct (cold marker).
- [ ] `rankNow` fully unit-tested incl. edge cases; deterministic given inputs.
- [ ] PWA e2e green.

## Relevant files
`src/now/rankNow.ts` (+ test), `src/warmth/computeWarmth.ts`, `src/components/NowView.tsx`.

## Notes for executor
Cap and bucket thresholds are named constants. Keep `rankNow` pure (inject warmth + now). This is the product's soul — invest in the test matrix.
