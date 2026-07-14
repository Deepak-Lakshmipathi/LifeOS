/**
 * S21 — Chip (DESIGN_LANGUAGE §4.3).
 * All 4 variants render with the contract's literal colors; rescue carries
 * the dashed border + ❄ text.
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { Chip } from './Chip'

describe('Chip', () => {
  it('renders the dom variant tinted via color-mix(--dc)', () => {
    render(
      <Chip variant="dom" dc="var(--d-build)">
        Building Things
      </Chip>
    )
    const chip = screen.getByText('Building Things')
    expect(chip.className).toContain('color-mix(in_srgb,var(--dc)_18%,transparent)')
    expect(chip.style.getPropertyValue('--dc')).toBe('var(--d-build)')
  })

  it('renders the p3 (High) variant with contract colors', () => {
    render(<Chip variant="p3">High</Chip>)
    const chip = screen.getByText('High')
    expect(chip.className).toContain('rgba(248,113,113,.15)')
    expect(chip.className).toContain('#fca5a5')
  })

  it('renders the p2 (Med) variant with contract colors', () => {
    render(<Chip variant="p2">Med</Chip>)
    const chip = screen.getByText('Med')
    expect(chip.className).toContain('rgba(251,191,36,.14)')
    expect(chip.className).toContain('#fcd34d')
  })

  it('renders the rescue variant with a dashed border and ❄ text', () => {
    render(<Chip variant="rescue">coldest-domain rescue</Chip>)
    const chip = screen.getByText(/coldest-domain rescue/)
    expect(chip.textContent).toContain('❄')
    expect(chip.className).toContain('border-dashed')
    expect(chip.className).toContain('rgba(94,234,212,.4)')
    expect(chip.className).toContain('rgba(45,212,191,.15)')
  })

  it('is always a 999px pill', () => {
    render(<Chip variant="p3">High</Chip>)
    expect(screen.getByText('High').className).toContain('rounded-[999px]')
  })
})
