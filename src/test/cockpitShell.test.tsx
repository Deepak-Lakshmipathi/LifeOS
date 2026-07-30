/**
 * S24 — Cockpit shell IA. Verifies the tabs render in §5 order, that the
 * default Home section keeps the v1 capture affordance (no functionality lost),
 * and that switching tabs shows exactly one section at a time (§2.3 fade).
 *
 * S58 folded Domains/Pulse into the new Tasks tab (five tabs, not six) and
 * moved NowView's Up next/Later folds off Home into that same Tasks tab.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'

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
})

describe('S24 cockpit shell', () => {
  it('renders the five tabs in IA order (Home·Tasks·Money·Career·Agents)', () => {
    render(<App />)
    const bar = screen.getByTestId('tab-bar')
    const labels = within(bar)
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(labels).toEqual(['Home', 'Tasks', 'Money', 'Career', 'Agents'])
  })

  it('defaults to Home with the v1 capture flow still reachable', async () => {
    render(<App />)
    // Home is the default section; its capture affordance (v1 add flow) is present.
    expect(await screen.findByText('+ New task')).toBeInTheDocument()
  })

  it('shows exactly one section and switches on tab click', async () => {
    render(<App />)
    const bar = () => screen.getByTestId('tab-bar')

    // Home visible first.
    expect(await screen.findByText('+ New task')).toBeInTheDocument()

    // → Money: real S40 view shows, Home's capture button gone. (S40 filled
    // in the stub this test used to key off of — "money-networth-card" is
    // MoneyView's own Net worth Card, present per its Definition of Done #1.)
    fireEvent.click(within(bar()).getByText('Money'))
    expect(await screen.findByTestId('money-networth-card')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('+ New task')).not.toBeInTheDocument())

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
  it('Home no longer shows the Up next / Later folds', async () => {
    render(<App />)
    expect(await screen.findByText('+ New task')).toBeInTheDocument()
    expect(screen.queryByText(/Up next/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Later/)).not.toBeInTheDocument()
  })

  it('Tasks tab shows the NowView folds (hideLive off) behind a Tasks/Domains/Pulse sub-nav, default Tasks', async () => {
    render(<App />)
    const bar = () => screen.getByTestId('tab-bar')
    expect(await screen.findByText('+ New task')).toBeInTheDocument()

    fireEvent.click(within(bar()).getByText('Tasks'))

    // Sub-nav present, default segment is "tasks".
    const subnav = await screen.findByRole('tablist', { name: 'Tasks sub-navigation' })
    expect(within(subnav).getByText('Tasks')).toHaveAttribute('aria-selected', 'true')

    // NowView's fold section renders (seed data exceeds the live-3 cap).
    // Generous timeout: the seed importer awaits 107 sequential provider.add()
    // calls before the task list first exceeds LIVE_COUNT.
    expect(await screen.findByText(/Up next/, {}, { timeout: 15000 })).toBeInTheDocument()

    // Sub-nav reaches Domains and Pulse (re-parented verbatim).
    fireEvent.click(within(subnav).getByText('Domains'))
    expect(await screen.findAllByTestId('domain-tile')).toHaveLength(7)

    fireEvent.click(within(subnav).getByText('Pulse'))
    expect(await screen.findByText('Done this week')).toBeInTheDocument()
  }, 20000)

  it('never renders the same task twice anywhere in the app', async () => {
    render(<App />)
    const bar = () => screen.getByTestId('tab-bar')
    const uniqueTitle = 'S58-duplicate-check-unique-task'

    // Add a fresh, uniquely-titled inbox task via Home's capture flow.
    await screen.findByText('+ New task')
    fireEvent.click(screen.getByLabelText('Add task'))
    const input = await screen.findByLabelText('Capture task')
    fireEvent.change(input, { target: { value: uniqueTitle } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    // Wherever it renders on Home (or nowhere, if not top-ranked), it must
    // never render more than once.
    await waitFor(() => {
      expect(screen.queryAllByText(uniqueTitle).length).toBeLessThanOrEqual(1)
    })

    // Switch to Tasks and open both folds — the task is domain-less (an
    // "inbox" task), so rankNow always admits it somewhere in Up next/Later.
    fireEvent.click(within(bar()).getByText('Tasks'))
    const upNextToggle = await screen.findByRole(
      'button',
      { name: /Up next/ },
      { timeout: 15000 },
    )
    fireEvent.click(upNextToggle)
    const laterToggle = screen.queryByRole('button', { name: /^Later/ })
    if (laterToggle) fireEvent.click(laterToggle)

    await waitFor(() => {
      expect(screen.getAllByText(uniqueTitle).length).toBe(1)
    })

    // Back on Home, still never more than once.
    fireEvent.click(within(bar()).getByText('Home'))
    await waitFor(() => {
      expect(screen.queryAllByText(uniqueTitle).length).toBeLessThanOrEqual(1)
    })
  }, 20000)
})
