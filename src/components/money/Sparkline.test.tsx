/**
 * Tests for S40 — Sparkline (DESIGN_LANGUAGE §4.9).
 *
 * jsdom has no real 2D canvas backend, so `HTMLCanvasElement.getContext` is
 * stubbed with spies (same pattern as Aurora.test.tsx, S22) — we assert on
 * *what* gets drawn, not pixels. Geometry itself is covered by direct,
 * canvas-free assertions on the exported pure `sparklinePoints` function.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup } from '@testing-library/react'
import { Sparkline, sparklinePoints } from './Sparkline'

afterEach(cleanup)

function makeFakeCtx() {
  const gradientStops: Array<[number, string]> = []
  const arcCalls: Array<[number, number, number, number, number]> = []
  const ctx = {
    clearRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn((offset: number, color: string) => {
        gradientStops.push([offset, color])
      }),
    })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn((...args: [number, number, number, number, number]) => {
      arcCalls.push(args)
    }),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineJoin: '',
    lineCap: '',
  }
  return { ctx, gradientStops, arcCalls }
}

let ctx: ReturnType<typeof makeFakeCtx>['ctx']
let gradientStops: ReturnType<typeof makeFakeCtx>['gradientStops']
let arcCalls: ReturnType<typeof makeFakeCtx>['arcCalls']

beforeEach(() => {
  ;({ ctx, gradientStops, arcCalls } = makeFakeCtx())
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  )
})

// ─── Pure geometry ────────────────────────────────────────────────────────

describe('sparklinePoints — pure geometry', () => {
  it('maps values to x/y coordinates spanning the padded box, min at bottom / max at top', () => {
    const points = sparklinePoints([0, 50, 100], 100, 100, 0)
    expect(points).toHaveLength(3)
    expect(points[0]).toEqual({ x: 0, y: 100 }) // min value -> bottom
    expect(points[1]).toEqual({ x: 50, y: 50 }) // mid value -> mid height
    expect(points[2]).toEqual({ x: 100, y: 0 }) // max value -> top
  })

  it('centers a single value', () => {
    expect(sparklinePoints([42], 200, 100)).toEqual([{ x: 100, y: 50 }])
  })

  it('returns no points for an empty series', () => {
    expect(sparklinePoints([])).toEqual([])
  })

  it('does not divide by zero when every value is equal', () => {
    const points = sparklinePoints([5, 5, 5], 100, 100, 0)
    expect(points.every((p) => Number.isFinite(p.y))).toBe(true)
  })
})

// ─── Canvas draw contract (§4.9) ──────────────────────────────────────────

describe('Sparkline — mount + draw contract (§4.9)', () => {
  it('mounts a canvas with the given dimensions', () => {
    const { getByTestId } = render(<Sparkline values={[1, 2, 3]} width={240} height={110} />)
    const canvas = getByTestId('sparkline-canvas') as HTMLCanvasElement
    expect(canvas).toBeInTheDocument()
    expect(canvas.width).toBe(240)
    expect(canvas.height).toBe(110)
  })

  it('draws an emphasized endpoint dot (r=4) at the last point', () => {
    render(<Sparkline values={[10, 20, 5, 40]} width={240} height={110} />)
    const points = sparklinePoints([10, 20, 5, 40], 240, 110)
    const last = points[points.length - 1]!

    const dotArc = arcCalls.find((call) => call[2] === 4)
    expect(dotArc).toBeDefined()
    expect(dotArc![0]).toBeCloseTo(last.x)
    expect(dotArc![1]).toBeCloseTo(last.y)
  })

  it('fills an area gradient from a --good tint to transparent', () => {
    render(<Sparkline values={[1, 2, 3]} />)
    expect(ctx.createLinearGradient).toHaveBeenCalled()
    expect(gradientStops[0]![1]).toContain('var(--good)')
    expect(gradientStops[1]![1]).toBe('transparent')
  })

  it('redraws the canvas when the data changes', () => {
    const { rerender } = render(<Sparkline values={[1, 2, 3]} />)
    const firstDraws = ctx.clearRect.mock.calls.length
    expect(firstDraws).toBeGreaterThan(0)

    rerender(<Sparkline values={[9, 8, 7, 6]} />)
    expect(ctx.clearRect.mock.calls.length).toBeGreaterThan(firstDraws)

    // The new endpoint (last value 6, the series minimum) now draws at the
    // bottom of the chart instead of wherever the old series put it.
    const points = sparklinePoints([9, 8, 7, 6])
    const last = points[points.length - 1]!
    const dotArcs = arcCalls.filter((call) => call[2] === 4)
    const dotArc = dotArcs[dotArcs.length - 1]!
    expect(dotArc[0]).toBeCloseTo(last.x)
    expect(dotArc[1]).toBeCloseTo(last.y)
  })

  it('renders nothing beyond gridlines for an empty series (no crash)', () => {
    render(<Sparkline values={[]} />)
    expect(ctx.clearRect).toHaveBeenCalled()
    expect(ctx.fill).not.toHaveBeenCalled()
  })
})
