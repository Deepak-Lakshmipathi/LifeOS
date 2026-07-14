# S20 — Glass tokens → code [UI]

Phase 0 · Wave 0 · Deps: none · Blocks: everything (S21+)

## Context
LifeOS v2 ("Glass Cockpit") reskins + extends the shipped PWA. The visual
contract is LOCKED in `docs/DESIGN_LANGUAGE.md` — read it fully. This slice
ports its §2 design tokens into code so every later slice consumes tokens,
never raw values. Dark-only (`html { color-scheme: dark }`).

## Write-set
- NEW `src/styles/tokens.css` — every §2.1 color token (`--bg --bg2 --panel
  --panel-brd --txt --dim --faint`, 7 `--d-*` domain colors, `--good --warn
  --bad`) as `:root` vars, verbatim values; font stack §2.2; radius/blur vars.
- MODIFY `tailwind.config.js` — `theme.extend` exactly per §2.4 (colors incl.
  `domain.*`, borderRadius card/tile/row/chip, backdropBlur seg/tile/card,
  fontFamily, maxWidth.shell, transitionDuration).
- MODIFY `src/index.css` — import tokens.css first; body: `--bg` ground,
  `--txt`, antialiased, new font stack; keep existing v1 styles working.
- NEW `src/test/tokens.test.tsx` — assert a token-consuming component renders.

## Subtasks
1. tokens.css with all §2.1/§2.2/§2.3 values, byte-exact to the contract.
2. Tailwind mapping §2.4.
3. Wire into index.css without breaking existing v1 views (they restyle later).
4. Test: render a div with `bg-panel rounded-card`; assert classes resolve.

## Definition of Done
1. `src/styles/tokens.css` exists; contains every token from DESIGN_LANGUAGE §2.1 with exact values (spot-check `--bg:#0b0f1e`, `--d-build:#f59e0b`, `--panel:rgba(255,255,255,.055)`).
2. `tailwind.config.js` extends theme per §2.4 — classes `bg-panel`, `text-dim`, `rounded-card`, `backdrop-blur-card`, `max-w-shell` compile.
3. No raw hex from the token table appears in any component diff (tokens only).
4. Existing test suite still green; ≥1 new test exercising the tokens.
5. No new colors/radii/blurs beyond the contract.

## Tests
Vitest: token-consuming component renders; `npm test` green.

## Design refs
DESIGN_LANGUAGE §2 (all), §3.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet.
