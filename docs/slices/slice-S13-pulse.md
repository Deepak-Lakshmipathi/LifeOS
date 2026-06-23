# Slice S13 — Pulse tab (light)

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** C · **Depends on:** S12 · **Status:** planned — **closes the MVP**

## Why
A light trends surface — not a quantified-self dashboard (the user chose command-center over data-first). Just enough reflection: what got done, which domains are warm/cold. Everything derived, nothing to maintain.

## Scope — this slice only
- Pulse tab content:
  - **Done this week** count (from `completed_at`).
  - **Per-domain warmth** summary (reuse `computeWarmth`, S9) — the warm/cold standings.
  - A small completions-per-day sparkline for the last 7 days.
- Read-only; derived entirely from existing task data.

## Out of scope
- Streaks, goals, per-project analytics, configurable ranges. Keep it light by design.

## Data / model change
- None.

## Vertical
- Logic: pure helpers `doneThisWeek(tasks, now)`, `completionsByDay(tasks, now, 7)` — unit-tested with injected clock.
- UI: `PulseView` with count, warmth standings, sparkline (glass styled).
- Seam/store: read-only.
- PWA: offline unaffected.

## Acceptance criteria (done_when)
- [ ] Pulse shows done-this-week count, per-domain warmth standings, 7-day sparkline.
- [ ] All metrics derived from task data; deterministic with injected `now`; unit-tested.
- [ ] Replaces the S7 placeholder; glass-styled.
- [ ] PWA e2e green.
- [ ] **MVP complete** — update `kanban.html` marking Groups A–C shipped.

## Relevant files
New `src/pulse/metrics.ts` (+ test), new `src/components/PulseView.tsx`, `src/warmth/computeWarmth.ts`, `src/components/TabBar.tsx`, `kanban.html`.

## Notes for executor
Resist scope creep — Pulse stays light intentionally. Inject `now` everywhere; no `Date.now()` in pure helpers.
