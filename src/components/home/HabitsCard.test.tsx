/**
 * HabitsCard fixture + tap-today tests (S32).
 *
 * Renders straight off the COMMITTED S30 fixtures (src/vault/__fixtures__/
 * habits.md, habits-log.md) via the real parseHabits/parseHabitLog, so this
 * test doubles as a guard on the checked-in vault files (same convention as
 * habits.test.ts). `habits`/`hits` props short-circuit HabitsCard's own
 * vault fetch — GitTransport is never constructed for the render tests; only
 * the tap tests inject a fake transport, whose `writeFile` payload is
 * asserted directly (no real fs/git touched anywhere in this file).
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { HabitsCard } from './HabitsCard'
import { parseHabits, parseHabitLog, serializeHabitHit } from '../../vault/habits'
import type { VaultTransport } from '../../vault/transport'
import HABITS_MD from '../../vault/__fixtures__/habits.md?raw'
import LOG_MD from '../../vault/__fixtures__/habits-log.md?raw'

/** Reference "today" the committed log fixture is designed around (habits.test.ts). */
const TODAY = '2026-07-15'

const habits = parseHabits(HABITS_MD)
const hits = parseHabitLog(LOG_MD)

/** Minimal in-memory VaultTransport double — records every write for assertion. */
class FakeTransport implements VaultTransport {
  written: { path: string; content: string; message: string }[] = []
  constructor(private files: { path: string; content: string }[] = []) {}
  async readFiles() {
    return this.files
  }
  async writeFile(path: string, content: string, message: string) {
    this.written.push({ path, content, message })
    const idx = this.files.findIndex((f) => f.path === path)
    if (idx >= 0) this.files[idx] = { path, content }
    else this.files.push({ path, content })
  }
}

/** Find a habit row by its `data-habit` attribute. */
function getRow(name: string): HTMLElement {
  const rows = screen.getAllByTestId('habit-row')
  const row = rows.find((r) => r.getAttribute('data-habit') === name)
  if (!row) throw new Error(`no habit row for "${name}"`)
  return row
}

describe('HabitsCard — fixture render (DoD 1)', () => {
  it('renders one row per committed habit definition', () => {
    render(<HabitsCard habits={habits} hits={hits} today={TODAY} />)
    expect(screen.getAllByTestId('habit-row')).toHaveLength(habits.length)
  })

  it("Course study block's week grid matches the log (last 3 days hit)", () => {
    render(<HabitsCard habits={habits} hits={hits} today={TODAY} />)
    const squares = within(getRow('Course study block')).getAllByTestId(/habit-(square|today-square)/)
    expect(squares).toHaveLength(7)
    const hitFlags = squares.map((s) => s.getAttribute('data-hit') === 'true')
    expect(hitFlags).toEqual([false, false, false, false, true, true, true])
  })

  it("Call a friend's scattered week grid matches the log", () => {
    render(<HabitsCard habits={habits} hits={hits} today={TODAY} />)
    const squares = within(getRow('Call a friend')).getAllByTestId(/habit-(square|today-square)/)
    const hitFlags = squares.map((s) => s.getAttribute('data-hit') === 'true')
    expect(hitFlags).toEqual([true, false, false, true, false, false, true])
  })

  it('hot streak state is covered — Course study block shows 🔥 3d', () => {
    render(<HabitsCard habits={habits} hits={hits} today={TODAY} />)
    const streakEl = within(getRow('Course study block')).getByTestId('habit-streak')
    expect(streakEl).toHaveTextContent('🔥 3d')
    expect(streakEl).toHaveAttribute('data-streak', 'hot')
  })

  it('broken streak state is covered — Gym session shows ✕ 1d', () => {
    render(<HabitsCard habits={habits} hits={hits} today={TODAY} />)
    const streakEl = within(getRow('Gym session')).getByTestId('habit-streak')
    expect(streakEl).toHaveTextContent('✕ 1d')
    expect(streakEl).toHaveAttribute('data-streak', 'broken')
  })

  it('fraction streak state is covered — Call a friend shows 3/7 (matches §4.6\'s own example)', () => {
    render(<HabitsCard habits={habits} hits={hits} today={TODAY} />)
    const streakEl = within(getRow('Call a friend')).getByTestId('habit-streak')
    expect(streakEl).toHaveTextContent('3/7')
    expect(streakEl).toHaveAttribute('data-streak', 'fraction')
  })
})

describe('HabitsCard — domain token color (DoD 3)', () => {
  it('hit squares use the habit\'s domain token (--hc), e.g. var(--d-growth) for Growth', () => {
    render(<HabitsCard habits={habits} hits={hits} today={TODAY} />)
    const row = getRow('Course study block')
    // Read the custom property directly off the DOM style object rather than
    // via jest-dom's toHaveStyle — this codebase has no precedent for that
    // matcher handling CSS custom properties, so assert the primitive instead.
    expect(row.style.getPropertyValue('--hc')).toBe('var(--d-growth)')
    const squares = within(row).getAllByTestId('habit-square')
    // Index 3 (0-based) is the hit two days before today (07-13) — a plain <i> square.
    const hitSquare = squares.find((s) => s.getAttribute('data-hit') === 'true')!
    expect(hitSquare.style.backgroundColor).toBe('var(--hc)')
  })
})

describe('HabitsCard — tap today (DoD 2)', () => {
  it('tapping an unhit today square appends exactly one S30-serialized line with source:: pwa, and flips the square', async () => {
    const transport = new FakeTransport()
    // Gym session's today (07-15) is NOT hit in the fixture log (last hit 07-13).
    render(<HabitsCard habits={habits} hits={hits} today={TODAY} transport={transport} />)

    const row = getRow('Gym session')
    const todaySquare = within(row).getByTestId('habit-today-square')
    expect(todaySquare).not.toBeDisabled()

    fireEvent.click(todaySquare)

    await waitFor(() => expect(transport.written).toHaveLength(1))
    expect(transport.written[0]!.path).toBe('Habits/log.md')
    expect(transport.written[0]!.content.trim().split('\n').at(-1)).toBe(
      serializeHabitHit({ habit: 'Gym session', date: TODAY, source: 'pwa' }),
    )
    expect(transport.written[0]!.content).toContain('(source:: pwa)')

    // Optimistic flip — the square is now disabled/hit without waiting on the write.
    await waitFor(() => expect(todaySquare).toBeDisabled())
  })

  it('a second tap on an already-hit today square is a no-op (exactly one write total)', async () => {
    const transport = new FakeTransport()
    render(<HabitsCard habits={habits} hits={hits} today={TODAY} transport={transport} />)

    const row = getRow('Gym session')
    const todaySquare = within(row).getByTestId('habit-today-square')

    fireEvent.click(todaySquare)
    await waitFor(() => expect(transport.written).toHaveLength(1))

    fireEvent.click(todaySquare)
    fireEvent.click(todaySquare)

    // Give any stray async work a tick, then assert the count never grew.
    await new Promise((r) => setTimeout(r, 10))
    expect(transport.written).toHaveLength(1)
  })

  it('tapping an already-hit today square (from the fixture) never calls the transport', async () => {
    const transport = new FakeTransport()
    // Course study block is already hit today (07-15) in the fixture.
    render(<HabitsCard habits={habits} hits={hits} today={TODAY} transport={transport} />)

    const row = getRow('Course study block')
    const todaySquare = within(row).getByTestId('habit-today-square')
    expect(todaySquare).toBeDisabled()

    fireEvent.click(todaySquare)
    await new Promise((r) => setTimeout(r, 10))
    expect(transport.written).toHaveLength(0)
  })
})

describe('HabitsCard — no data (honest empty state)', () => {
  it('renders an empty-state message when there are no habits', () => {
    render(<HabitsCard habits={[]} hits={[]} today={TODAY} />)
    expect(screen.getByText('No habits tracked yet.')).toBeInTheDocument()
    expect(screen.queryByTestId('habit-row')).not.toBeInTheDocument()
  })
})
