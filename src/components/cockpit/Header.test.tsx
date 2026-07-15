/**
 * S25 — Cockpit Header (docs/DESIGN_LANGUAGE.md §5/§6/§7).
 *
 * Covers the ticket DoD:
 *  1. §6 greeting renders for am/mid/pm (all three exercised via the seg
 *     control, which is the in-product `override`).
 *  2. Seg click flips the mode: body class + greeting + note append all move
 *     together.
 *  3. The shine animation is on the greeting only — nothing else animated.
 */
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Header } from './Header'

// Fixed date so the subtitle is deterministic regardless of the wall clock.
const FIXED = new Date('2026-07-15T09:00:00') // a Wednesday

afterEach(() => {
  // useTimeOfDay removes body classes on unmount, but be defensive so one
  // test can never leak `mid`/`pm` into the next.
  document.body.classList.remove('mid', 'pm')
})

function seg(label: 'Morning' | 'Midday' | 'Evening') {
  return screen.getByRole('tab', { name: label })
}

describe('Header', () => {
  it('renders the morning greeting + mission-note base and carries no body class', () => {
    render(<Header now={FIXED} />)

    // Force Morning explicitly: the initial mode is wall-clock-derived
    // (useTimeOfDay reads its own clock), so drive it through the seg control
    // to make the morning assertions deterministic.
    fireEvent.click(seg('Morning'))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good morning, Deepak')
    expect(screen.getByText('Win these 3 and today counts')).toBeInTheDocument()
    // Morning is the default look — no body class (§6 "none = morning").
    expect(document.body.classList.contains('mid')).toBe(false)
    expect(document.body.classList.contains('pm')).toBe(false)
  })

  it('shows the formatted date in the subtitle', () => {
    render(<Header now={FIXED} />)
    expect(screen.getByText('Wednesday, July 15')).toBeInTheDocument()
  })

  it('switches to Midday: greeting + body class change together', () => {
    render(<Header now={FIXED} />)

    fireEvent.click(seg('Midday'))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Back at it, Deepak')
    expect(document.body.classList.contains('mid')).toBe(true)
    expect(document.body.classList.contains('pm')).toBe(false)
    // Active tab reflects the new mode.
    expect(seg('Midday')).toHaveAttribute('aria-selected', 'true')
  })

  it('switches to Evening: greeting + body class change together', () => {
    render(<Header now={FIXED} />)

    fireEvent.click(seg('Evening'))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Winding down, Deepak')
    expect(document.body.classList.contains('pm')).toBe(true)
    expect(document.body.classList.contains('mid')).toBe(false)
    expect(seg('Evening')).toHaveAttribute('aria-selected', 'true')
  })

  it('renders all three §6 greetings as the mode is driven through the seg control', () => {
    render(<Header now={FIXED} />)

    fireEvent.click(seg('Morning'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good morning, Deepak')

    fireEvent.click(seg('Midday'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Back at it, Deepak')

    fireEvent.click(seg('Evening'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Winding down, Deepak')
  })

  it('defines the §6 mission-note append for both mid and pm, keyed off the body class', () => {
    const { container } = render(<Header now={FIXED} />)

    // The append is a CSS ::after keyed off the body class (jsdom does not
    // compute ::after content), so assert the scoped stylesheet wires both.
    const css = container.querySelector('style')?.textContent ?? ''
    expect(css).toContain('body.mid .s25-note::after')
    expect(css).toContain('— midday check: 1 done, deep-work block starts in 40 min.')
    expect(css).toContain('body.pm .s25-note::after')
    expect(css).toContain('— 2 of 3 done. One rescue left before the day closes.')

    // The note element the appends target must exist.
    const note = screen.getByText('Win these 3 and today counts')
    expect(note).toHaveClass('s25-note')
  })

  it('animates the greeting only — the shine class lives on the H1 and nowhere else', () => {
    const { container } = render(<Header now={FIXED} />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveClass('s25-greeting')

    // No other element carries the shine (§7: greeting only; DoD item 3).
    const shiners = container.querySelectorAll('.s25-greeting')
    expect(shiners).toHaveLength(1)
    expect(shiners[0]).toBe(heading)

    // The 6s shine and its reduced-motion off-switch are both scoped to the
    // greeting selector alone (§7 reduced-motion contract, honored in CSS).
    const css = container.querySelector('style')?.textContent ?? ''
    expect(css).toContain('animation:s25-greeting-shine 6s linear infinite')
    expect(css).toContain('@media(prefers-reduced-motion:reduce){.s25-greeting{animation:none}}')
  })

  it('exposes the seg control as an accessible tablist', () => {
    render(<Header now={FIXED} />)
    const tablist = screen.getByRole('tablist', { name: 'Time of day' })
    expect(within(tablist).getAllByRole('tab')).toHaveLength(3)
  })
})
