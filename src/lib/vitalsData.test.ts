/**
 * S41 — vitalsData selectors.
 *
 * Covers the numbered DoD:
 *  1. Net worth: last value + signed % delta vs previous point, `.up` gain /
 *     `.dn` loss, both directions.
 *  2. Burn: spend vs income for the latest month, sub names both.
 *  3. Missing/empty finance data → stub fallback (`value: null`), no throw.
 *  4. Selectors are pure (same input → same output, no mutation).
 */
import { describe, it, expect } from 'vitest'
import { netWorthVital, burnVital } from './vitalsData'
import type { NetworthPoint, BurnMonth } from '../vault/finance'

describe('netWorthVital', () => {
  it('empty series → stub fallback (no throw)', () => {
    expect(netWorthVital([])).toEqual({ value: null, sub: 'no data' })
  })

  it('single-point series → shows the value, no delta/direction', () => {
    const series: NetworthPoint[] = [{ date: '2026-07-01', networth: 1_000_000 }]
    const result = netWorthVital(series)
    expect(result.value).toBe(1_000_000)
    expect(result.dir).toBeUndefined()
  })

  it('gain vs previous point → .up, positive % in sub', () => {
    const series: NetworthPoint[] = [
      { date: '2026-06-01', networth: 1_800_000 },
      { date: '2026-07-01', networth: 1_840_000 },
    ]
    const result = netWorthVital(series)
    expect(result.value).toBe(1_840_000)
    expect(result.dir).toBe('up')
    expect(result.sub).toContain('▲')
    // (1840000 - 1800000) / 1800000 * 100 = 2.222...% → 2.2%
    expect(result.sub).toContain('2.2%')
  })

  it('loss vs previous point → .dn, magnitude in sub', () => {
    const series: NetworthPoint[] = [
      { date: '2026-06-01', networth: 1_800_000 },
      { date: '2026-07-01', networth: 1_710_000 },
    ]
    const result = netWorthVital(series)
    expect(result.value).toBe(1_710_000)
    expect(result.dir).toBe('dn')
    expect(result.sub).toContain('▼')
    // (1710000 - 1800000) / 1800000 * 100 = -5% → 5.0%
    expect(result.sub).toContain('5.0%')
  })

  it('zero previous value does not throw / divide-by-zero to Infinity', () => {
    const series: NetworthPoint[] = [
      { date: '2026-06-01', networth: 0 },
      { date: '2026-07-01', networth: 5000 },
    ]
    const result = netWorthVital(series)
    expect(Number.isFinite(result.value)).toBe(true)
    expect(result.sub).not.toContain('Infinity')
  })

  it('is pure — does not mutate the input series', () => {
    const series: NetworthPoint[] = [
      { date: '2026-06-01', networth: 1_800_000 },
      { date: '2026-07-01', networth: 1_840_000 },
    ]
    const copy = JSON.parse(JSON.stringify(series))
    netWorthVital(series)
    expect(series).toEqual(copy)
  })
})

describe('burnVital', () => {
  it('empty burn → stub fallback (no throw)', () => {
    expect(burnVital([])).toEqual({ value: null, sub: 'no data' })
  })

  it('spend under income → .up (saving), sub names both', () => {
    const burn: BurnMonth[] = [{ month: '2026-07', income: 210_000, spend: 96_000 }]
    const result = burnVital(burn)
    expect(result.value).toBe(96_000)
    expect(result.dir).toBe('up')
    expect(result.sub).toContain('spend')
    expect(result.sub).toContain('income')
  })

  it('spend over income → .dn (overspending), sub names both', () => {
    const burn: BurnMonth[] = [{ month: '2026-07', income: 80_000, spend: 96_000 }]
    const result = burnVital(burn)
    expect(result.value).toBe(96_000)
    expect(result.dir).toBe('dn')
    expect(result.sub).toContain('spend')
    expect(result.sub).toContain('income')
  })

  it('uses the latest (last) month when several are present', () => {
    const burn: BurnMonth[] = [
      { month: '2026-06', income: 200_000, spend: 190_000 },
      { month: '2026-07', income: 210_000, spend: 96_000 },
    ]
    const result = burnVital(burn)
    expect(result.value).toBe(96_000)
  })

  it('is pure — does not mutate the input array', () => {
    const burn: BurnMonth[] = [{ month: '2026-07', income: 210_000, spend: 96_000 }]
    const copy = JSON.parse(JSON.stringify(burn))
    burnVital(burn)
    expect(burn).toEqual(copy)
  })
})
