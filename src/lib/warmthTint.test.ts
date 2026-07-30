/**
 * S60 — warmthTint (owner feedback: warmth moves from the vitals strip to
 * the Aurora background tint).
 *
 * Covers the numbered DoD:
 *  3. `warmthTint` is pure (no `Date.now()`, no DOM), all-cold vs all-hot
 *     produce visibly different alphas, and alpha never exceeds the
 *     documented cap.
 */
import { describe, it, expect } from 'vitest'
import { warmthTint, WARMTH_TINT_ALPHA_CAP, WARMTH_OPACITY } from './warmthTint'
import { DOMAINS } from '../data/domains'
import type { Domain } from '../data/domains'
import type { WarmthState } from '../warmth/computeWarmth'

function uniform(state: WarmthState): Record<Domain, WarmthState> {
  const warmth = {} as Record<Domain, WarmthState>
  for (const domain of DOMAINS) warmth[domain] = state
  return warmth
}

describe('warmthTint', () => {
  it('is pure: same input produces the same output, no globals touched', () => {
    const warmth = uniform('warm')
    const first = warmthTint(warmth)
    const second = warmthTint(warmth)
    expect(second).toEqual(first)
  })

  it('never calls Date.now() or touches the DOM (source has no such reference)', async () => {
    const mod = await import('./warmthTint')
    const src = mod.warmthTint.toString()
    expect(src).not.toContain('Date.now')
    expect(src).not.toMatch(/document\.|window\./)
  })

  it('all-cold vault is barely tinted', () => {
    const { alpha } = warmthTint(uniform('cold'))
    expect(alpha).toBeCloseTo(0, 5)
  })

  it('all-hot vault is tinted at the documented cap', () => {
    const { alpha } = warmthTint(uniform('hot'))
    expect(alpha).toBeCloseTo(WARMTH_TINT_ALPHA_CAP, 5)
  })

  it('all-cold and all-hot produce visibly different alphas', () => {
    const cold = warmthTint(uniform('cold')).alpha
    const hot = warmthTint(uniform('hot')).alpha
    expect(hot).toBeGreaterThan(cold)
    expect(hot - cold).toBeGreaterThan(0.05)
  })

  it('alpha never exceeds the documented cap, across every uniform state', () => {
    const states: WarmthState[] = ['hot', 'warm', 'ok', 'stale', 'cold']
    for (const state of states) {
      const { alpha } = warmthTint(uniform(state))
      expect(alpha).toBeLessThanOrEqual(WARMTH_TINT_ALPHA_CAP)
      expect(alpha).toBeGreaterThanOrEqual(0)
    }
  })

  it('alpha never exceeds the cap for a mixed warmth record either', () => {
    const mixed: Record<Domain, WarmthState> = {
      'Building Things': 'hot',
      Career: 'hot',
      Growth: 'warm',
      'Life Admin': 'ok',
      'Body & Mind': 'stale',
      Finance: 'cold',
      Relationship: 'cold',
    }
    const { alpha } = warmthTint(mixed)
    expect(alpha).toBeLessThanOrEqual(WARMTH_TINT_ALPHA_CAP)
  })

  it('blends the 7 domain tokens into a solid rgb() color, not a raw hex or var()', () => {
    const { color } = warmthTint(uniform('hot'))
    expect(color).toMatch(/^rgb\(\d+, \d+, \d+\)$/)
  })

  it('a single hot domain among cold others nudges the blend toward that domain', () => {
    const allCold = uniform('cold')
    const oneHot = { ...allCold, Career: 'hot' as WarmthState }

    const base = warmthTint(allCold)
    const shifted = warmthTint(oneHot)

    expect(shifted).not.toEqual(base)
    expect(shifted.alpha).toBeGreaterThan(base.alpha)
  })

  it('WARMTH_OPACITY spans the full 5-state scale (hot brightest, cold dimmest)', () => {
    expect(WARMTH_OPACITY.hot).toBeGreaterThan(WARMTH_OPACITY.warm)
    expect(WARMTH_OPACITY.warm).toBeGreaterThan(WARMTH_OPACITY.ok)
    expect(WARMTH_OPACITY.ok).toBeGreaterThan(WARMTH_OPACITY.stale)
    expect(WARMTH_OPACITY.stale).toBeGreaterThan(WARMTH_OPACITY.cold)
  })
})
