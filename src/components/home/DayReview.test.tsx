/**
 * S29 — DayReview render fixture (DESIGN_LANGUAGE §6).
 *
 * Covers the numbered DoD:
 *  4. Styling matches §6 (purple tint tokens; stat pair sizes).
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { DayReview } from './DayReview'
import type { Task } from '../../types'

const NOW = new Date(2024, 0, 15, 20, 0, 0).getTime()

function task(over: Partial<Task> & Pick<Task, 'id'>): Task {
  return { title: over.id, done: false, created_at: 0, ...over }
}

describe('DayReview', () => {
  it('renders the "Day Review" heading', () => {
    render(<DayReview tasks={[]} now={NOW} />)
    expect(screen.getByText('Day Review')).toBeInTheDocument()
  })

  it('renders the real stat pairs from dayStats plus honest placeholders', () => {
    const tasks = [
      task({ id: 'a', priority: 3, created_at: 1, domain: 'Career', done: true, completed_at: NOW }),
    ]
    render(<DayReview tasks={tasks} now={NOW} />)

    expect(screen.getByText('Mission done')).toBeInTheDocument()
    expect(screen.getByText('Tasks completed')).toBeInTheDocument()
    expect(screen.getByText('Domains warmed')).toBeInTheDocument()
    expect(screen.getByText('Debts owed')).toBeInTheDocument()
    expect(screen.getByText("Tomorrow's seed")).toBeInTheDocument()

    // Placeholders are honest — literal em dash, not a fabricated number (§8).
    const placeholders = screen.getAllByText('—')
    expect(placeholders).toHaveLength(2)
  })

  it('purple tint per §6 (border/background tokens set on the card)', () => {
    render(<DayReview tasks={[]} now={NOW} />)
    const card = screen.getByText('Day Review').closest('div')
    expect(card?.className).toContain('rgba(167,139,250,.35)')
    expect(card?.className).toContain('rgba(167,139,250,.07)')
  })

  it('renders 5 stat pairs total', () => {
    render(<DayReview tasks={[]} now={NOW} />)
    expect(screen.getAllByTestId('day-review-stat')).toHaveLength(5)
  })
})
