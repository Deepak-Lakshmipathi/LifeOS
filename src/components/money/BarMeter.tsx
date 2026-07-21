/**
 * BarMeter — track + gradient fill (S40, DESIGN_LANGUAGE §4.9):
 *
 *   "Bar meter: track height:10px; radius 5px; rgba(255,255,255,.07); fill
 *   gradients — income/positive linear-gradient(90deg,#4ade80,#22d3ee),
 *   spend/pressure linear-gradient(90deg,#fbbf24,#f87171), growth-course
 *   (90deg,#a78bfa,#38bdf8), body-course (90deg,#2dd4bf,#4ade80)."
 *
 * Every stop that has a design token equivalent is expressed as `var(--x)`
 * (good=#4ade80, warn=#fbbf24, bad=#f87171, d-growth=#a78bfa,
 * d-career=#38bdf8, d-body=#2dd4bf, d-fin=#4ade80). `#22d3ee` has no token —
 * copied verbatim from §4.9, same precedent as Aurora's (S22) palette.
 */

export type BarMeterVariant = 'income' | 'spend' | 'growth' | 'body'

const VARIANT_GRADIENT: Record<BarMeterVariant, string> = {
  income: 'linear-gradient(90deg, var(--good), #22d3ee)',
  spend: 'linear-gradient(90deg, var(--warn), var(--bad))',
  growth: 'linear-gradient(90deg, var(--d-growth), var(--d-career))',
  body: 'linear-gradient(90deg, var(--d-body), var(--d-fin))',
}

export interface BarMeterProps {
  variant: BarMeterVariant
  /** Fill percentage, 0–100. Out-of-range values are clamped. */
  pct: number
  ariaLabel?: string
}

export function BarMeter({ variant, pct, ariaLabel }: BarMeterProps) {
  const clamped = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0

  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-[5px] bg-[rgba(255,255,255,.07)]"
      role="img"
      aria-label={ariaLabel}
      data-testid="bar-meter-track"
      data-variant={variant}
    >
      <div
        className="h-full rounded-[5px]"
        style={{ width: `${clamped}%`, backgroundImage: VARIANT_GRADIENT[variant] }}
        data-testid="bar-meter-fill"
      />
    </div>
  )
}
