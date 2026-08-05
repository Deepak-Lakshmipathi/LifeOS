/**
 * S24 — Cockpit shell IA. Verifies the tabs render in §5 order, that the
 * default Home section keeps the v1 capture affordance (no functionality lost),
 * and that switching tabs shows exactly one section at a time (§2.3 fade).
 *
 * S58 folded Domains/Pulse into the new Tasks tab (five tabs, not six) and
 * moved NowView's Up next/Later folds off Home into that same Tasks tab.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { db } from '../db/LifeOSDb'
import App from '../App'
import { HomeView } from '../components/home/HomeView'
import { TasksView } from '../components/tasks/TasksView'
import type { Task } from '../types'

beforeEach(() => {
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

  // `?noseed` (App.tsx / seedIfEmpty's own documented test hook, ADR-0006):
  // none of this file's tests assert on the REAL 107-row seed_tasks_detailed
  // content, so skip that importer everywhere in this file. Without this, the
  // first App render in the S24 block below triggers it for real (107
  // sequential `provider.add()` awaits) as a bare promise chain that isn't
  // cancelled on unmount — it can still be mid-flight, writing rows, when a
  // later S58 test's fixture-seeded `beforeEach` runs, silently padding that
  // test's task count out from under it.
  window.history.pushState({}, '', '/?noseed')
})

afterEach(() => {
  window.history.pushState({}, '', '/')
})

// Domain-less (inbox) fixture tasks: rankNow admits all of them uncapped and
// never injects a rescue pick (no domain-tagged open task exists to serve as
// one), so ordering is fully deterministic — priority desc, then created_at
// asc. 6 tasks means: ranks 1-3 sit in NowView's LIVE section (hideLive off,
// so directly visible — no fold click needed), ranks 4-6 sit in the "Up next"
// fold. MissionCard's top-3 picks are the exact same ranks 1-3 (missionPicks
// is built directly on rankNow with no rescue in play here), so this fixture
// exercises the identical composition App wires up in production.
const FIXTURE_TASKS: Task[] = [
  { id: 'fx-1', title: 'Fixture task 1', done: false, created_at: 1000, priority: 3 },
  { id: 'fx-2', title: 'Fixture task 2', done: false, created_at: 2000, priority: 3 },
  { id: 'fx-3', title: 'Fixture task 3', done: false, created_at: 3000, priority: 2 },
  { id: 'fx-4', title: 'Fixture task 4', done: false, created_at: 4000, priority: 1 },
  { id: 'fx-5', title: 'Fixture task 5', done: false, created_at: 5000 },
  { id: 'fx-6', title: 'Fixture task 6', done: false, created_at: 6000 },
]

describe('S24 cockpit shell', () => {
  it('renders the five tabs in IA order (Home·Tasks·Money·Career·Agents)', () => {
    render(<App />)
    const bar = screen.getByTestId('tab-bar')
    const labels = within(bar)
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(labels).toEqual(['Home', 'Tasks', 'Money', 'Career', 'Agents'])
  })

  it('defaults to Home, with the v1 capture flow still reachable on the Tasks tab', async () => {
    render(<App />)
    // Home is the default section. #183 moved capture off it, so Home's
    // marker is MissionCard and the capture affordance is asserted where it
    // now lives — the point of the original test (no functionality lost in
    // the shell restructure) is preserved, just relocated.
    expect(await screen.findByText("Today's Mission")).toBeInTheDocument()
    expect(screen.queryByText('+ New task')).not.toBeInTheDocument()

    fireEvent.click(within(screen.getByTestId('tab-bar')).getByText('Tasks'))
    expect(await screen.findByText('+ New task')).toBeInTheDocument()
  })

  it('shows exactly one section and switches on tab click', async () => {
    render(<App />)
    const bar = () => screen.getByTestId('tab-bar')

    // Home visible first.
    expect(await screen.findByText("Today's Mission")).toBeInTheDocument()

    // → Money: real S40 view shows, Home's content gone. (S40 filled in the
    // stub this test used to key off of — "money-networth-card" is
    // MoneyView's own Net worth Card, present per its Definition of Done #1.)
    fireEvent.click(within(bar()).getByText('Money'))
    expect(await screen.findByTestId('money-networth-card')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText("Today's Mission")).not.toBeInTheDocument())

    // → Agents: real S49 view shows, Money gone. (S49 filled in the stub this
    // test used to key off of — "fleet-table" is AgentsView's own fleet table
    // container, present per its Definition of Done #1.)
    fireEvent.click(within(bar()).getByText('Agents'))
    expect(await screen.findByTestId('fleet-table')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('money-networth-card')).not.toBeInTheDocument()
    )
  })

  it('marks only the active tab with aria-current', async () => {
    render(<App />)
    const bar = screen.getByTestId('tab-bar')
    expect(within(bar).getByText('Home')).toHaveAttribute('aria-current', 'page')
    expect(within(bar).getByText('Money')).not.toHaveAttribute('aria-current')

    fireEvent.click(within(bar).getByText('Career'))
    await waitFor(() =>
      expect(within(bar).getByText('Career')).toHaveAttribute('aria-current', 'page')
    )
    expect(within(bar).getByText('Home')).not.toHaveAttribute('aria-current')
  })
})

describe('S58 — Tasks tab re-parenting', () => {
  // Deterministic fixture, not the real 107-row seed importer: seedIfEmpty
  // only fires on an empty DB and no-ops otherwise, so pre-populating here
  // makes App's own initial provider.list() resolve near-instantly instead of
  // racing 107 sequential provider.add() calls (the CI failure this file
  // shipped with — see docs/agents/afk-pipeline.md's flake ledger for why
  // that race isn't a "flake" worth exempting: it reproduces on CI, not just
  // under this machine's parallel-test load).
  beforeEach(async () => {
    // Clear the table in place (same live Dexie connection) rather than
    // Dexie.delete + reopen — deleting the underlying database while the
    // module-level `db` singleton (shared across every test in this file)
    // still has an open connection from an earlier test's App render risks
    // a hung/blocked reopen, stalling unrelated tests' own provider.list().
    // (The file-level `beforeEach` above already sets `?noseed`, so no App
    // render anywhere in this file — S24's or S58's — ever races the real
    // importer against this fixture.)
    await db.tasks.clear()
    await db.tasks.bulkAdd(FIXTURE_TASKS)
  })

  it('Home no longer shows the Up next / Later folds', async () => {
    render(<App />)
    // Wait for the real (fixture) task data to load and rank — checking
    // immediately after mount (e.g. against the static "+ New task" button)
    // would pass whether or not NowView is mounted, since the task list
    // hasn't loaded yet at that instant. Waiting for a data-dependent pick
    // makes the absence check below meaningful.
    expect(await screen.findByText('Fixture task 1')).toBeInTheDocument()
    expect(screen.queryByText(/Up next/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Later/)).not.toBeInTheDocument()
  })

  it('Tasks tab shows the NowView folds (hideLive off) behind a Tasks/Domains/Pulse sub-nav, default Tasks', async () => {
    render(<App />)
    const bar = () => screen.getByTestId('tab-bar')
    expect(await screen.findByText('Fixture task 1')).toBeInTheDocument()

    fireEvent.click(within(bar()).getByText('Tasks'))

    // Sub-nav present, default segment is "tasks".
    const subnav = await screen.findByRole('tablist', { name: 'Tasks sub-navigation' })
    expect(within(subnav).getByText('Tasks')).toHaveAttribute('aria-selected', 'true')

    // hideLive is genuinely off: a top-ranked (rank-1) task is directly
    // visible with no fold click — if hideLive were flipped back on, this
    // task would disappear entirely rather than move behind a fold (ranks
    // 1-3 aren't covered by either fold).
    expect(await screen.findByText('Fixture task 1')).toBeInTheDocument()

    // The Up next fold covers ranks 4-6.
    const upNextToggle = await screen.findByRole('button', { name: /Up next/ })
    fireEvent.click(upNextToggle)
    expect(await screen.findByText('Fixture task 4')).toBeInTheDocument()

    // Sub-nav reaches Domains and Pulse (re-parented verbatim).
    fireEvent.click(within(subnav).getByText('Domains'))
    expect(await screen.findAllByTestId('domain-tile')).toHaveLength(7)

    fireEvent.click(within(subnav).getByText('Pulse'))
    expect(await screen.findByText('Done this week')).toBeInTheDocument()
  })

  // This does NOT go through App/tabs: AnimatePresence mode="wait" already
  // guarantees only one tab section is ever mounted, so a test that switches
  // tabs and checks occurrence counts can never fail from anything this
  // slice's code controls — it would only catch a regression to App's own
  // tab-conditional rendering, which is out of this slice's write-set.
  // Instead this renders the Home surface (MissionCard, via HomeView) and the
  // Tasks surface (NowView with hideLive off, via TasksView) independently
  // with the SAME fixture list, and checks per-surface occurrence counts —
  // directly exercising the hideLive/rankNow composition DoD 2 is about.
  it('the same task never renders more than once within the Home surface or the Tasks surface', async () => {
    const noopToggle = () => Promise.resolve(undefined)
    const noopDelete = () => Promise.resolve(undefined)
    const noopUpdate = () => Promise.resolve(undefined)

    const { container: homeContainer } = render(
      <HomeView tasks={FIXTURE_TASKS} onToggle={noopToggle} modeOverride="am" />,
    )
    // MissionCard's top-3 picks (ranks 1-3) — exactly once each, never twice.
    for (const t of FIXTURE_TASKS.slice(0, 3)) {
      expect(within(homeContainer).getAllByText(t.title)).toHaveLength(1)
    }
    // Ranks 4-6 (the old Up next/Later range) don't appear on Home at all.
    for (const t of FIXTURE_TASKS.slice(3)) {
      expect(within(homeContainer).queryAllByText(t.title)).toHaveLength(0)
    }

    const { container: tasksContainer } = render(
      <TasksView
        tasks={FIXTURE_TASKS}
        onToggle={noopToggle}
        onAdd={noopToggle}
        onDelete={noopDelete}
        onUpdate={noopUpdate}
        projects={[]}
      />,
    )
    // Open the Up next fold so ranks 4-6 are in the DOM too.
    fireEvent.click(within(tasksContainer).getByRole('button', { name: /Up next/ }))

    // Every fixture task appears EXACTLY once on the Tasks surface (live + fold).
    for (const t of FIXTURE_TASKS) {
      expect(within(tasksContainer).getAllByText(t.title)).toHaveLength(1)
    }
  })
})
