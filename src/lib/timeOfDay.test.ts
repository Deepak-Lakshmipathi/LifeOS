/**
 * Unit tests for the timeOfDay helper.
 *
 * All tests inject fixed epoch timestamps — no Date.now() is called inside
 * getTimeOfDay, so we do not need to mock the global Date object.
 */

import { describe, it, expect } from 'vitest'
import { getTimeOfDay, TIME_GRADIENTS, TIME_SOLID_BG, cockpitMode } from './timeOfDay'
import type { TimeOfDayBucket } from './timeOfDay'

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a timestamp for a specific local hour on an arbitrary day (2024-01-15).
 * We use a fixed date so these tests are deterministic regardless of the
 * machine's timezone — as long as it matches local Date.getHours() semantics,
 * which is exactly what the helper uses.
 */
function tsAtHour(hour: number): number {
  const d = new Date(2024, 0, 15) // Jan 15 2024
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}

// ── getTimeOfDay ─────────────────────────────────────────────────────────────

describe('getTimeOfDay', () => {
  it('returns "night" at midnight (hour 0)', () => {
    expect(getTimeOfDay(tsAtHour(0))).toBe('night')
  })

  it('returns "night" at 04:00 (just before morning starts)', () => {
    expect(getTimeOfDay(tsAtHour(4))).toBe('night')
  })

  it('returns "morning" at 05:00 (morning boundary start)', () => {
    expect(getTimeOfDay(tsAtHour(5))).toBe('morning')
  })

  it('returns "morning" at 07:30', () => {
    const d = new Date(2024, 0, 15)
    d.setHours(7, 30, 0, 0)
    expect(getTimeOfDay(d.getTime())).toBe('morning')
  })

  it('returns "morning" at 08:59 (last morning minute)', () => {
    const d = new Date(2024, 0, 15)
    d.setHours(8, 59, 59, 0)
    expect(getTimeOfDay(d.getTime())).toBe('morning')
  })

  it('returns "day" at 09:00 (day boundary start)', () => {
    expect(getTimeOfDay(tsAtHour(9))).toBe('day')
  })

  it('returns "day" at 13:00 (midday)', () => {
    expect(getTimeOfDay(tsAtHour(13))).toBe('day')
  })

  it('returns "day" at 17:59 (last daytime minute)', () => {
    const d = new Date(2024, 0, 15)
    d.setHours(17, 59, 59, 0)
    expect(getTimeOfDay(d.getTime())).toBe('day')
  })

  it('returns "evening" at 18:00 (evening boundary start)', () => {
    expect(getTimeOfDay(tsAtHour(18))).toBe('evening')
  })

  it('returns "evening" at 19:30', () => {
    const d = new Date(2024, 0, 15)
    d.setHours(19, 30, 0, 0)
    expect(getTimeOfDay(d.getTime())).toBe('evening')
  })

  it('returns "evening" at 20:59 (last evening minute)', () => {
    const d = new Date(2024, 0, 15)
    d.setHours(20, 59, 59, 0)
    expect(getTimeOfDay(d.getTime())).toBe('evening')
  })

  it('returns "night" at 21:00 (night boundary start)', () => {
    expect(getTimeOfDay(tsAtHour(21))).toBe('night')
  })

  it('returns "night" at 23:59 (end of day)', () => {
    const d = new Date(2024, 0, 15)
    d.setHours(23, 59, 59, 0)
    expect(getTimeOfDay(d.getTime())).toBe('night')
  })
})

// ── TIME_GRADIENTS ────────────────────────────────────────────────────────────

describe('TIME_GRADIENTS', () => {
  const buckets: TimeOfDayBucket[] = ['morning', 'day', 'evening', 'night']

  it('has a defined gradient string for all four buckets', () => {
    for (const b of buckets) {
      expect(typeof TIME_GRADIENTS[b]).toBe('string')
      expect(TIME_GRADIENTS[b].length).toBeGreaterThan(0)
    }
  })

  it('all gradient strings start with "linear-gradient"', () => {
    for (const b of buckets) {
      expect(TIME_GRADIENTS[b]).toMatch(/^linear-gradient/)
    }
  })
})

// ── TIME_SOLID_BG ─────────────────────────────────────────────────────────────

describe('TIME_SOLID_BG', () => {
  const buckets: TimeOfDayBucket[] = ['morning', 'day', 'evening', 'night']

  it('has a defined hex string for all four buckets', () => {
    for (const b of buckets) {
      expect(TIME_SOLID_BG[b]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})

// ── cockpitMode (v2, docs/DESIGN_LANGUAGE.md §6) ─────────────────────────────
//
// Boundary-exact tests per S23 DoD #1: 11:59 / 12:00 / 17:59 / 18:00.

describe('cockpitMode', () => {
  function tsAt(hour: number, minute: number): number {
    const d = new Date(2024, 0, 15) // Jan 15 2024, arbitrary fixed day
    d.setHours(hour, minute, 0, 0)
    return d.getTime()
  }

  it('returns "am" at 00:00 (midnight)', () => {
    expect(cockpitMode(tsAt(0, 0))).toBe('am')
  })

  it('returns "am" at 11:59 (last minute before mid)', () => {
    expect(cockpitMode(tsAt(11, 59))).toBe('am')
  })

  it('returns "mid" at 12:00 (mid boundary start)', () => {
    expect(cockpitMode(tsAt(12, 0))).toBe('mid')
  })

  it('returns "mid" at 17:59 (last minute before pm)', () => {
    expect(cockpitMode(tsAt(17, 59))).toBe('mid')
  })

  it('returns "pm" at 18:00 (pm boundary start)', () => {
    expect(cockpitMode(tsAt(18, 0))).toBe('pm')
  })

  it('returns "pm" at 23:59 (end of day)', () => {
    expect(cockpitMode(tsAt(23, 59))).toBe('pm')
  })
})
