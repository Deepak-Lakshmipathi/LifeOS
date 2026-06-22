# Slice S6 — NOW view (dumb brain)

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** B · **Depends on:** S5 · **Status:** planned

## Why
The home screen's job is to answer "what do I do now?" (command center). Start with the simplest honest ranking — pure priority — so the surface exists and is trusted before the balance brain (S10) makes it smart.

## Scope — this slice only
- A **NOW** view: a ranked, cross-domain queue of open (not done) tasks.
- Ranking v0: priority 3 → 2 → 1, ties by oldest `created_at`. Domain-blind.
- Show top 3–5 as live cards; fold the rest under "Up next" / "Later" (collapsed counts).
- Card shows title + `done_when` + project chip (reuse S2/S4 rendering).

## Out of scope
- Per-domain cap, coldest-domain injection, warmth (S9/S10). Tab bar (S7) — for now NOW can be the default view or a toggle next to the full list.

## Data / model change
- None. Pure selection/sort over existing tasks.

## Vertical
- UI: new `NowView` component rendering ranked cards + collapsible Up next/Later.
- Logic: pure `rankNow(tasks): Task[]` helper (priority desc, created_at asc), fully unit-tested.
- Seam/store: read-only via `list()`.
- PWA: offline unaffected.

## Acceptance criteria (done_when)
- [ ] NOW shows open tasks ordered by priority then age; done tasks excluded.
- [ ] Top 3–5 are live; remainder folded under Up next/Later with counts.
- [ ] `rankNow` is a pure, unit-tested function.
- [ ] Completing a task removes it from NOW and the next rises.
- [ ] PWA e2e green.

## Relevant files
New `src/now/rankNow.ts` (+ test), new `src/components/NowView.tsx`, `src/App.tsx`, reuse `src/components/TaskItem.tsx`.

## Notes for executor
Keep ranking logic out of the component. `rankNow` is the seam the balance brain (S10) will replace/extend — design its signature to later accept warmth data.
