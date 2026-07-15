/**
 * finance unit tests (S39).
 *
 * Four fixture-driven parser groups + currency/date helpers. Each fixture
 * carries malformed rows so every parser proves its malformed-skip behavior,
 * and the fixtures round-trip to the exact expected vault-contract shapes.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parseNetworthHistory,
  parsePortfolio,
  parseBurn,
  parseBills,
  networthDelta,
  dueInDays,
  parseINR,
  formatINR,
  type NetworthPoint,
  type PortfolioSlice,
  type BurnMonth,
  type Bill,
} from './finance'

const HERE = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) =>
  readFileSync(join(HERE, '__fixtures__', `finance-${name}.md`), 'utf8')

// ─── Group 1: net-worth history ──────────────────────────────────────────────

describe('parseNetworthHistory', () => {
  const series = parseNetworthHistory(fixture('networth'))

  it('parses the fixture to the exact expected series (sorted, malformed skipped)', () => {
    // fixture has: 2026-07-01, 2026-06-01, 2026-05-01 (₹17.2L), plus a
    // "not-a-date" row and a 2026-04-01 row with an empty networth cell —
    // both dropped. Header + separator rows are also dropped.
    const expected: NetworthPoint[] = [
      { date: '2026-05-01', networth: 1720000 },
      { date: '2026-06-01', networth: 1780000 },
      { date: '2026-07-01', networth: 1840000 },
    ]
    expect(series).toEqual(expected)
  })

  it('is sorted ascending by date', () => {
    const dates = series.map((p) => p.date)
    expect(dates).toEqual([...dates].sort())
  })

  it('lakh shorthand in a table cell is expanded (₹17.2L → 1720000)', () => {
    expect(series[0]).toEqual({ date: '2026-05-01', networth: 1720000 })
  })

  it('delta between the last two points is computable', () => {
    // 1840000 − 1780000
    expect(networthDelta(series)).toBe(60000)
  })

  it('networthDelta is 0 for a series shorter than two points', () => {
    expect(networthDelta([])).toBe(0)
    expect(networthDelta([{ date: '2026-07-01', networth: 5 }])).toBe(0)
  })
})

// ─── Group 2: portfolio ──────────────────────────────────────────────────────

describe('parsePortfolio', () => {
  const slices = parsePortfolio(fixture('portfolio'))

  it('parses the fixture to the exact expected slices (malformed skipped)', () => {
    // Gold has an empty value:: and the trailing junk line has no fields —
    // both dropped. Mutual funds uses ₹5.52L shorthand.
    const expected: PortfolioSlice[] = [
      { label: 'Equity', value: 920000, pct: 50 },
      { label: 'Mutual funds', value: 552000, pct: 30 },
      { label: 'Cash', value: 368000, pct: 20 },
    ]
    expect(slices).toEqual(expected)
  })

  it('preserves file order', () => {
    expect(slices.map((s) => s.label)).toEqual(['Equity', 'Mutual funds', 'Cash'])
  })
})

// ─── Group 3: burn ───────────────────────────────────────────────────────────

describe('parseBurn', () => {
  const months = parseBurn(fixture('burn'))

  it('parses the fixture to per-month income/spend pairs, sorted, malformed skipped', () => {
    // 2026-05 has spend only (income defaults 0). A "bogus" kind line and a
    // spend row with a non-numeric amount (2026-04) are dropped. 2026-06
    // income is ₹2.05L shorthand.
    const expected: BurnMonth[] = [
      { month: '2026-05', income: 0, spend: 91000 },
      { month: '2026-06', income: 205000, spend: 88400 },
      { month: '2026-07', income: 210000, spend: 96000 },
    ]
    expect(months).toEqual(expected)
  })

  it('is sorted ascending by month', () => {
    const keys = months.map((m) => m.month)
    expect(keys).toEqual([...keys].sort())
  })

  it('drops the month whose only line had an unparseable amount', () => {
    expect(months.find((m) => m.month === '2026-04')).toBeUndefined()
  })
})

// ─── Group 4: bills ──────────────────────────────────────────────────────────

describe('parseBills', () => {
  const bills = parseBills(fixture('bills'))

  it('parses the fixture to the exact expected bills (malformed skipped)', () => {
    // Water has an invalid due date, "Missing amount" has no amount:: —
    // both dropped. Internet uses ₹1.2k shorthand.
    const expected: Bill[] = [
      { name: 'Electricity', amount: 2340, due: '2026-07-20', source: 'gmail', paid: false },
      { name: 'Rent', amount: 32000, due: '2026-07-05', source: 'manual', paid: true },
      { name: 'Internet', amount: 1200, due: '2026-07-22', source: 'gmail', paid: false },
    ]
    expect(bills).toEqual(expected)
  })

  it('sets the paid flag from [x]', () => {
    expect(bills.find((b) => b.name === 'Rent')!.paid).toBe(true)
    expect(bills.find((b) => b.name === 'Electricity')!.paid).toBe(false)
  })
})

// ─── dueInDays helper (boundary 7/8) ─────────────────────────────────────────

describe('dueInDays', () => {
  const today = '2026-07-15'

  it('counts whole days from today to the due date', () => {
    expect(dueInDays('2026-07-20', today)).toBe(5)
    expect(dueInDays('2026-07-15', today)).toBe(0)
  })

  it('is negative for overdue bills', () => {
    expect(dueInDays('2026-07-05', today)).toBe(-10)
  })

  it('flags due-soon (≤7) at the boundary: 7 days is soon, 8 is not', () => {
    const in7 = dueInDays('2026-07-22', today)
    const in8 = dueInDays('2026-07-23', today)
    expect(in7).toBe(7)
    expect(in8).toBe(8)
    expect(in7 <= 7).toBe(true) // flagged
    expect(in8 <= 7).toBe(false) // not flagged
  })

  it('accepts a Date for today', () => {
    expect(dueInDays('2026-07-20', new Date('2026-07-15T09:30:00Z'))).toBe(5)
  })

  it('returns NaN for a malformed due date', () => {
    expect(dueInDays('not-a-date', today)).toBeNaN()
  })
})

// ─── parseINR / formatINR ─────────────────────────────────────────────────────

describe('parseINR', () => {
  it('parses raw numbers, ₹ sign, and lakh/thousand shorthand', () => {
    expect(parseINR('1840000')).toBe(1840000)
    expect(parseINR('₹1840000')).toBe(1840000)
    expect(parseINR('₹18.4L')).toBe(1840000)
    expect(parseINR('18.4L')).toBe(1840000)
    expect(parseINR('₹5.52L')).toBe(552000)
    expect(parseINR('₹96k')).toBe(96000)
    expect(parseINR('₹1.2k')).toBe(1200)
  })

  it('returns null for empty / malformed input', () => {
    expect(parseINR('')).toBeNull()
    expect(parseINR('   ')).toBeNull()
    expect(parseINR('abc')).toBeNull()
    expect(parseINR('not-a-number')).toBeNull()
    expect(parseINR(undefined)).toBeNull()
    expect(parseINR(null)).toBeNull()
  })
})

describe('formatINR', () => {
  it('formats to the documented buckets', () => {
    expect(formatINR(1840000)).toBe('₹18.4L')
    expect(formatINR(96000)).toBe('₹96k')
    expect(formatINR(1720000)).toBe('₹17.2L')
    expect(formatINR(840)).toBe('₹840')
  })

  it('trims a trailing .0 (no ragged decimals)', () => {
    expect(formatINR(2000000)).toBe('₹20L')
    expect(formatINR(50000)).toBe('₹50k')
  })

  it('keeps a sign for negative values (deltas)', () => {
    expect(formatINR(-60000)).toBe('-₹60k')
  })

  it('is tabular-safe: no locale grouping commas that would vary width', () => {
    // Same-magnitude values produce equal-length numeric bodies so digits
    // line up under tabular-nums; assert no comma sneaks in.
    expect(formatINR(1840000)).not.toContain(',')
    expect(formatINR(96000)).not.toContain(',')
  })

  it('round-trips through parseINR for 1-decimal-representable magnitudes', () => {
    // formatINR is a lossy 1-decimal display format, so only values whose
    // shorthand needs ≤1 decimal round-trip exactly (₹5.52L → ₹5.5L would not).
    for (const n of [1840000, 96000, 2000000, 1200]) {
      expect(parseINR(formatINR(n))).toBe(n)
    }
  })
})
