/**
 * TodayCard fixture + gap-hint + staleness tests (S34).
 *
 * Renders straight off the COMMITTED S33 fixture (src/vault/__fixtures__/
 * calendar-today.md) via the real parseCalendar/freeGaps, so this test
 * doubles as a guard on the checked-in vault file (same convention as
 * HabitsCard.test.tsx / calendar.test.ts). `events`/`date` props
 * short-circuit TodayCard's own vault fetch — GitTransport is never
 * constructed for these tests.
 *
 * Covers the numbered DoD:
 *  1. Fixture renders: every event a tinted chip (correct §4.5 tint per
 *     type), times tabular, no accent bars.
 *  2. Every gap from freeGaps renders a hint row; when a task fits, the
 *     hint names it; no blank gaps.
 *  3. Stale file date → visible staleness note.
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { TodayCard } from './TodayCard'
import { parseCalendar, freeGaps } from '../../vault/calendar'
import type { Task } from '../../types'
import CALENDAR_MD from '../../vault/__fixtures__/calendar-today.md?raw'

/** Fixture's own file date (calendar.test.ts's committed expectation). */
const FIXTURE_DATE = '2026-07-14'

const { date: fixtureDate, events: fixtureEvents } = parseCalendar(CALENDAR_MD)
const fixtureGaps = freeGaps(fixtureEvents)

function task(over: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: over.id,
    done: false,
    created_at: 0,
    ...over,
  }
}

describe('TodayCard — fixture render (DoD 1)', () => {
  it('parses the committed fixture to the expected date', () => {
    expect(fixtureDate).toBe(FIXTURE_DATE)
  })

  it('renders one slot row per parsed event', () => {
    render(<TodayCard tasks={[]} events={fixtureEvents} date={fixtureDate} today={FIXTURE_DATE} />)
    expect(screen.getAllByTestId('today-slot')).toHaveLength(fixtureEvents.length)
  })

  it('each slot shows the event title and a tabular-nums start time', () => {
    render(<TodayCard tasks={[]} events={fixtureEvents} date={fixtureDate} today={FIXTURE_DATE} />)
    const slots = screen.getAllByTestId('today-slot')
    for (const [i, event] of fixtureEvents.entries()) {
      expect(slots[i]).toHaveTextContent(event.title)
      expect(slots[i]).toHaveTextContent(event.start)
      const time = slots[i]!.querySelector('time')!
      expect(time.className).toContain('tabular-nums')
    }
  })

  it('the time column is the documented 52px width', () => {
    render(<TodayCard tasks={[]} events={fixtureEvents} date={fixtureDate} today={FIXTURE_DATE} />)
    const time = screen.getAllByTestId('today-slot')[0]!.querySelector('time')!
    expect(time.className).toContain('w-[52px]')
  })

  it('each event type gets the correct §4.5 chip tint', () => {
    render(<TodayCard tasks={[]} events={fixtureEvents} date={fixtureDate} today={FIXTURE_DATE} />)
    const slots = screen.getAllByTestId('today-slot')
    const byType = (t: string) => slots.find((s) => s.getAttribute('data-type') === t)!

    // gym — rgba(45,212,191,.12) / #99f6e4
    const gymChip = byType('gym').querySelector('div')!
    expect(gymChip.className).toContain('rgba(45,212,191,.12)')
    expect(gymChip.className).toContain('#99f6e4')

    // call — rgba(56,189,248,.13) / #bae6fd
    const callChip = byType('call').querySelector('div')!
    expect(callChip.className).toContain('rgba(56,189,248,.13)')
    expect(callChip.className).toContain('#bae6fd')

    // deep — rgba(245,158,11,.11) / #fde68a
    const deepChip = byType('deep').querySelector('div')!
    expect(deepChip.className).toContain('rgba(245,158,11,.11)')
    expect(deepChip.className).toContain('#fde68a')

    // other (unknown "errand" type in the fixture) — neutral, no accent color
    const otherChip = byType('other').querySelector('div')!
    expect(otherChip.className).toContain('rgba(255,255,255,.06)')
  })

  it('chips carry no accent bar (no --dc custom property, no before:-bg pseudo-element)', () => {
    render(<TodayCard tasks={[]} events={fixtureEvents} date={fixtureDate} today={FIXTURE_DATE} />)
    const slots = screen.getAllByTestId('today-slot')
    for (const slot of slots) {
      const chip = slot.querySelector('div')!
      expect(chip.style.getPropertyValue('--dc')).toBe('')
      expect(chip.className).not.toContain('before:')
      expect(slot.className).not.toContain('before:')
    }
  })

  it('a hairline divider separates slots, omitted on the very last timeline row', () => {
    render(<TodayCard tasks={[]} events={fixtureEvents} date={fixtureDate} today={FIXTURE_DATE} />)
    const slots = screen.getAllByTestId('today-slot')
    // First 3 events are each followed by another event or a gap — not last overall.
    expect(slots[0]!.className).toContain('border-b')
    expect(slots[1]!.className).toContain('border-b')
  })
})

describe('TodayCard — gap hints (DoD 2)', () => {
  it('renders exactly one hint row per freeGaps gap', () => {
    render(<TodayCard tasks={[]} events={fixtureEvents} date={fixtureDate} today={FIXTURE_DATE} />)
    expect(screen.getAllByTestId('today-gap')).toHaveLength(fixtureGaps.length)
  })

  it('names a fitting task when one is available (no blank gaps)', () => {
    const tasks = [task({ id: 'quiz', title: 'Module 4 quiz', priority: 3 })]
    render(<TodayCard tasks={tasks} events={fixtureEvents} date={fixtureDate} today={FIXTURE_DATE} />)
    const gapRows = screen.getAllByTestId('today-gap')
    // Every gap row has non-empty, non-whitespace text — never blank (§8).
    for (const row of gapRows) {
      expect(row.textContent!.trim().length).toBeGreaterThan(0)
    }
    // At least one gap names the quiz task by title.
    expect(gapRows.some((r) => r.textContent!.includes('Module 4 quiz'))).toBe(true)
    expect(gapRows.some((r) => r.getAttribute('data-fits') === 'true')).toBe(true)
  })

  it('renders an honest "nothing fits" note when there are no open tasks — never blank', () => {
    render(<TodayCard tasks={[]} events={fixtureEvents} date={fixtureDate} today={FIXTURE_DATE} />)
    const gapRows = screen.getAllByTestId('today-gap')
    for (const row of gapRows) {
      expect(row.textContent!.trim().length).toBeGreaterThan(0)
      expect(row.getAttribute('data-fits')).toBe('false')
    }
  })

  it('gap hint rows are italic, 12px, --faint, and indented 64px per §4.5', () => {
    render(<TodayCard tasks={[]} events={fixtureEvents} date={fixtureDate} today={FIXTURE_DATE} />)
    const row = screen.getAllByTestId('today-gap')[0]!
    expect(row.className).toContain('italic')
    expect(row.className).toContain('text-[12px]')
    expect(row.className).toContain('text-faint')
    expect(row.className).toContain('pl-16') // 4rem === 64px
  })

  it('the gap row names the task and includes its estimated minutes', () => {
    const tasks = [task({ id: 'quiz', title: 'Module 4 quiz', priority: 3 })]
    render(<TodayCard tasks={tasks} events={fixtureEvents} date={fixtureDate} today={FIXTURE_DATE} />)
    const gapRows = screen.getAllByTestId('today-gap')
    const named = gapRows.find((r) => r.textContent!.includes('Module 4 quiz'))!
    expect(named.textContent).toMatch(/fits Module 4 quiz \(~\d+ min\)/)
  })
})

describe('TodayCard — staleness (DoD 3)', () => {
  it('shows no staleness note when the file date matches today', () => {
    render(<TodayCard tasks={[]} events={fixtureEvents} date={fixtureDate} today={FIXTURE_DATE} />)
    expect(screen.queryByTestId('today-stale-banner')).not.toBeInTheDocument()
  })

  it('shows a dim "yesterday\'s plan" note when the file date is not today', () => {
    render(<TodayCard tasks={[]} events={fixtureEvents} date={fixtureDate} today="2026-07-15" />)
    const banner = screen.getByTestId('today-stale-banner')
    expect(banner).toBeInTheDocument()
    expect(banner.className).toContain('text-dim')
    expect(banner.textContent).toMatch(/yesterday/i)
  })

  it('shows no staleness note when the parsed date is undefined (no file / no date header)', () => {
    render(<TodayCard tasks={[]} events={[]} date={undefined} today="2026-07-15" />)
    expect(screen.queryByTestId('today-stale-banner')).not.toBeInTheDocument()
  })
})

describe('TodayCard — no data (honest empty state)', () => {
  it('renders an empty-state message when there is no calendar file at all', () => {
    render(<TodayCard tasks={[]} events={[]} date={undefined} today={FIXTURE_DATE} />)
    expect(screen.getByText('No calendar data yet.')).toBeInTheDocument()
    expect(screen.queryByTestId('today-slot')).not.toBeInTheDocument()
  })

  it('a genuinely empty day (date present, zero events) still renders the full-day gap hint', () => {
    render(<TodayCard tasks={[]} events={[]} date="2026-07-14" today="2026-07-14" />)
    expect(screen.queryByText('No calendar data yet.')).not.toBeInTheDocument()
    const gapRows = screen.getAllByTestId('today-gap')
    expect(gapRows).toHaveLength(1)
    expect(gapRows[0]!.textContent!.trim().length).toBeGreaterThan(0)
  })
})

describe('TodayCard — heading', () => {
  it('renders the "Today" card heading', () => {
    render(<TodayCard tasks={[]} events={fixtureEvents} date={fixtureDate} today={FIXTURE_DATE} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })
})
