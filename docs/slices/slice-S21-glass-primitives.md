# S21 — Glass primitives: Card, Chip, Vital, Segmented [UI]

Phase 0 · Wave 1 · Deps: S20 · Blocks: S24, S26

## Context
The four reusable Glass Cockpit building blocks, per `docs/DESIGN_LANGUAGE.md`
§4. Every later card/tile/chip composes these — get them pixel-true now.
Components are dumb + presentational; no data fetching.

## Write-set (new dir; do NOT touch existing components or App.tsx)
- NEW `src/components/glass/Card.tsx` — §4 shared card base: panel fill,
  hairline border, r18, blur(16px), overflow hidden, and the REQUIRED cursor
  spotlight (::before radial at `--mx/--my`, mousemove driver). Props:
  children, className, optional h2 heading (uppercase spec §2.2, count via `·`).
- NEW `src/components/glass/Chip.tsx` — 999px pill §4.3: variants `dom`
  (color-mix 18% of `--dc`), `p3` High, `p2` Med, `rescue` (dashed border, ❄).
- NEW `src/components/glass/Vital.tsx` — §4.2 tile: k/v/s anatomy, r14,
  blur(14px), tabular-nums, `.up/.dn` sub coloring, count-up hook (900ms,
  `1-(1-p)^3`) honoring reduced-motion (skip to final value).
- NEW `src/components/glass/Segmented.tsx` — §4.1 pill control: frosted track,
  borderless buttons, `.on` brighter fill; `role="tablist"`, visible focus.
- NEW tests: `src/components/glass/*.test.tsx` (one per component).

## Subtasks
1. Card + spotlight driver. 2. Chip variants. 3. Vital + count-up (reduced-
motion guard). 4. Segmented + a11y roles. 5. Render/state tests each.

## Definition of Done
1. Four components exist at the paths above, styled ONLY via S20 tokens/Tailwind classes (no new raw values).
2. Card renders the ::before spotlight and updates `--mx/--my` on mousemove.
3. Chip renders all 4 variants with contract colors; rescue shows dashed border + ❄ text.
4. Vital counts up on mount and renders final value immediately under `prefers-reduced-motion`.
5. Segmented: click switches `.on`; `role="tablist"` present; buttons are real `<button>`s.
6. ≥4 new tests green; suite green; App.tsx untouched.

## Tests
Vitest + Testing Library: render, variant classes, click state, reduced-motion path.

## Design refs
§4 intro, §4.1, §4.2, §4.3 chips, §7 (motion/a11y floor).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet.
