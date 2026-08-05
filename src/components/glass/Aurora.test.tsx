/**
 * Tests for Slice S22 — Aurora canvas background, extended by S60.
 *
 * jsdom has no real 2D canvas context, so `HTMLCanvasElement.getContext` is
 * stubbed (once, in beforeEach) with spies covering the drawing calls the
 * component makes (clearRect, createRadialGradient/addColorStop, arc/fill).
 * This lets us assert on *what* gets drawn without a real canvas backend.
 *
 * S60 (owner feedback items 3+4): Warmth's vital tile is gone — Aurora
 * renders a static warmth tint layer instead. #186 removed the self-load:
 * `tasks` is now a required prop fed by the single `useTasks` owner in
 * App.tsx, so no test here can reach a provider even in principle. Every
 * render below passes `tasks` explicitly, as they always did.
 *
 * These tests cover the tint's MATH (computeWarmth → warmthTint → opacity),
 * not its liveness after a write. That liveness is guarded once, at the App
 * level, by `src/test/completionLiveUpdate.test.tsx` — Aurora and VitalsRow
 * receive the same prop from the same owner, so the tint cannot go stale
 * unless the Completion tile does too.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup } from '@testing-library/react'
import { Aurora, MORNING_PALETTE } from './Aurora'
import type { Task } from '../../types'

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

const NOW = 1_700_000_000_000

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
    const { container } = render(<Aurora tasks={[]} now={NOW} />)
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

    const { unmount } = render(<Aurora tasks={[]} now={NOW} />)

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

    render(<Aurora tasks={[]} now={NOW} />)

    const drawnColors = colorStops.filter(([offset]) => offset === '0').map(([, color]) => color)
    expect(drawnColors).toEqual(MORNING_PALETTE.map((c) => c + 'cc'))
  })

  it('draws the colors passed via the palette prop instead of the default', () => {
    setReducedMotion(true)
    const custom: [string, string, string, string] = ['#111111', '#222222', '#333333', '#444444']

    render(<Aurora palette={custom} tasks={[]} now={NOW} />)

    const drawnColors = colorStops.filter(([offset]) => offset === '0').map(([, color]) => color)
    expect(drawnColors).toEqual(custom.map((c) => c + 'cc'))
  })
})

describe('Aurora — unmount cleanup (no leaked rAF loop)', () => {
  it('cancels the rAF loop on unmount', () => {
    let nextId = 1
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => nextId++ as unknown as number)
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

    const { unmount } = render(<Aurora tasks={[]} now={NOW} />)
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1)

    unmount()

    expect(cancelSpy).toHaveBeenCalledTimes(1)
    expect(cancelSpy).toHaveBeenCalledWith(1)
  })

  it('removes the resize listener on unmount', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1 as unknown as number)
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = render(<Aurora tasks={[]} now={NOW} />)
    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})

// ── S60: warmth background tint ───────────────────────────────────────────

describe('Aurora — warmth tint layer (S60)', () => {
  it('renders a static fixed inset-0 tint layer alongside the canvas', () => {
    setReducedMotion(true)
    const { container } = render(<Aurora tasks={[]} now={NOW} />)

    const tint = container.querySelector('[data-testid="warmth-tint"]')
    expect(tint).toBeInTheDocument()
    expect(tint).toHaveStyle({
      position: 'fixed',
      inset: '0px',
      zIndex: '0',
      pointerEvents: 'none',
    })
  })

  it('renders the tint after the canvas in DOM order, so it stacks above the aurora and below the shell', () => {
    setReducedMotion(true)
    const { container } = render(<Aurora tasks={[]} now={NOW} />)

    const children = Array.from(container.children)
    const canvasIndex = children.findIndex((el) => el.tagName === 'CANVAS')
    const tintIndex = children.findIndex((el) => el.getAttribute('data-testid') === 'warmth-tint')

    expect(canvasIndex).toBeGreaterThanOrEqual(0)
    expect(tintIndex).toBeGreaterThan(canvasIndex)
  })

  it('an all-cold task list (nothing ever completed) renders a barely-there tint', () => {
    setReducedMotion(true)
    const { container } = render(<Aurora tasks={[]} now={NOW} />)

    const tint = container.querySelector('[data-testid="warmth-tint"]') as HTMLElement
    expect(Number(tint.style.opacity)).toBeCloseTo(0, 5)
  })

  it('a freshly-completed task warms its domain and raises the tint alpha above the all-cold baseline', () => {
    setReducedMotion(true)
    const coldTasks: Task[] = []
    const hotTasks: Task[] = [
      { id: 'a', title: 'did a thing', done: true, created_at: NOW, domain: 'Career', completed_at: NOW - 1000 },
    ]

    const cold = render(<Aurora tasks={coldTasks} now={NOW} />)
    const coldAlpha = Number(
      (cold.container.querySelector('[data-testid="warmth-tint"]') as HTMLElement).style.opacity
    )
    cold.unmount()

    const hot = render(<Aurora tasks={hotTasks} now={NOW} />)
    const hotAlpha = Number(
      (hot.container.querySelector('[data-testid="warmth-tint"]') as HTMLElement).style.opacity
    )

    expect(hotAlpha).toBeGreaterThan(coldAlpha)
    // §7/§8 non-negotiable cap — never a fully opaque colored ground.
    expect(hotAlpha).toBeLessThanOrEqual(0.1)
  })

  // #186 deleted the "injecting tasks short-circuits the provider load" test
  // that used to sit here. Aurora no longer HAS a load path — `tasks` is a
  // required prop off the single `useTasks` owner — so spying on
  // `LocalOnly.prototype.list` and asserting it was never called had become a
  // tautology that could not fail. A test whose name advertises a guard the
  // code no longer contains is the #120 failure mode; deleted rather than
  // rewritten, because the property it claimed is now structural.

  it('does not schedule requestAnimationFrame for the tint layer (static, no reduced-motion branch needed)', () => {
    setReducedMotion(false)
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1 as unknown as number)

    render(<Aurora tasks={[]} now={NOW} />)

    // The canvas drift loop still schedules exactly one rAF (unchanged S22
    // behavior) — the tint itself adds none on top of that.
    expect(rafSpy).toHaveBeenCalledTimes(1)
  })
})
