/**
 * Tests for Slice S22 — Aurora canvas background.
 *
 * jsdom has no real 2D canvas context, so `HTMLCanvasElement.getContext` is
 * stubbed (once, in beforeEach) with spies covering the drawing calls the
 * component makes (clearRect, createRadialGradient/addColorStop, arc/fill).
 * This lets us assert on *what* gets drawn without a real canvas backend.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup } from '@testing-library/react'
import { Aurora, MORNING_PALETTE } from './Aurora'

afterEach(cleanup)

/** A fake CanvasRenderingContext2D capturing addColorStop calls per gradient. */
function makeFakeCtx() {
  const colorStops: Array<[string, string]> = []
  const ctx = {
    clearRect: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn((offset: number, color: string) => {
        colorStops.push([String(offset), color])
      }),
    })),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
  }
  return { ctx, colorStops }
}

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? matches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

let ctx: ReturnType<typeof makeFakeCtx>['ctx']
let colorStops: ReturnType<typeof makeFakeCtx>['colorStops']

beforeEach(() => {
  setReducedMotion(false)
  ;({ ctx, colorStops } = makeFakeCtx())
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  )
})

describe('Aurora — mount + z-stack contract (§2.3 Z)', () => {
  it('mounts a fixed, pointer-events-none canvas at z0, opacity .55', () => {
    const { container } = render(<Aurora />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
    expect(canvas).toHaveStyle({
      position: 'fixed',
      inset: '0px',
      zIndex: '0',
      opacity: '0.55',
      pointerEvents: 'none',
    })
  })
})

describe('Aurora — reduced motion (§7 contract)', () => {
  it('paints one static frame and never calls requestAnimationFrame, even across unmount', () => {
    setReducedMotion(true)
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')

    const { unmount } = render(<Aurora />)

    // One frame was actually painted...
    expect(ctx.clearRect).toHaveBeenCalledTimes(1)
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(4) // 4 blobs
    // ...but rAF was never scheduled, before or after unmount.
    expect(rafSpy).not.toHaveBeenCalled()
    unmount()
    expect(rafSpy).not.toHaveBeenCalled()
  })
})

describe('Aurora — palette prop (§6)', () => {
  // Drive the reduced-motion path: it paints its single frame synchronously
  // (no need to invoke a mocked rAF callback), so it doubles as the simplest
  // way to assert exactly what gets drawn to the 2D context.
  it('defaults to the morning palette', () => {
    setReducedMotion(true)

    render(<Aurora />)

    const drawnColors = colorStops.filter(([offset]) => offset === '0').map(([, color]) => color)
    expect(drawnColors).toEqual(MORNING_PALETTE.map((c) => c + 'cc'))
  })

  it('draws the colors passed via the palette prop instead of the default', () => {
    setReducedMotion(true)
    const custom: [string, string, string, string] = ['#111111', '#222222', '#333333', '#444444']

    render(<Aurora palette={custom} />)

    const drawnColors = colorStops.filter(([offset]) => offset === '0').map(([, color]) => color)
    expect(drawnColors).toEqual(custom.map((c) => c + 'cc'))
  })
})

describe('Aurora — unmount cleanup (no leaked rAF loop)', () => {
  it('cancels the rAF loop on unmount', () => {
    let nextId = 1
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => nextId++ as unknown as number)
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

    const { unmount } = render(<Aurora />)
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1)

    unmount()

    expect(cancelSpy).toHaveBeenCalledTimes(1)
    expect(cancelSpy).toHaveBeenCalledWith(1)
  })

  it('removes the resize listener on unmount', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1 as unknown as number)
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = render(<Aurora />)
    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})
