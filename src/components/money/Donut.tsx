import { useEffect, useRef } from 'react'
import type { PortfolioSlice } from '../../vault/finance'

/**
 * Donut — portfolio allocation canvas + legend (S40, DESIGN_LANGUAGE §4.9):
 *
 *   "Donut (canvas 120×120): stroked arcs r=48, lineWidth:16, gap .04rad
 *   between segments; slice colors #38bdf8 #a78bfa #f59e0b #4ade80 #64748b;
 *   legend = 9×9 radius-3 swatches + 12px --dim labels."
 *
 * The 5-color slice palette is its own named set in §4.9, distinct from the
 * domain tokens even where a hex happens to coincide (§2.1: "--d-fin happens
 * to share #4ade80 with --good but is referenced by its own token" — same
 * identity rule applies here), so it is copied verbatim rather than aliased
 * to `--d-*` vars.
 *
 * Segment angle math lives in `donutSegments`, exported so tests assert on
 * geometry instead of pixels (S40 Tests contract).
 */

const SIZE = 120
const RADIUS = 48
const LINE_WIDTH = 16
const GAP = 0.04 // rad, §4.9

// §4.9 slice palette — literal, verbatim.
export const DONUT_PALETTE = ['#38bdf8', '#a78bfa', '#f59e0b', '#4ade80', '#64748b']

export interface DonutSegment {
  label: string
  pct: number
  color: string
  /** Arc start angle in radians, gap already applied. */
  startAngle: number
  /** Arc end angle in radians, gap already applied. */
  endAngle: number
}

/**
 * Proportional segment angles, starting at 12 o'clock (-π/2) and sweeping
 * clockwise, normalized against the sum of `pct` (so malformed/partial data
 * that doesn't sum to 100 still tiles the full circle). Each segment loses
 * half of `GAP` on either edge, so adjacent segments end up separated by
 * exactly `GAP` rad — matching §4.9's "gap .04rad between segments".
 */
export function donutSegments(slices: PortfolioSlice[]): DonutSegment[] {
  const total = slices.reduce((sum, s) => sum + s.pct, 0)
  if (total <= 0) return []

  let cursor = -Math.PI / 2
  return slices.map((s, i) => {
    const sweep = (s.pct / total) * Math.PI * 2
    const startAngle = cursor + GAP / 2
    const endAngle = cursor + sweep - GAP / 2
    cursor += sweep
    return {
      label: s.label,
      pct: s.pct,
      color: DONUT_PALETTE[i % DONUT_PALETTE.length]!,
      startAngle,
      endAngle: Math.max(endAngle, startAngle),
    }
  })
}

export interface DonutProps {
  slices: PortfolioSlice[]
}

export function Donut({ slices }: DonutProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const segments = donutSegments(slices)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = SIZE
    canvas.height = SIZE
    ctx.clearRect(0, 0, SIZE, SIZE)

    const cx = SIZE / 2
    const cy = SIZE / 2

    segments.forEach((seg) => {
      ctx.beginPath()
      ctx.arc(cx, cy, RADIUS, seg.startAngle, seg.endAngle)
      ctx.strokeStyle = seg.color
      ctx.lineWidth = LINE_WIDTH
      ctx.lineCap = 'butt'
      ctx.stroke()
    })
  }, [slices, segments])

  return (
    <div className="flex items-center gap-4">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Portfolio allocation"
        data-testid="donut-canvas"
        width={SIZE}
        height={SIZE}
      />
      <ul className="flex flex-col gap-1.5" aria-label="Portfolio legend">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2 text-[12px] text-dim" data-testid="donut-legend-row">
            <i
              aria-hidden
              className="inline-block h-[9px] w-[9px] shrink-0 rounded-[3px]"
              style={{ backgroundColor: seg.color }}
            />
            {seg.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
