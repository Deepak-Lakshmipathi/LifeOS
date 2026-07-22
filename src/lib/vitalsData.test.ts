/**
 * S41 — vitalsData selectors.
 *
 * Covers the numbered DoD:
 *  1. Net worth: last value + signed % delta vs previous point, `.up` gain /
 *     `.dn` loss, both directions.
 *  2. Burn: spend vs income for the latest month, sub names both.
 *  3. Missing/empty finance data → stub fallback (`value: null`), no throw.
 *  4. Selectors are pure (same input → same output, no mutation).
 *
 * S45 extends this file for `pipelineVital`:
 *  1. Active count (found + applied + interview) — closed excluded.
 *  2. Empty entries → stub fallback (`value: null`), no throw.
 *  3. Sub line: interview count when present, else the hottest `next::` step.
 */
import { describe, it, expect } from 'vitest'
import { netWorthVital, burnVital, pipelineVital } from './vitalsData'
import type { NetworthPoint, BurnMonth } from '../vault/finance'
import type { JobEntry } from '../vault/career'

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

describe('pipelineVital', () => {
  /** Minimal JobEntry factory — only the fields pipelineVital reads matter. */
  function entry(over: Partial<JobEntry> & Pick<JobEntry, 'company' | 'stage'>): JobEntry {
    return {
      role: '',
      hot: false,
      ...over,
    }
  }

  it('empty entries → stub fallback (no throw)', () => {
    expect(pipelineVital([])).toEqual({ value: null, sub: 'no data' })
  })

  it('counts active roles (found + applied + interview), closed excluded', () => {
    const entries: JobEntry[] = [
      entry({ company: 'InstaCo', stage: 'applied' }),
      entry({ company: 'NorthStar', stage: 'interview' }),
      entry({ company: 'Acme', stage: 'found' }),
      entry({ company: 'OldCorp', stage: 'closed' }),
    ]
    const result = pipelineVital(entries)
    expect(result.value).toBe(3)
  })

  it('non-empty entries with everything closed → 0 active, not the no-data stub', () => {
    const entries: JobEntry[] = [entry({ company: 'OldCorp', stage: 'closed' })]
    const result = pipelineVital(entries)
    expect(result.value).toBe(0)
    expect(result.sub).toBe('no active roles')
  })

  it('sub leads with the interview count when at least one interview is active', () => {
    const entries: JobEntry[] = [
      entry({ company: 'InstaCo', stage: 'applied' }),
      entry({ company: 'NorthStar', stage: 'interview', hot: true, next: 'prep system design' }),
    ]
    const result = pipelineVital(entries)
    expect(result.sub).toBe('1 interview')
  })

  it('pluralizes the interview count', () => {
    const entries: JobEntry[] = [
      entry({ company: 'NorthStar', stage: 'interview' }),
      entry({ company: 'Globex', stage: 'interview' }),
    ]
    const result = pipelineVital(entries)
    expect(result.sub).toBe('2 interviews')
  })

  it('no interview in flight → sub falls back to the hottest active next:: step', () => {
    const entries: JobEntry[] = [
      entry({ company: 'Acme', stage: 'found', next: 'wait for reply' }),
      entry({ company: 'Globex', stage: 'applied', hot: true, next: 'follow up urgently' }),
    ]
    const result = pipelineVital(entries)
    expect(result.sub).toBe('follow up urgently')
  })

  it('no hot entry → falls back to the first active entry with a next:: step', () => {
    const entries: JobEntry[] = [
      entry({ company: 'Acme', stage: 'found' }),
      entry({ company: 'Globex', stage: 'applied', next: 'follow up with recruiter' }),
    ]
    const result = pipelineVital(entries)
    expect(result.sub).toBe('follow up with recruiter')
  })

  it('no interview and no next:: anywhere → honest fallback sub', () => {
    const entries: JobEntry[] = [entry({ company: 'Acme', stage: 'found' })]
    const result = pipelineVital(entries)
    expect(result.sub).toBe('no interviews yet')
  })

  it('is pure — does not mutate the input array', () => {
    const entries: JobEntry[] = [entry({ company: 'InstaCo', stage: 'applied' })]
    const copy = JSON.parse(JSON.stringify(entries))
    pipelineVital(entries)
    expect(entries).toEqual(copy)
  })
})
