/**
 * Tests for S40 — BarMeter (DESIGN_LANGUAGE §4.9 "Bar meter").
 */
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup } from '@testing-library/react'
import { BarMeter } from './BarMeter'

afterEach(cleanup)

describe('BarMeter', () => {
  it('fills to the given percentage', () => {
    const { getByTestId } = render(<BarMeter variant="income" pct={62} />)
    expect(getByTestId('bar-meter-fill')).toHaveStyle({ width: '62%' })
  })

  it('clamps below 0 and above 100', () => {
    const { getByTestId, rerender } = render(<BarMeter variant="spend" pct={-30} />)
    expect(getByTestId('bar-meter-fill')).toHaveStyle({ width: '0%' })

    rerender(<BarMeter variant="spend" pct={140} />)
    expect(getByTestId('bar-meter-fill')).toHaveStyle({ width: '100%' })
  })

  it('treats non-finite pct as 0 rather than crashing', () => {
    const { getByTestId } = render(<BarMeter variant="income" pct={NaN} />)
    expect(getByTestId('bar-meter-fill')).toHaveStyle({ width: '0%' })
  })

  it.each([
    ['income', 'var(--good)', '#22d3ee'],
    ['spend', 'var(--warn)', 'var(--bad)'],
    ['growth', 'var(--d-growth)', 'var(--d-career)'],
    ['body', 'var(--d-body)', 'var(--d-fin)'],
  ] as const)('%s variant gradients from %s to %s', (variant, from, to) => {
    const { getByTestId } = render(<BarMeter variant={variant} pct={50} />)
    const fill = getByTestId('bar-meter-fill')
    const bg = fill.style.backgroundImage
    expect(bg).toContain(from)
    expect(bg).toContain(to)
  })

  it('exposes the variant on the track for styling/testing hooks', () => {
    const { getByTestId } = render(<BarMeter variant="growth" pct={10} />)
    expect(getByTestId('bar-meter-track')).toHaveAttribute('data-variant', 'growth')
  })
})
