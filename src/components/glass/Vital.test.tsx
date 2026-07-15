/**
 * S21 — Vital (DESIGN_LANGUAGE §4.2).
 * k/v/s anatomy, .up/.dn sub coloring, count-up on mount, and the
 * reduced-motion guard (skip straight to the final value).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, act } from '@testing-library/react'
import { Vital } from './Vital'

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

describe('Vital', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.useRealTimers()
  })

  it('renders the k/v/s anatomy', () => {
    mockMatchMedia(true) // skip the count-up so `.v` is stable to assert on
    render(<Vital k="Net worth" value={18.4} format={(v) => `₹${v.toFixed(1)}L`} sub="▲ 2.1% this month" subDirection="up" />)

    expect(screen.getByText('Net worth')).toBeInTheDocument()
    expect(screen.getByText('₹18.4L')).toBeInTheDocument()
    expect(screen.getByText('▲ 2.1% this month')).toBeInTheDocument()
  })

  it('colors the sub .up as --good and .dn as --bad', () => {
    mockMatchMedia(true)
    const { rerender } = render(<Vital k="k" value={1} sub="up sub" subDirection="up" />)
    expect(screen.getByText('up sub').className).toContain('text-good')

    rerender(<Vital k="k" value={1} sub="dn sub" subDirection="dn" />)
    expect(screen.getByText('dn sub').className).toContain('text-bad')
  })

  it('counts up from 0 to the final value over ~900ms', () => {
    mockMatchMedia(false)
    vi.useFakeTimers()

    render(<Vital k="Net worth" value={100} format={(v) => Math.round(v).toString()} />)

    // Immediately on mount the animation has not advanced yet.
    expect(screen.getByText('0')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('renders the final value immediately under prefers-reduced-motion', () => {
    mockMatchMedia(true)

    render(<Vital k="Net worth" value={100} format={(v) => Math.round(v).toString()} />)

    expect(screen.getByText('100')).toBeInTheDocument()
  })
})
