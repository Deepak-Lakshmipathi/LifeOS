/**
 * S29 — HomeView Day Review visibility fixture.
 *
 * Covers the numbered DoD:
 *  1. Card renders ONLY in pm mode (am/mid hidden, pm shown, using override).
 *  3. Card is first child on Home in pm.
 */
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { HomeView } from './HomeView'
import type { Task } from '../../types'

function noopAsync() {
  return vi.fn().mockResolvedValue(undefined)
}

const baseProps = {
  tasks: [] as Task[],
  onToggle: noopAsync(),
  onAdd: noopAsync(),
}

describe('HomeView — Day Review visibility (§6)', () => {
  it('hides Day Review in am mode', () => {
    render(<HomeView {...baseProps} modeOverride="am" />)
    expect(screen.queryByText('Day Review')).not.toBeInTheDocument()
  })

  it('hides Day Review in mid mode', () => {
    render(<HomeView {...baseProps} modeOverride="mid" />)
    expect(screen.queryByText('Day Review')).not.toBeInTheDocument()
  })

  it('shows Day Review in pm mode', () => {
    render(<HomeView {...baseProps} modeOverride="pm" />)
    expect(screen.getByText('Day Review')).toBeInTheDocument()
  })

  it('Day Review is the first child on Home in pm mode', () => {
    const { container } = render(<HomeView {...baseProps} modeOverride="pm" />)
    const root = container.firstElementChild as HTMLElement
    const firstChild = root.firstElementChild as HTMLElement
    expect(firstChild.textContent).toContain('Day Review')
  })
})

describe('HomeView — right stack mounts HabitsCard (S32)', () => {
  it('renders the Habits card', () => {
    render(<HomeView {...baseProps} modeOverride="am" />)
    expect(screen.getByTestId('habits-card')).toBeInTheDocument()
  })

  it('does not break existing HomeView mount points (add-task button, mission card)', () => {
    render(<HomeView {...baseProps} modeOverride="am" />)
    expect(screen.getByLabelText('Add task')).toBeInTheDocument()
    expect(screen.getByText("Today's Mission")).toBeInTheDocument()
  })
})

// ─── S58 — Home slims down to the check-in surface only ────────────────────

// Domain-less (inbox) tasks so rankNow admits all of them uncapped and never
// triggers a rescue pick (no domain-tagged task exists to serve as one) —
// deterministic ranking: priority desc, then created_at asc. 4 tasks clears
// NowView's LIVE_COUNT (3), so if NowView were still mounted here it would
// render an "Up next (1)" fold — this fixture makes that observable, unlike
// an empty task list (which can never produce a fold whether or not NowView
// is present, so the assertion below couldn't fail).
const UP_NEXT_FIXTURE: Task[] = [
  { id: 'un-1', title: 'Up-next fixture 1', done: false, created_at: 1000, priority: 3 },
  { id: 'un-2', title: 'Up-next fixture 2', done: false, created_at: 2000, priority: 2 },
  { id: 'un-3', title: 'Up-next fixture 3', done: false, created_at: 3000, priority: 1 },
  { id: 'un-4', title: 'Up-next fixture 4', done: false, created_at: 4000 },
]

describe('HomeView — slims to the check-in surface, no Up next/Later (S58)', () => {
  it('renders Mission, Needs You, Today, Habits and the Fleet strip', () => {
    render(<HomeView {...baseProps} modeOverride="am" />)
    expect(screen.getByText("Today's Mission")).toBeInTheDocument()
    expect(screen.getByTestId('attention-card')).toBeInTheDocument()
    expect(screen.getByTestId('today-card')).toBeInTheDocument()
    expect(screen.getByTestId('habits-card')).toBeInTheDocument()
    expect(screen.getByTestId('fleet-strip')).toBeInTheDocument()
  })

  it('does not render the Up next / Later folds (moved to the Tasks tab)', () => {
    render(<HomeView {...baseProps} tasks={UP_NEXT_FIXTURE} modeOverride="am" />)
    // Sanity: the fixture actually reached MissionCard (proves this isn't
    // checking an empty, never-can-fold task list).
    expect(screen.getByText('Up-next fixture 1')).toBeInTheDocument()
    expect(screen.queryByText(/Up next/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Later/)).not.toBeInTheDocument()
  })
})

// ─── S50 — daily-brief morning-only surface ─────────────────────────────────

const FIVE_BRIEF_LINES = [
  'Win: ship the S50 daily brief agent.',
  '10:00 Client call — NorthStar handoff.',
  'Meera (NorthStar) is waiting 26h on a quote.',
  'Course study block is on a 6-day streak — keep it alive.',
  'Net worth is ₹18.4L, up 2.1% this month.',
]

describe('HomeView — daily-brief morning-only surface (S50)', () => {
  it('shows the brief block in am mode when brief lines are present', () => {
    render(<HomeView {...baseProps} modeOverride="am" briefLines={FIVE_BRIEF_LINES} />)
    const block = screen.getByTestId('home-brief')
    expect(block).toBeInTheDocument()
    for (const line of FIVE_BRIEF_LINES) {
      expect(screen.getByText(line)).toBeInTheDocument()
    }
  })

  it('hides the brief block in mid mode even when brief lines are present (am ONLY)', () => {
    render(<HomeView {...baseProps} modeOverride="mid" briefLines={FIVE_BRIEF_LINES} />)
    expect(screen.queryByTestId('home-brief')).not.toBeInTheDocument()
  })

  it('hides the brief block in pm mode even when brief lines are present (am ONLY)', () => {
    render(<HomeView {...baseProps} modeOverride="pm" briefLines={FIVE_BRIEF_LINES} />)
    expect(screen.queryByTestId('home-brief')).not.toBeInTheDocument()
  })

  it('renders nothing (no error UI) in am mode when the brief is missing ([])', () => {
    render(<HomeView {...baseProps} modeOverride="am" briefLines={[]} />)
    expect(screen.queryByTestId('home-brief')).not.toBeInTheDocument()
  })

  it('the brief block is the first child on Home in am mode', () => {
    const { container } = render(
      <HomeView {...baseProps} modeOverride="am" briefLines={FIVE_BRIEF_LINES} />,
    )
    const root = container.firstElementChild as HTMLElement
    const firstChild = root.firstElementChild as HTMLElement
    expect(firstChild.getAttribute('data-testid')).toBe('home-brief')
  })

  it('does not break existing mount points when the brief is present', () => {
    render(<HomeView {...baseProps} modeOverride="am" briefLines={FIVE_BRIEF_LINES} />)
    expect(screen.getByLabelText('Add task')).toBeInTheDocument()
    expect(screen.getByTestId('habits-card')).toBeInTheDocument()
  })
})

describe('HomeView — real self-load, no vault configured (S62/#155 DoD 3)', () => {
  it('mounted with no `briefLines`/`briefTransport` (the live-app shape), the real GitTransport self-load renders no brief block and no error UI', async () => {
    // No `briefLines` fixture (genuinely omitted, not `[]`) and no
    // `briefTransport` override — exercises the ACTUAL self-load effect
    // against a real (unconfigured) GitTransport, same as the live app's
    // mount. This also mounts AttentionCard/TodayCard/HabitsCard/FleetStrip
    // with no fixture props at all (HomeView never injects data props into
    // them — see its own render body), so this one render exercises EVERY
    // self-loading card's real, unconfigured self-load in the same pass.
    render(<HomeView {...baseProps} modeOverride="am" />)
    // Something from below the brief block must have painted before we can
    // trust the brief's absence isn't just "hasn't loaded yet" — Habits'
    // honest-empty text only appears once its own self-load effect settles.
    expect(await screen.findByText('No habits tracked yet.')).toBeInTheDocument()
    expect(screen.queryByTestId('home-brief')).not.toBeInTheDocument()
  })
})
