/**
 * S21 — Card (DESIGN_LANGUAGE §4).
 * Render, heading/count formatting, and the required cursor-spotlight
 * driver (--mx/--my updated on mousemove).
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Card } from './Card'

describe('Card', () => {
  it('renders children inside the panel', () => {
    render(<Card>hello glass</Card>)
    expect(screen.getByText('hello glass')).toBeInTheDocument()
  })

  it('renders an uppercase h2 heading with a · count suffix', () => {
    render(
      <Card heading="Needs you" count={4}>
        body
      </Card>
    )
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.textContent).toBe('Needs you · 4')
  })

  it('omits the count suffix when count is not provided', () => {
    render(<Card heading="Today">body</Card>)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Today')
  })

  it('carries the base panel/border/radius/blur classes from §4', () => {
    render(<Card data-testid="card">content</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain('bg-panel')
    expect(card.className).toContain('border-panel-brd')
    expect(card.className).toContain('rounded-card')
    expect(card.className).toContain('backdrop-blur-card')
    expect(card.className).toContain('overflow-hidden')
  })

  it('carries the required cursor-spotlight ::before utilities', () => {
    render(<Card data-testid="card">content</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain("before:content-['']")
    expect(card.className).toContain('var(--mx,50%)')
    expect(card.className).toContain('var(--my,-40%)')
  })

  it('updates --mx/--my custom properties on mousemove', () => {
    render(<Card data-testid="card">content</Card>)
    const card = screen.getByTestId('card')

    expect(card.style.getPropertyValue('--mx')).toBe('')

    fireEvent.mouseMove(card, { clientX: 120, clientY: 80 })

    expect(card.style.getPropertyValue('--mx')).toBe('120px')
    expect(card.style.getPropertyValue('--my')).toBe('80px')
  })
})
