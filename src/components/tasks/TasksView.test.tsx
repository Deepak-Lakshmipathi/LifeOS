/**
 * S58 — TasksView (Segmented sub-nav re-parenting Domains/Pulse + NowView's
 * folds into the new Tasks tab).
 *
 * Covers the numbered DoD:
 *  2. Top-ranked tasks are visible with no hideLive (Up next / Later folds
 *     reachable from the default `tasks` segment).
 *  3. Segmented sub-nav switches Tasks / Domains / Pulse; DomainsMap and
 *     PulseView render their own unchanged content; default segment is `tasks`.
 */
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { TasksView } from './TasksView'
import type { Task } from '../../types'

function noopAsync() {
  return vi.fn().mockResolvedValue(undefined)
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 'task-1',
    title: overrides.title ?? 'Ship the thing',
    done: false,
    created_at: 0,
    priority: 1,
    ...overrides,
  }
}

const baseProps = {
  onToggle: noopAsync(),
  onDelete: noopAsync(),
  onUpdate: noopAsync(),
  projects: [] as string[],
}

describe('TasksView — Segmented sub-nav (S58)', () => {
  it('defaults to the tasks segment', () => {
    render(<TasksView {...baseProps} tasks={[makeTask()]} />)
    const tablist = screen.getByRole('tablist', { name: 'Tasks sub-navigation' })
    expect(within(tablist).getByText('Tasks')).toHaveAttribute('aria-selected', 'true')
  })

  it('shows the top-ranked task directly (no hideLive) on the default tasks segment', () => {
    render(<TasksView {...baseProps} tasks={[makeTask({ title: 'Visible top task' })]} />)
    expect(screen.getByText('Visible top task')).toBeInTheDocument()
  })

  it('switches to Domains and renders DomainsMap unchanged (one tile per domain)', () => {
    render(<TasksView {...baseProps} tasks={[]} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Domains' }))
    expect(screen.getAllByTestId('domain-tile').length).toBe(7)
  })

  it('switches to Pulse and renders PulseView unchanged (Done this week metric)', () => {
    render(<TasksView {...baseProps} tasks={[]} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Pulse' }))
    expect(screen.getByText('Done this week')).toBeInTheDocument()
  })

  it('switching segments away from tasks hides the task list', () => {
    render(<TasksView {...baseProps} tasks={[makeTask({ title: 'Only on tasks segment' })]} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Pulse' }))
    expect(screen.queryByText('Only on tasks segment')).not.toBeInTheDocument()
  })

  it('switching back to Tasks restores the task list', () => {
    render(<TasksView {...baseProps} tasks={[makeTask({ title: 'Round trip task' })]} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Domains' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Tasks' }))
    expect(screen.getByText('Round trip task')).toBeInTheDocument()
  })
})
