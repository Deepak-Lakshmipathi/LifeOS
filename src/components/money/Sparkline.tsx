import { useEffect, useRef } from 'react'

/**
 * Sparkline — net-worth trend canvas (S40, DESIGN_LANGUAGE §4.9):
 *
 *   "Sparkline (canvas, ~110px tall): faint gridlines rgba(255,255,255,.06),
 *   2.5px round-joined line in --good, area fill = vertical gradient
 *   rgba(74,222,128,.35)→transparent, endpoint dot r=4 solid --good.
 *   Emphasize the endpoint, always."
 *
 * Colors reference the `--good` token (via `var()`/`color-mix()`, same
 * pattern §2.1 documents for domain-tinted fills) everywhere a token exists;
 * the gridline alpha has no equivalent token, so it is copied verbatim from
 * §4.9 — same precedent as Aurora's (S22) hardcoded time-of-day palette.
 *
 * Pure geometry lives in `sparklinePoints`, exported so tests assert on
 * coordinates instead of pixels (S40 Tests contract).
 */

const DEFAULT_WIDTH = 240
const DEFAULT_HEIGHT = 110
const DEFAULT_PADDING = 8
const GRIDLINE_COUNT = 3
const LINE_WIDTH = 2.5
const DOT_RADIUS = 4

const GRID_COLOR = 'rgba(255,255,255,.06)' // §4.9 gridlines — no token at this alpha
const LINE_COLOR = 'var(--good)'
const AREA_TOP = 'color-mix(in srgb, var(--good) 35%, transparent)' // rgba(74,222,128,.35) equiv
const AREA_BOTTOM = 'transparent'
const DOT_COLOR = 'var(--good)'

export interface SparkPoint {
  x: number
  y: number
}

/**
 * Map `values` onto an evenly-spaced coordinate list inside a `width`×`height`
 * box (padded on all sides). A single value centers; an empty array yields no
 * points. Exposed so canvas-free tests can assert exact geometry.
 */
export function sparklinePoints(
  values: number[],
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  padding = DEFAULT_PADDING
): SparkPoint[] {
  if (values.length === 0) return []
  if (values.length === 1) {
    return [{ x: width / 2, y: height / 2 }]
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const innerW = width - padding * 2
  const innerH = height - padding * 2

  return values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * innerW
    const y = padding + innerH - ((v - min) / span) * innerH
    return { x, y }
  })
}

export interface SparklineProps {
  /** Series values in draw order (e.g. `networth.map(p => p.networth)`). */
  values: number[]
  width?: number
  height?: number
}

export function Sparkline({ values, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width
    canvas.height = height

    ctx.clearRect(0, 0, width, height)

    // Gridlines — evenly spaced horizontal hairlines.
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1
    for (let i = 1; i <= GRIDLINE_COUNT; i++) {
      const y = (height / (GRIDLINE_COUNT + 1)) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    const points = sparklinePoints(values, width, height)
    if (points.length === 0) return

    // Area fill — vertical gradient down to the canvas floor.
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, AREA_TOP)
    gradient.addColorStop(1, AREA_BOTTOM)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.moveTo(points[0]!.x, height)
    points.forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.lineTo(points[points.length - 1]!.x, height)
    ctx.closePath()
    ctx.fill()

    // Line — 2.5px, round-joined.
    ctx.strokeStyle = LINE_COLOR
    ctx.lineWidth = LINE_WIDTH
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.stroke()

    // Endpoint dot — always emphasized (§4.9).
    const last = points[points.length - 1]!
    ctx.fillStyle = DOT_COLOR
    ctx.beginPath()
    ctx.arc(last.x, last.y, DOT_RADIUS, 0, Math.PI * 2)
    ctx.fill()
  }, [values, width, height])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Net worth trend"
      data-testid="sparkline-canvas"
      width={width}
      height={height}
      style={{ width: '100%', height: `${height}px` }}
    />
  )
}
