import { DOMAINS } from '../data/domains'
import type { Domain } from '../data/domains'
import type { WarmthState } from '../warmth/computeWarmth'

/**
 * warmthTint — pure derivation of the Aurora background tint from domain
 * warmth (S60, owner feedback items 3+4). Warmth used to render as its own
 * vital tile (7 bars); it now tints the page background instead, so the
 * whole app is colored by how hot the owner's domains are. `Aurora` calls
 * `computeWarmth` and passes the result here — this module stays pure (no
 * `Date.now()`, no DOM) so the blend math is testable without a canvas.
 *
 * WARMTH_OPACITY is the single definition (lifted out of VitalsRow, which
 * used it only for the now-deleted WarmthTile) — bar/tint alpha both read
 * warmth off the same 5-state scale (§4.2: "opacity = warmth, hot ≈ .9 →
 * cold ≈ .2").
 */
export const WARMTH_OPACITY: Record<WarmthState, number> = {
  hot: 0.9,
  warm: 0.725,
  ok: 0.55,
  stale: 0.375,
  cold: 0.2,
}

/**
 * Tint alpha ceiling (§7/§8 non-negotiable): this layer sits under every
 * frosted glass panel, so even an all-hot vault must stay barely-there —
 * text contrast is never allowed to degrade.
 */
export const WARMTH_TINT_ALPHA_CAP = 0.1

/**
 * Canonical domain → hex color (§2.1 `--d-*` tokens, copied verbatim from
 * `src/styles/tokens.css`). Blend math needs literal RGB, not a `var()`
 * string, so this is the one place those 7 hex values are duplicated as
 * numbers rather than CSS custom properties — still tokens-only, no
 * invented color.
 */
const DOMAIN_HEX: Record<Domain, string> = {
  'Building Things': '#f59e0b',
  Career: '#38bdf8',
  Growth: '#a78bfa',
  'Life Admin': '#94a3b8',
  'Body & Mind': '#2dd4bf',
  Finance: '#4ade80',
  Relationship: '#f472b6',
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export interface WarmthTint {
  /** Solid `rgb(...)` blend of the 7 domain tokens, weighted by warmth. */
  color: string
  /** 0..WARMTH_TINT_ALPHA_CAP — how strongly the tint reads over the aurora. */
  alpha: number
}

/**
 * Blend the 7 `--d-*` domain tokens weighted by each domain's
 * `WARMTH_OPACITY`, and scale alpha from that same weighting so an all-cold
 * vault is barely tinted and an all-hot vault reads clearly warm — capped at
 * `WARMTH_TINT_ALPHA_CAP` regardless of input.
 */
export function warmthTint(warmth: Record<Domain, WarmthState>): WarmthTint {
  let r = 0
  let g = 0
  let b = 0
  let weightSum = 0

  for (const domain of DOMAINS) {
    const weight = WARMTH_OPACITY[warmth[domain]]
    const [dr, dg, db] = hexToRgb(DOMAIN_HEX[domain])
    r += dr * weight
    g += dg * weight
    b += db * weight
    weightSum += weight
  }

  // weightSum > 0 always (7 domains, cheapest weight is WARMTH_OPACITY.cold).
  const color = `rgb(${Math.round(r / weightSum)}, ${Math.round(g / weightSum)}, ${Math.round(b / weightSum)})`

  // Normalize the mean warmth weight (bounded [cold, hot]) to [0, 1], then
  // scale onto the alpha cap — all-cold → ~0, all-hot → the cap itself.
  const meanWeight = weightSum / DOMAINS.length
  const { cold: MIN_WEIGHT, hot: MAX_WEIGHT } = WARMTH_OPACITY
  const t = Math.min(1, Math.max(0, (meanWeight - MIN_WEIGHT) / (MAX_WEIGHT - MIN_WEIGHT)))
  const alpha = t * WARMTH_TINT_ALPHA_CAP

  return { color, alpha }
}
