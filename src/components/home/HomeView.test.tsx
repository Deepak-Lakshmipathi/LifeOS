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
  onDelete: noopAsync(),
  onUpdate: noopAsync(),
  onAdd: noopAsync(),
  projects: [] as string[],
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
