/**
 * S26 — VitalsRow (DESIGN_LANGUAGE §4.2 / §5).
 *
 * Covers the numbered DoD:
 *  1. 5 tiles render in the named order (Warmth · Net worth · Burn/income ·
 *     Pipeline · Streak).
 *  2. Warmth tile: 7 bars in fixed canonical order, bar opacity derived from
 *     computeWarmth — a hot domain lands in the high-opacity band, a cold
 *     domain in the low band — tinted by domain token.
 *  3. Stub tiles are honest placeholders (`—`), no fake-real numbers.
 *
 * S41 extends this file for the Net worth + Burn/income tiles:
 *  1. Net worth tile: last series value + signed % delta, `.up`/`.dn` per
 *     sign, both directions.
 *  2. Burn tile: spend vs income for the latest month, sub names both.
 *  3. Missing/empty `networth`/`burn` props → stub `—` fallback, no crash.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { VitalsRow, WARMTH_OPACITY } from './VitalsRow'
import { DOMAINS } from '../../data/domains'
import type { Task } from '../../types'
import type { NetworthPoint, BurnMonth } from '../../vault/finance'

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

const NOW = 1_700_000_000_000

/** One completed task in `domain` at `completed_at`, plus the required fields. */
function task(domain: string, completed_at: number): Task {
  return {
    id: `${domain}-${completed_at}`,
    title: `did ${domain}`,
    done: true,
    created_at: completed_at,
    domain,
    completed_at,
  }
}

describe('VitalsRow', () => {
  const originalMatchMedia = window.matchMedia
  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.useRealTimers()
  })

  it('renders 5 tiles in the named §5 order', () => {
    mockMatchMedia(true) // skip count-up so stub `.v` values are stable
    const { container } = render(<VitalsRow tasks={[]} now={NOW} />)

    const labels = Array.from(container.querySelectorAll('.k')).map((el) => el.textContent)
    expect(labels).toEqual(['Warmth', 'Net worth', 'Burn / income', 'Pipeline', 'Streak'])
  })

  it('warmth tile has 7 bars in fixed canonical domain order', () => {
    mockMatchMedia(true)
    render(<VitalsRow tasks={[]} now={NOW} />)

    const bars = screen.getAllByTestId('warmth-bar')
    expect(bars).toHaveLength(7)
    expect(bars.map((b) => b.getAttribute('data-domain'))).toEqual([...DOMAINS])
  })

  it('maps warmth to bar opacity: hot domain high band, cold domain low band', () => {
    mockMatchMedia(true)
    // Building Things completed just now → hot; Relationship never → cold.
    const tasks = [task('Building Things', NOW - 60_000)]
    render(<VitalsRow tasks={tasks} now={NOW} />)

    const bars = screen.getAllByTestId('warmth-bar')
    const bar = (domain: string) => {
      const found = bars.find((b) => b.getAttribute('data-domain') === domain)
      if (!found) throw new Error(`no warmth bar for ${domain}`)
      return found
    }

    const hot = bar('Building Things')
    const cold = bar('Relationship')

    expect(hot).toHaveAttribute('data-warmth', 'hot')
    expect(cold).toHaveAttribute('data-warmth', 'cold')

    const hotOpacity = Number(hot.style.opacity)
    const coldOpacity = Number(cold.style.opacity)

    // Hot lands in the high band, cold in the low band, hot strictly brighter.
    expect(hotOpacity).toBe(WARMTH_OPACITY.hot)
    expect(coldOpacity).toBe(WARMTH_OPACITY.cold)
    expect(hotOpacity).toBeGreaterThanOrEqual(0.85)
    expect(coldOpacity).toBeLessThanOrEqual(0.25)
    expect(hotOpacity).toBeGreaterThan(coldOpacity)
  })

  it('tints each warmth bar with its domain token, not a raw hex', () => {
    mockMatchMedia(true)
    render(<VitalsRow tasks={[]} now={NOW} />)

    const build = screen
      .getAllByTestId('warmth-bar')
      .find((b) => b.getAttribute('data-domain') === 'Building Things')!
    expect(build.style.backgroundColor).toBe('var(--d-build)')
  })

  it('shows stub tiles as honest placeholders (—), no fake-real numbers', () => {
    mockMatchMedia(true)
    render(<VitalsRow tasks={[]} now={NOW} />)

    // Four stub `.v` values, all the em-dash placeholder.
    const dashes = screen.getAllByText('—')
    expect(dashes).toHaveLength(4)
  })

  // ── S41: Net worth + Burn/income tiles ──────────────────────────────────

  it('missing/empty networth + burn props → both tiles fall back to the — stub (no crash)', () => {
    mockMatchMedia(true)
    render(<VitalsRow tasks={[]} now={NOW} />)

    // Net worth, Burn/income, Pipeline, Streak — still 4 dashes total.
    expect(screen.getAllByText('—')).toHaveLength(4)
  })

  it('net worth tile: gain vs previous point renders the value with .up direction', () => {
    mockMatchMedia(true)
    const networth: NetworthPoint[] = [
      { date: '2026-06-01', networth: 1_800_000 },
      { date: '2026-07-01', networth: 1_840_000 },
    ]
    const { container } = render(<VitalsRow tasks={[]} now={NOW} networth={networth} />)

    expect(screen.getByText('₹18.4L')).toBeInTheDocument()
    const sub = container.querySelector('.s.up')
    expect(sub).toBeInTheDocument()
    expect(sub).toHaveTextContent('▲')
  })

  it('net worth tile: loss vs previous point renders the value with .dn direction', () => {
    mockMatchMedia(true)
    const networth: NetworthPoint[] = [
      { date: '2026-06-01', networth: 1_800_000 },
      { date: '2026-07-01', networth: 1_710_000 },
    ]
    const { container } = render(<VitalsRow tasks={[]} now={NOW} networth={networth} />)

    expect(screen.getByText('₹17.1L')).toBeInTheDocument()
    const sub = container.querySelector('.s.dn')
    expect(sub).toBeInTheDocument()
    expect(sub).toHaveTextContent('▼')
  })

  it('burn tile: names both spend and income for the latest month', () => {
    mockMatchMedia(true)
    const burn: BurnMonth[] = [{ month: '2026-07', income: 210_000, spend: 96_000 }]
    const { container } = render(<VitalsRow tasks={[]} now={NOW} burn={burn} />)

    expect(screen.getByText('₹96k')).toBeInTheDocument()
    const subText = Array.from(container.querySelectorAll('.s')).map((el) => el.textContent)
    expect(subText.some((t) => t?.includes('spend') && t?.includes('income'))).toBe(true)
  })

  it('burn tile: overspending (spend > income) renders .dn direction', () => {
    mockMatchMedia(true)
    const burn: BurnMonth[] = [{ month: '2026-07', income: 80_000, spend: 96_000 }]
    const { container } = render(<VitalsRow tasks={[]} now={NOW} burn={burn} />)

    const sub = container.querySelector('.s.dn')
    expect(sub).toBeInTheDocument()
  })

  it('count-up preserved: reduced motion still applies to the wired money tiles', () => {
    mockMatchMedia(false) // motion NOT reduced → count-up starts at 0
    const networth: NetworthPoint[] = [
      { date: '2026-06-01', networth: 1_800_000 },
      { date: '2026-07-01', networth: 1_840_000 },
    ]
    render(<VitalsRow tasks={[]} now={NOW} networth={networth} />)

    // Before the count-up timer fires, the Net worth tile has not yet
    // reached its target — the animated `.v` starts at the formatted 0,
    // proving the tile still goes through Vital's count-up, not a static
    // render straight to the final value.
    expect(screen.queryByText('₹18.4L')).not.toBeInTheDocument()
  })
})
