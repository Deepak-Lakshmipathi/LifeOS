/**
 * Tests for S40 — MoneyView (DESIGN_LANGUAGE §5 layout, §4.9 widgets).
 *
 * Fixture-first (per ticket): reads the S39 committed fixtures
 * (src/vault/__fixtures__/finance-*.md), parses them through the real S39
 * parsers, and renders MoneyView from that parsed data — zero network, zero
 * secrets, zero fetching inside the component itself.
 *
 * jsdom has no real 2D canvas, so canvas mounts (Sparkline/Donut) are
 * verified structurally here; their draw math is covered by their own unit
 * tests. `framer-motion` is mocked to force `useReducedMotion() -> true` so
 * the big-metric count-up resolves synchronously (no timer-driven flake) —
 * count-up's own reduced-motion no-op behavior is exercised directly below.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { MoneyView } from './MoneyView'
import {
  parseNetworthHistory,
  parsePortfolio,
  parseBurn,
  parseBills,
} from '../../vault/finance'

vi.mock('framer-motion', () => ({
  useReducedMotion: () => true,
}))

beforeEach(() => {
  // Sparkline/Donut draw to canvas — jsdom has no real 2D backend, so stub
  // getContext with a permissive no-op object (mount-level assertions only;
  // draw math is covered by Sparkline.test.tsx / Donut.test.tsx).
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D)
})

afterEach(cleanup)

const HERE = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) =>
  readFileSync(join(HERE, '..', '..', 'vault', '__fixtures__', `finance-${name}.md`), 'utf8')

function fixtureProps() {
  return {
    networth: parseNetworthHistory(fixture('networth')),
    portfolio: parsePortfolio(fixture('portfolio')),
    burn: parseBurn(fixture('burn')),
    bills: parseBills(fixture('bills')),
    now: '2026-07-15',
  }
}

describe('MoneyView — DoD #1: every §4.9 widget present, from S39 fixture data', () => {
  it('renders all four cards', () => {
    render(<MoneyView {...fixtureProps()} />)
    expect(screen.getByTestId('money-networth-card')).toBeInTheDocument()
    expect(screen.getByTestId('money-burn-card')).toBeInTheDocument()
    expect(screen.getByTestId('money-portfolio-card')).toBeInTheDocument()
    expect(screen.getByTestId('money-bills-card')).toBeInTheDocument()
  })

  it('mounts the sparkline canvas (net worth)', () => {
    render(<MoneyView {...fixtureProps()} />)
    expect(screen.getByTestId('sparkline-canvas')).toBeInTheDocument()
  })

  it('mounts the donut canvas + legend (portfolio)', () => {
    render(<MoneyView {...fixtureProps()} />)
    expect(screen.getByTestId('donut-canvas')).toBeInTheDocument()
    expect(screen.getAllByTestId('donut-legend-row').map((r) => r.textContent)).toEqual([
      'Equity',
      'Mutual funds',
      'Cash',
    ])
  })

  it('mounts income + spend bar meters (burn)', () => {
    render(<MoneyView {...fixtureProps()} />)
    const tracks = screen.getAllByTestId('bar-meter-track')
    expect(tracks.map((t) => t.getAttribute('data-variant'))).toEqual(['income', 'spend'])
  })

  it('mounts the bills rows', () => {
    render(<MoneyView {...fixtureProps()} />)
    // Electricity, Rent, Internet parse cleanly from the fixture (Water and
    // "Missing amount" are malformed and dropped by parseBills).
    expect(screen.getAllByTestId('bill-row')).toHaveLength(3)
  })
})

describe('MoneyView — big metric (§2.2, §4.9)', () => {
  it('shows the latest net worth via formatINR, count-up resolved (reduced motion mocked)', () => {
    render(<MoneyView {...fixtureProps()} />)
    // Fixture's latest point: 2026-07-01 -> 1840000 -> formatINR -> ₹18.4L
    expect(screen.getByText('₹18.4L')).toBeInTheDocument()
  })

  it('shows an up delta sub for a gaining net worth', () => {
    render(<MoneyView {...fixtureProps()} />)
    // delta = 1840000 - 1780000 = 60000; pct = 60000/1780000*100 ≈ 3.4%
    const sub = document.querySelector('.s.up')
    expect(sub).not.toBeNull()
    expect(sub!.textContent).toBe('▲ 3.4% this month')
  })
})

describe('MoneyView — DoD #5: money right-aligned tabular via formatINR', () => {
  it('the big metric carries tabular-nums', () => {
    render(<MoneyView {...fixtureProps()} />)
    const big = document.querySelector('.big')
    expect(big).not.toBeNull()
    expect(big!.className).toContain('tabular-nums')
  })

  it('bill amounts are right-aligned and tabular', () => {
    render(<MoneyView {...fixtureProps()} />)
    expect(screen.getByText('₹2.3k').className).toContain('tabular-nums')
    expect(screen.getByText('₹2.3k').className).toContain('text-right')
  })
})

describe('MoneyView — DoD #4: bills due-soon / paid states, from fixture', () => {
  it('flags the 5-day-out bill red and dims the paid one', () => {
    render(<MoneyView {...fixtureProps()} />)
    const rows = screen.getAllByTestId('bill-row')
    const electricity = rows.find((r) => r.textContent?.includes('Electricity'))!
    const rent = rows.find((r) => r.textContent?.includes('Rent'))!

    expect(electricity).toHaveAttribute('data-due-soon', 'true')
    expect(rent).toHaveAttribute('data-paid', 'true')
    expect(rent.textContent).toContain('✓ paid')
  })
})

describe('MoneyView — honest empty states (no fetching, no fake data)', () => {
  it('renders "no data yet" copy when every prop is omitted (App.tsx mounts with none)', () => {
    render(<MoneyView />)
    expect(screen.getByText('No net worth data yet.')).toBeInTheDocument()
    expect(screen.getByText('No burn data yet.')).toBeInTheDocument()
    expect(screen.getByText('No portfolio data yet.')).toBeInTheDocument()
    expect(screen.getByText('No bills yet.')).toBeInTheDocument()
  })
})
