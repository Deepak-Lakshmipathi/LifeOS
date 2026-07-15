/**
 * calendar unit tests (S33).
 *
 * Covers parseCalendar + parseEventLine + freeGaps against the documented
 * `Calendar/today.md` contract:
 *   - fixture parses to the exact expected events (DoD #1),
 *   - freeGaps: normal / overlap-merge / empty-day cases (DoD #2),
 *   - malformed lines skipped without throwing; unknown type → other (DoD #3),
 *   - parsed date exposed for staleness detection (DoD #4).
 */

import { describe, it, expect } from 'vitest'
import {
  parseCalendar,
  parseEventLine,
  freeGaps,
  type CalEvent,
} from './calendar'
// Vite raw-import: the fixture IS the vault contract — the round-trip test
// asserts real file bytes parse to the expected shape.
import fixtureMd from './__fixtures__/calendar-today.md?raw'

// ─── DoD #1 — fixture parses to the exact expected events ─────────────────────

describe('parseCalendar — fixture round-trips the vault contract (DoD #1)', () => {
  const { date, events } = parseCalendar(fixtureMd)

  it('exposes the ISO date from the header (DoD #4 — staleness detectable)', () => {
    expect(date).toBe('2026-07-14')
  })

  it('parses exactly the four well-formed events (malformed line skipped)', () => {
    expect(events).toHaveLength(4)
  })

  it('parses each event with exact times, title, and type', () => {
    expect(events).toEqual<CalEvent[]>([
      { start: '08:00', end: '09:00', title: 'Gym — legs', type: 'gym' },
      {
        start: '10:00',
        end: '11:00',
        title: 'Client call — NorthStar handoff',
        type: 'call',
      },
      {
        start: '14:00',
        end: '16:00',
        title: 'Deep work — Module 4',
        type: 'deep',
      },
      // unknown type "errand" → other (DoD #3)
      { start: '17:00', end: '17:30', title: 'Grocery run', type: 'other' },
    ])
  })
})

// ─── DoD #4 — date exposed / staleness ───────────────────────────────────────

describe('parseCalendar — date header (DoD #4)', () => {
  it('exposes yesterday-dated file date so UI can mark staleness', () => {
    const { date } = parseCalendar('# 2026-07-10\n- 09:00-10:00 Standup (type:: call)\n')
    expect(date).toBe('2026-07-10')
  })

  it('date is undefined when no valid header present', () => {
    const { date } = parseCalendar('- 09:00-10:00 Standup (type:: call)\n')
    expect(date).toBeUndefined()
  })

  it('ignores a malformed date header', () => {
    const { date, events } = parseCalendar('# not-a-date\n- 09:00-10:00 Standup\n')
    expect(date).toBeUndefined()
    expect(events).toHaveLength(1)
  })
})

// ─── DoD #3 — malformed lines skipped; unknown type → other ──────────────────

describe('parseEventLine — type handling (DoD #3)', () => {
  it('maps each known type', () => {
    expect(parseEventLine('- 08:00-09:00 A (type:: call)')!.type).toBe('call')
    expect(parseEventLine('- 08:00-09:00 A (type:: deep)')!.type).toBe('deep')
    expect(parseEventLine('- 08:00-09:00 A (type:: gym)')!.type).toBe('gym')
    expect(parseEventLine('- 08:00-09:00 A (type:: other)')!.type).toBe('other')
  })

  it('unknown type → other', () => {
    expect(parseEventLine('- 08:00-09:00 A (type:: errand)')!.type).toBe('other')
    expect(parseEventLine('- 08:00-09:00 A (type:: WEIRD)')!.type).toBe('other')
  })

  it('missing type field → other, title kept verbatim', () => {
    const e = parseEventLine('- 08:00-09:00 No type here')!
    expect(e.type).toBe('other')
    expect(e.title).toBe('No type here')
  })

  it('type is case-insensitive', () => {
    expect(parseEventLine('- 08:00-09:00 A (type:: CALL)')!.type).toBe('call')
  })

  it('strips the type field from the title', () => {
    expect(parseEventLine('- 10:00-11:00 Client call (type:: call)')!.title).toBe(
      'Client call',
    )
  })
})

describe('parseEventLine — malformed lines return null (never throw) (DoD #3)', () => {
  const cases: Array<[string, string]> = [
    ['empty string', ''],
    ['whitespace only', '   '],
    ['prose', 'Some random note in the file'],
    ['heading', '# 2026-07-14'],
    ['bullet without time range', '- Just a bullet'],
    ['single time, no range', '- 08:00 Standup'],
    ['end before start', '- 10:00-09:00 Backwards'],
    ['zero-length range', '- 09:00-09:00 Instant'],
    ['hour out of range', '- 25:00-26:00 Bad hour'],
    ['minute out of range', '- 08:70-09:00 Bad minute'],
    ['no title after range', '- 08:00-09:00    '],
    ['wrong bullet char', '* 08:00-09:00 Star bullet (type:: call)'],
  ]

  for (const [name, line] of cases) {
    it(`${name} → null`, () => {
      expect(() => parseEventLine(line)).not.toThrow()
      expect(parseEventLine(line)).toBeNull()
    })
  }
})

describe('parseCalendar — malformed lines skipped without throwing (DoD #3)', () => {
  it('a file full of garbage parses to zero events and never throws', () => {
    const md = [
      'random prose',
      '- not an event',
      '- 99:99-88:88 nonsense',
      '## some heading',
      '',
    ].join('\n')
    let result!: ReturnType<typeof parseCalendar>
    expect(() => {
      result = parseCalendar(md)
    }).not.toThrow()
    expect(result.events).toHaveLength(0)
  })

  it('interleaved good and bad lines keep only the good events', () => {
    const md = [
      '# 2026-07-14',
      '- 08:00-09:00 Good one (type:: gym)',
      'garbage line',
      '- 10:00-11:00 Good two (type:: call)',
      '- malformed',
    ].join('\n')
    const { events } = parseCalendar(md)
    expect(events.map((e) => e.title)).toEqual(['Good one', 'Good two'])
  })
})

// ─── DoD #2 — freeGaps: normal / overlap / empty ─────────────────────────────

describe('freeGaps — fixture (normal case) (DoD #2)', () => {
  const { events } = parseCalendar(fixtureMd)
  const gaps = freeGaps(events) // default 08:00–22:00

  it('returns the correct gap list with minute counts', () => {
    // Events: 08–09 gym, 10–11 call, 14–16 deep, 17:00–17:30 errand.
    // Day 08:00–22:00. Expected free windows between/after events:
    expect(gaps).toEqual([
      { start: '09:00', end: '10:00', minutes: 60 },
      { start: '11:00', end: '14:00', minutes: 180 },
      { start: '16:00', end: '17:00', minutes: 60 },
      { start: '17:30', end: '22:00', minutes: 270 },
    ])
  })

  it('no gap is emitted for the 08:00 event flush against day start', () => {
    expect(gaps.some((g) => g.start === '08:00')).toBe(false)
  })
})

describe('freeGaps — empty day → one full-day gap (DoD #2)', () => {
  it('no events → single gap spanning the whole day', () => {
    expect(freeGaps([])).toEqual([
      { start: '08:00', end: '22:00', minutes: 14 * 60 },
    ])
  })

  it('respects custom day bounds', () => {
    expect(freeGaps([], '06:00', '10:00')).toEqual([
      { start: '06:00', end: '10:00', minutes: 240 },
    ])
  })
})

describe('freeGaps — overlap merge (DoD #2)', () => {
  it('merges two overlapping events into one busy block', () => {
    const events: CalEvent[] = [
      { start: '10:00', end: '12:00', title: 'A', type: 'deep' },
      { start: '11:00', end: '13:00', title: 'B', type: 'call' },
    ]
    // Merged busy block 10:00–13:00 → gaps 08–10 and 13–22.
    expect(freeGaps(events)).toEqual([
      { start: '08:00', end: '10:00', minutes: 120 },
      { start: '13:00', end: '22:00', minutes: 540 },
    ])
  })

  it('merges a fully-contained event', () => {
    const events: CalEvent[] = [
      { start: '10:00', end: '16:00', title: 'Big', type: 'deep' },
      { start: '12:00', end: '13:00', title: 'Inside', type: 'call' },
    ]
    expect(freeGaps(events)).toEqual([
      { start: '08:00', end: '10:00', minutes: 120 },
      { start: '16:00', end: '22:00', minutes: 360 },
    ])
  })

  it('handles unsorted input (sorts before deriving gaps)', () => {
    const events: CalEvent[] = [
      { start: '14:00', end: '15:00', title: 'Late', type: 'deep' },
      { start: '09:00', end: '10:00', title: 'Early', type: 'gym' },
    ]
    expect(freeGaps(events)).toEqual([
      { start: '08:00', end: '09:00', minutes: 60 },
      { start: '10:00', end: '14:00', minutes: 240 },
      { start: '15:00', end: '22:00', minutes: 420 },
    ])
  })

  it('adjacent (touching) events produce no spurious zero-length gap', () => {
    const events: CalEvent[] = [
      { start: '09:00', end: '10:00', title: 'A', type: 'call' },
      { start: '10:00', end: '11:00', title: 'B', type: 'call' },
    ]
    expect(freeGaps(events)).toEqual([
      { start: '08:00', end: '09:00', minutes: 60 },
      { start: '11:00', end: '22:00', minutes: 660 },
    ])
  })
})

describe('freeGaps — clamping to day bounds (DoD #2)', () => {
  it('clamps an event that starts before day start', () => {
    const events: CalEvent[] = [
      { start: '06:00', end: '09:00', title: 'Early bird', type: 'deep' },
    ]
    expect(freeGaps(events)).toEqual([
      { start: '09:00', end: '22:00', minutes: 780 },
    ])
  })

  it('clamps an event that ends after day end', () => {
    const events: CalEvent[] = [
      { start: '21:00', end: '23:30', title: 'Night owl', type: 'deep' },
    ]
    expect(freeGaps(events)).toEqual([
      { start: '08:00', end: '21:00', minutes: 780 },
    ])
  })

  it('drops an event entirely outside the day → full-day gap', () => {
    const events: CalEvent[] = [
      { start: '23:00', end: '23:45', title: 'Way late', type: 'other' },
    ]
    expect(freeGaps(events)).toEqual([
      { start: '08:00', end: '22:00', minutes: 840 },
    ])
  })

  it('invalid day bounds (start >= end) → empty gap list', () => {
    expect(freeGaps([], '22:00', '08:00')).toEqual([])
  })
})
