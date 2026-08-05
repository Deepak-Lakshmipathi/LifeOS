/**
 * #186 — the task list has ONE owner.
 *
 * `VitalsRow` (Completion tile) and `Aurora` (warmth tint) used to self-load
 * through `src/sync/selfLoadTasks.ts`, a module-level memoized promise with no
 * production invalidation path. A write through `useTasks` updated the hook's
 * copy and left that memo frozen at its first resolution for the life of the
 * page, so Completion and the tint only ever changed on a full reload.
 *
 * Both now take the list as a required prop from `useTasks` in `App.tsx`, so
 * this asserts through the real App: complete a task via the mission dot, and
 * the Completion tile's counts move in the same mount cycle. Reverting
 * VitalsRow's prop wiring turns this red.
 *
 * Aurora's tint is NOT asserted here — `computeWarmth` is domain-based and
 * these fixture tasks are domain-less, so its opacity would not move. It is
 * covered structurally instead: Aurora takes the same required prop from the
 * same owner, so the tint cannot go stale unless this assertion also fails.
 *
 * Asserts on the tile's `sub` line ("N done · M to do") rather than the
 * percent, because the percent is rendered through `Vital`'s 900ms count-up.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '../db/LifeOSDb'
import App from '../App'
import type { Task } from '../types'

// Three open, domain-less tasks: rankNow admits all of them with no rescue
// pick, so mission slot 1 is deterministically `live-1` (priority desc).
const TASKS: Task[] = [
  { id: 'live-1', title: 'Live task 1', done: false, created_at: 1000, priority: 3 },
  { id: 'live-2', title: 'Live task 2', done: false, created_at: 2000, priority: 2 },
  { id: 'live-3', title: 'Live task 3', done: false, created_at: 3000, priority: 1 },
]

beforeEach(async () => {
  // jsdom has no matchMedia; framer-motion + the reduced-motion guards read it.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia

  // `?noseed` (ADR-0006): keep the real 107-row importer out of this fixture,
  // same reason cockpitShell.test.tsx does it — a mid-flight seed would pad
  // the counts this test asserts on.
  window.history.pushState({}, '', '/?noseed')

  await db.tasks.clear()
  await db.tasks.bulkAdd(TASKS)
})

afterEach(() => {
  window.history.pushState({}, '', '/')
})

describe('#186 — Completion tile tracks writes without a reload', () => {
  it('updates the counts when a task is completed via the mission dot', async () => {
    render(<App />)

    // Wait for the real (fixture) load to reach the tile, not just for App to
    // mount — before the list resolves every count is trivially 0.
    expect(await screen.findByText('0 done · 3 to do')).toBeInTheDocument()

    const dot = (await screen.findAllByRole('button', { name: 'Mark complete' }))[0]
    fireEvent.click(dot)

    // The frozen-memo bug: this stayed at "0 done · 3 to do" forever.
    await waitFor(() => expect(screen.getByText('1 done · 2 to do')).toBeInTheDocument())
  })
})
