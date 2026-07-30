# S59 — Tab bar fits every screen (phone: all tabs visible) [UI]

Post-v2 · Wave 13 · Deps: S58 (TabBar hotspot — rebase on its merge) · Blocks: —

Source: owner feedback item 2, `Post V2 User FeedBack, Features, Updates, Fixes.md`.

## Context
On the phone the tab pill is `w-max` with fixed `px-5 py-[9px] text-[14px]`
buttons, so at 5 tabs it overflows the 1180px shell's `px-4` gutter — tabs run
off-screen with no scroll affordance and the owner can't reach the last ones.
The bar must **show every tab at every width**, down to a 320px viewport.

Approach (pick the smallest that holds — this is chrome, not a layout engine):
fluid sizing on the buttons instead of a scroller — `w-max` → `max-w-full` on
the track, and horizontal padding/font that shrink with the viewport
(`px-[clamp(…)]` / `text-[clamp(…)]`), so five labels fit at 320px. Keep the
frosted pill track, the centered position, and the active-fill treatment
identical (§4.1) — only the metrics flex. A horizontal-scroll fallback is
acceptable ONLY if labels genuinely cannot fit; if you take it, the track must
still show a partial next tab (never a clean edge that reads as "no more tabs").

Do NOT abbreviate labels or swap to icons — same words at every width.

`data-testid="tab-bar"` must survive (e2e + cockpit shell depend on it).

## Write-set
- MODIFY `src/components/TabBar.tsx` — responsive metrics only.
- MODIFY `src/components/TabBar.test.tsx` — narrow-viewport assertion.
- MODIFY `docs/DESIGN_LANGUAGE.md` §4.1 — one line documenting the responsive
  metrics (the spec's fixed `padding:9px 20px` becomes the ≥desktop value).

## Subtasks
1. Fluid track + button metrics. 2. Narrow-viewport test. 3. §4.1 note.

## Definition of Done
1. At a 320px viewport width all 5 tab labels are rendered and none is clipped or positioned outside the track (tested — assert on computed layout/`scrollWidth <= clientWidth`, not a screenshot).
2. At ≥841px the bar is visually unchanged from S58's: centered, `w-max`-like pill, same active fill + shadow (tested).
3. `data-testid="tab-bar"` and `aria-current="page"` on the active tab both intact.
4. No icon-only or abbreviated labels at any width.
5. `npm run build` + `npm test` green incl. pwa-e2e.

## Tests
320px / 390px / 1280px width cases; label text identical across all three.

## Design refs
§4.1 (tab bar anatomy — desktop metrics stay the spec baseline), §2.3.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Rebase onto S58's merge
BEFORE starting — S58 changes the tab list this slice must fit.
