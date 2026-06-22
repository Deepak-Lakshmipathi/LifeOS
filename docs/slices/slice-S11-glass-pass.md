# Slice S11 — Glass / depth visual pass

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** C · **Depends on:** S10 · **Status:** planned

## Why
The chosen identity: **Glass/depth** (visionOS-ish). Translucent frosted panels, a soft time-of-day gradient behind everything, domain-color glow on card edges and warmth tiles. This is the emotional payoff that turns a task list into "a mirror."

## Scope — this slice only
- Establish the glass design system: frosted card material (blur + translucency), elevation, a background gradient that shifts by time of day.
- Apply to NOW cards (domain-color glow on the left edge), the Domains warmth tiles (glow intensity = warmth), tab bar (frosted), top bar.
- Tune the domain palette for glass (colors readable through frost).
- Honor `prefers-reduced-motion` and `prefers-reduced-transparency` (fallback to solid).

## Out of scope
- New features. This is purely visual. No model or seam change.

## Data / model change
- None.

## Vertical
- UI/CSS: Tailwind config + `index.css` for glass tokens (backdrop-blur, layered backgrounds, gradient); shared `GlassPanel` primitive; restyle existing components.
- PWA: ensure blur/gradient don't hurt offline or Lighthouse PWA score.

## Acceptance criteria (done_when)
- [ ] Frosted glass material applied consistently across NOW, Domains, tab bar, top bar.
- [ ] Time-of-day gradient background renders and shifts (morning/day/evening/night).
- [ ] Domain-color glow on NOW cards + warmth tiles reads clearly.
- [ ] Reduced-transparency / reduced-motion fallbacks render solid + still.
- [ ] PWA install/offline e2e + Lighthouse PWA check still green.

## Relevant files
`tailwind.config.js`, `src/index.css`, new `src/components/GlassPanel.tsx`, all view/components, `src/data/domains.ts` (palette tuning), `scripts/lh-pwa.mjs` (verify score).

## Notes for executor
Keep it tasteful, not neon. Centralize glass tokens so future screens inherit them. Verify backdrop-blur performance on a mid Android device.
