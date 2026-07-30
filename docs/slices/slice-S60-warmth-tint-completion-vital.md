# S60 — Warmth becomes the background tint; Completion takes its vital tile [UI]

Post-v2 · Wave 12 · Deps: — · Blocks: —

Source: owner feedback items 3 + 4, `Post V2 User FeedBack, Features, Updates,
Fixes.md`. One swap, one slice — the tile that leaves and the tile that arrives
are the same slot.

## Context
The Warmth 7-bar tile reads as clutter in the vitals strip. Warmth doesn't
disappear — it moves to **the page background**, tinting the frosted glass so the
whole app is colored by how hot the owner's domains are. Its vacated slot (first
tile, §4.2 order) becomes **Completion**: a percentage plus the raw completed /
to-do counts.

**Warmth → tint.** `Aurora` already owns the background ground and already takes
a `palette` prop it never receives from App (App mounts `<Aurora />` bare). Put
the tint here — NOT in App.tsx, which S58 owns this wave. Aurora self-loads the
task list through the same `LocalOnly`/`VaultSync` provider seam `VitalsRow`
uses today (copy that pattern verbatim, including the tests-inject-`tasks`
short-circuit so no test ever touches the provider), runs `computeWarmth`, and
renders the tint. Keep the derivation in a NEW pure module so it is testable
without a canvas:

`warmthTint(warmth: Record<Domain, WarmthState>) → { color: string; alpha: number }`
— blend the 7 `--d-*` domain tokens weighted by each domain's `WARMTH_OPACITY`
(export it from VitalsRow or lift it into the new module and import it back —
one definition, not two), alpha scaled so an all-cold vault is barely tinted and
an all-hot vault is clearly warm. **Cap alpha low (≈0.10 ceiling)**: this sits
under frosted glass panels and text contrast is non-negotiable (§8, §7 a11y).
Simplest render that works: one `fixed inset-0` div with that background color,
z-index between the aurora canvas and the shell — do not rewrite the canvas
paint loop, and do not schedule any new animation frame (§7 reduced-motion
contract: the tint is static, so it needs no reduced-motion branch at all).

**Completion tile.** Pure selector next to the existing vitals selectors in
`src/lib/vitalsData.ts` (`completionVital(tasks)`), rendered through the shipped
glass `Vital` so the count-up + reduced-motion path stays live: value = percent
done, sub = `"<done> done · <open> to do"`. Empty vault → the same honest `—`
placeholder the other tiles use (§8: no fake-real data — 0/0 is not 100%).

**Design doc is LOCKED but owner feedback overrides it** — §4.2's "Warmth strip
variant (first vital)" and §5's vitals order line both name Warmth. Update both
in this PR (Completion · Net worth · Burn/income · Pipeline · Streak; warmth
documented as the background tint) or the eval's design check correctly fails.

## Write-set
- NEW `src/lib/warmthTint.ts` + `warmthTint.test.ts` — pure blend, alpha cap.
- NEW `src/lib/completionVital` case in `src/lib/vitalsData.ts` (+ its test file)
  — pure `(tasks) → { value, sub }`.
- MODIFY `src/components/glass/Aurora.tsx` (+ test) — self-load tasks, compute
  warmth, render the static tint layer.
- MODIFY `src/components/cockpit/VitalsRow.tsx` (+ test) — delete `WarmthTile`
  and the DOMAIN_VAR map it uses; mount the Completion tile first.
- MODIFY `docs/DESIGN_LANGUAGE.md` §4.2 + §5 vitals lines.

Do NOT touch `src/warmth/computeWarmth.ts` — the warmth derivation itself is
unchanged; only its two consumers move.

## Subtasks
1. `warmthTint` pure module + tests. 2. Aurora self-load + tint layer.
3. `completionVital` selector + tests. 4. VitalsRow swap. 5. Design-doc edit.

## Definition of Done
1. No `data-vital="warmth"` tile and no `data-testid="warmth-bar"` anywhere in the rendered app (tested); VitalsRow renders 5 tiles, Completion first.
2. Completion tile shows the percentage plus `"<done> done · <open> to do"`; a task list with 0 tasks renders the honest `—`, not `0%`/`100%` (tested).
3. `warmthTint` is pure (no `Date.now()`, no DOM), all-cold vs all-hot produce visibly different alphas, and alpha never exceeds the documented cap (tested).
4. Aurora renders the tint layer beneath the shell; injecting `tasks` in tests short-circuits the provider load entirely (tested — the provider is never called under test).
5. No new `requestAnimationFrame` scheduling; the existing reduced-motion contract (exactly one static frame) still holds (tested).
6. `docs/DESIGN_LANGUAGE.md` §4.2 + §5 updated; tokens-only styling, no invented hex outside the `--d-*` blend.
7. `npm run build` + `npm test` green incl. pwa-e2e.

## Tests
Blend math + alpha cap; empty/partial/full task lists → completion values;
warmth tile absent; Aurora reduced-motion frame count unchanged.

## Design refs
§2.1 (`--d-*` domain tokens), §4.2 (vital tile — being edited), §5 (vitals
order — being edited), §7 (reduced motion), §8 (no fake-real data).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Disjoint from S58 (App.tsx /
TabBar / HomeView) and S61 (transport.ts) — safe to run in parallel with both.
Must NOT edit `src/App.tsx` — that is S58's hotspot this wave.
