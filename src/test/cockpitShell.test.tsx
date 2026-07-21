/**
 * S24 — Cockpit shell IA. Verifies the six tabs render in §5 order, that the
 * default Home section keeps the v1 capture affordance (no functionality lost),
 * and that switching tabs shows exactly one section at a time (§2.3 fade).
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
  it('renders the six tabs in IA order (Home·Money·Career·Agents·Domains·Pulse)', () => {
    render(<App />)
    const bar = screen.getByTestId('tab-bar')
    const labels = within(bar)
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(labels).toEqual(['Home', 'Money', 'Career', 'Agents', 'Domains', 'Pulse'])
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

    // → Agents: stub shows, Money gone.
    fireEvent.click(within(bar()).getByText('Agents'))
    expect(await screen.findByText(/Fleet health/)).toBeInTheDocument()
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
