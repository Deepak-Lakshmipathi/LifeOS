/**
 * Tests for S40 — Donut (DESIGN_LANGUAGE §4.9).
 *
 * DoD #3: "segment angles proportional to pct (tested via drawn-arc math or
 * exposed computed segments); legend labels match." Covered directly against
 * the pure `donutSegments` function (canvas-free), plus a render test for
 * mount + legend text.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { Donut, donutSegments, DONUT_PALETTE } from './Donut'
import type { PortfolioSlice } from '../../vault/finance'

afterEach(cleanup)

// Mirrors the S39 committed fixture (src/vault/__fixtures__/finance-portfolio.md)
// after parsing — Equity 50 / Mutual funds 30 / Cash 20, sums to 100.
const SLICES: PortfolioSlice[] = [
  { label: 'Equity', value: 920000, pct: 50 },
  { label: 'Mutual funds', value: 552000, pct: 30 },
  { label: 'Cash', value: 368000, pct: 20 },
]

const GAP = 0.04
const TWO_PI = Math.PI * 2

describe('donutSegments — pure geometry (§4.9)', () => {
  it('produces one segment per slice, colors from the palette in order', () => {
    const segments = donutSegments(SLICES)
    expect(segments).toHaveLength(3)
    expect(segments.map((s) => s.color)).toEqual([
      DONUT_PALETTE[0],
      DONUT_PALETTE[1],
      DONUT_PALETTE[2],
    ])
  })

  it('sweep angle (end - start + gap) is proportional to pct', () => {
    const segments = donutSegments(SLICES)
    const total = SLICES.reduce((sum, s) => sum + s.pct, 0)

    segments.forEach((seg, i) => {
      const rawSweep = seg.endAngle - seg.startAngle + GAP
      const expected = (SLICES[i]!.pct / total) * TWO_PI
      expect(rawSweep).toBeCloseTo(expected, 5)
    })
  })

  it('leaves exactly GAP rad between adjacent segments', () => {
    const segments = donutSegments(SLICES)
    for (let i = 1; i < segments.length; i++) {
      const gapBetween = segments[i]!.startAngle - segments[i - 1]!.endAngle
      expect(gapBetween).toBeCloseTo(GAP, 5)
    }
  })

  it('starts the first segment at 12 o’clock (-π/2, plus half-gap)', () => {
    const segments = donutSegments(SLICES)
    expect(segments[0]!.startAngle).toBeCloseTo(-Math.PI / 2 + GAP / 2, 5)
  })

  it('sweeps the full circle back to the start for a complete allocation', () => {
    const segments = donutSegments(SLICES)
    const last = segments[segments.length - 1]!
    // Last segment's end (plus its half-gap) should land back at 2π - π/2.
    expect(last.endAngle + GAP / 2).toBeCloseTo(-Math.PI / 2 + TWO_PI, 5)
  })

  it('normalizes against the pct sum, not a hardcoded 100', () => {
    // Slices that only sum to 40 still tile a full circle proportionally.
    const partial: PortfolioSlice[] = [
      { label: 'A', value: 1, pct: 30 },
      { label: 'B', value: 1, pct: 10 },
    ]
    const segments = donutSegments(partial)
    const rawSweepA = segments[0]!.endAngle - segments[0]!.startAngle + GAP
    expect(rawSweepA).toBeCloseTo((30 / 40) * TWO_PI, 5)
  })

  it('returns no segments for an empty or zero-total slice list', () => {
    expect(donutSegments([])).toEqual([])
    expect(donutSegments([{ label: 'Zero', value: 0, pct: 0 }])).toEqual([])
  })
})

// ─── Canvas draw + legend mount ───────────────────────────────────────────

function makeFakeCtx() {
  const arcCalls: Array<[number, number, number, number, number]> = []
  const strokeStyles: string[] = []
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn((...args: [number, number, number, number, number]) => arcCalls.push(args)),
    stroke: vi.fn(() => strokeStyles.push(ctx.strokeStyle)),
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
  }
  return { ctx, arcCalls, strokeStyles }
}

describe('Donut — mount + draw contract (§4.9)', () => {
  let ctx: ReturnType<typeof makeFakeCtx>['ctx']
  let arcCalls: ReturnType<typeof makeFakeCtx>['arcCalls']

  beforeEach(() => {
    ;({ ctx, arcCalls } = makeFakeCtx())
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D
    )
  })

  it('mounts a 120×120 canvas, stroked r=48 lineWidth=16, one arc per segment', () => {
    const { getByTestId } = render(<Donut slices={SLICES} />)
    const canvas = getByTestId('donut-canvas') as HTMLCanvasElement
    expect(canvas.width).toBe(120)
    expect(canvas.height).toBe(120)
    expect(arcCalls).toHaveLength(3)
    arcCalls.forEach((call) => expect(call[2]).toBe(48)) // radius
  })

  it('legend labels match the slice labels, in order', () => {
    render(<Donut slices={SLICES} />)
    const rows = screen.getAllByTestId('donut-legend-row')
    expect(rows.map((r) => r.textContent)).toEqual(['Equity', 'Mutual funds', 'Cash'])
  })
})
