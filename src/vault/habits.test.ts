/**
 * habits unit tests (S30).
 *
 * Proves the Habits vault contract:
 *   - parse∘serialize round-trip identity for hits (DoD 1)
 *   - malformed / unknown lines tolerated, never thrown (DoD 2)
 *   - weekGrid alignment + streak boundaries: today vs yesterday-only (DoD 3)
 *   - committed fixtures parse; invalid domain → habit kept, domain undefined (DoD 4)
 *
 * Fixtures are the COMMITTED contract artifacts read straight off disk, so
 * the test doubles as a guard that the checked-in vault files still parse.
 */

import { describe, it, expect } from 'vitest'
import {
  parseHabits,
  parseHabitLog,
  serializeHabitHit,
  weekGrid,
  streak,
  type HabitHit,
} from './habits'
// Committed fixtures are the contract artifacts — loaded as raw text via Vite's
// `?raw` loader so the test guards the checked-in vault files themselves.
import HABITS_MD from './__fixtures__/habits.md?raw'
import LOG_MD from './__fixtures__/habits-log.md?raw'

/** Reference "today" the committed log fixture is designed around. */
const TODAY = '2026-07-15'

// ─── DoD 1 — round-trip identity ─────────────────────────────────────────────

describe('serializeHabitHit ∘ parseHabitLog — exact round trip (DoD 1)', () => {
  const cases: HabitHit[] = [
    { habit: 'Course study block', date: '2026-07-14', source: 'pwa' },
    { habit: 'Gym session', date: '2026-07-13', source: 'telegram' },
    { habit: 'Call a friend', date: '2026-01-01', source: 'import' },
    { habit: 'Habit with 123 & symbols!', date: '2026-12-31', source: 'cli' },
  ]

  for (const h of cases) {
    it(`round-trips ${h.habit}`, () => {
      const line = serializeHabitHit(h)
      const parsed = parseHabitLog(line)
      expect(parsed).toHaveLength(1)
      expect(parsed[0]).toEqual(h)
    })
  }

  it('a whole serialized block round-trips in order', () => {
    const md = cases.map(serializeHabitHit).join('\n')
    expect(parseHabitLog(md)).toEqual(cases)
  })
})

// ─── DoD 2 — malformed / unknown tolerated ───────────────────────────────────

describe('parsers tolerate malformed & unknown lines (DoD 2)', () => {
  it('parseHabitLog never throws on garbage input', () => {
    const junk = [
      '',
      '   ',
      '# a heading',
      'plain prose line',
      '- [ ] unchecked is not a hit (date:: 2026-07-15) (source:: pwa)',
      '- [x] (date:: 2026-07-15) (source:: pwa)', // no name
      '- [x] Ghost missing date (source:: pwa)', // no date
      '* [x] Wrong bullet (date:: 2026-07-15)',
      '- [x] Weird ((( parens',
    ].join('\n')
    expect(() => parseHabitLog(junk)).not.toThrow()
    expect(parseHabitLog(junk)).toEqual([])
  })

  it('parseHabits never throws and skips non-definition lines', () => {
    const junk = ['', '# heading', 'prose', '- '].join('\n')
    expect(() => parseHabits(junk)).not.toThrow()
    expect(parseHabits(junk)).toEqual([])
  })

  it('unknown inline fields on a hit are ignored, hit still parsed', () => {
    const hits = parseHabitLog('- [x] Budget review (date:: 2026-07-15) (source:: pwa) (mood:: focused)')
    expect(hits).toEqual([{ habit: 'Budget review', date: '2026-07-15', source: 'pwa' }])
  })

  it('the committed log fixture parses only its real hits (junk tail skipped)', () => {
    const hits = parseHabitLog(LOG_MD)
    // 3 course + 1 morning + 1 gym + 3 friend + 1 budget = 9 real hits
    expect(hits).toHaveLength(9)
    expect(hits.every((h) => h.habit && h.date)).toBe(true)
  })
})

// ─── DoD 3 — weekGrid alignment + streak boundaries ──────────────────────────

describe('weekGrid — 7 slots aligned to today (DoD 3)', () => {
  const hits = parseHabitLog(LOG_MD)

  it('always returns exactly 7 booleans', () => {
    const g = weekGrid(hits, 'Course study block', TODAY)
    expect(g).toHaveLength(7)
    expect(g.every((b) => typeof b === 'boolean')).toBe(true)
  })

  it('index 6 is today, index 0 is 6 days ago', () => {
    // Course study block hit 07-13, 07-14, 07-15 (today) → last three true.
    expect(weekGrid(hits, 'Course study block', TODAY)).toEqual([
      false, false, false, false, true, true, true,
    ])
  })

  it('scattered hits land in the right slots', () => {
    // Call a friend hit 07-09, 07-12, 07-15 within the 07-09..07-15 window.
    expect(weekGrid(hits, 'Call a friend', TODAY)).toEqual([
      true, false, false, true, false, false, true,
    ])
  })

  it('a habit with no hits is all false', () => {
    expect(weekGrid(hits, 'Nonexistent', TODAY)).toEqual([
      false, false, false, false, false, false, false,
    ])
  })

  it('an invalid today string yields 7 false slots, no throw', () => {
    expect(weekGrid(hits, 'Course study block', 'not-a-date')).toEqual([
      false, false, false, false, false, false, false,
    ])
  })
})

describe('streak — consecutive days + broken flag (DoD 3)', () => {
  const hits = parseHabitLog(LOG_MD)

  it('hit TODAY plus prior days → alive, counts the full run', () => {
    // Course study block: 07-15, 07-14, 07-13.
    expect(streak(hits, 'Course study block', TODAY)).toEqual({ n: 3, broken: false })
  })

  it('hit YESTERDAY only (no today) → still alive (grace window)', () => {
    // Morning pages: 07-14 only, today is 07-15.
    expect(streak(hits, 'Morning pages', TODAY)).toEqual({ n: 1, broken: false })
  })

  it('last hit two days ago → broken, reports last run length', () => {
    // Gym session: 07-13 only, today is 07-15.
    expect(streak(hits, 'Gym session', TODAY)).toEqual({ n: 1, broken: true })
  })

  it('never hit → n 0, broken', () => {
    expect(streak(hits, 'Nonexistent', TODAY)).toEqual({ n: 0, broken: true })
  })

  it('boundary: same fixture is alive today but broken two days later', () => {
    // Course study block last hit is 07-15; as of 07-17 it is broken.
    expect(streak(hits, 'Course study block', '2026-07-17')).toEqual({ n: 3, broken: true })
    // ...and still alive when evaluated the day after its last hit.
    expect(streak(hits, 'Course study block', '2026-07-16')).toEqual({ n: 3, broken: false })
  })
})

// ─── DoD 4 — fixtures parse; domain constrained to the 7 canonical ───────────

describe('parseHabits — committed fixture + domain constraint (DoD 4)', () => {
  const habits = parseHabits(HABITS_MD)

  it('parses every definition line in the fixture', () => {
    const names = habits.map((h) => h.name)
    expect(names).toContain('Course study block')
    expect(names).toContain('Gym session')
    expect(names).toContain('Bare habit')
  })

  it('a valid domain is captured', () => {
    const course = habits.find((h) => h.name === 'Course study block')!
    expect(course.domain).toBe('Growth')
    expect(course.min).toBe('45m')
  })

  it('an INVALID domain leaves domain undefined but keeps the habit (DoD 4)', () => {
    const bad = habits.find((h) => h.name === 'Bad domain habit')
    expect(bad).toBeDefined()
    expect(bad!.domain).toBeUndefined()
  })

  it('a domain-less definition has no domain and no min', () => {
    const bare = habits.find((h) => h.name === 'Bare habit')!
    expect(bare.domain).toBeUndefined()
    expect(bare.min).toBeUndefined()
  })

  it('every captured domain is one of the 7 canonical domains', () => {
    const CANON = [
      'Building Things', 'Career', 'Growth', 'Life Admin',
      'Body & Mind', 'Finance', 'Relationship',
    ]
    for (const h of habits) {
      if (h.domain !== undefined) expect(CANON).toContain(h.domain)
    }
  })
})
