/**
 * S27 — MissionCard render fixture (DESIGN_LANGUAGE §4.3, §8).
 *
 * Covers the numbered DoD:
 *  3. Every rendered task shows why + done_when without hover/expander.
 *  4. Rescue task renders the ❄ dashed chip §4.3.
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MissionCard } from './MissionCard'
import type { Task } from '../../types'
import { DOMAINS } from '../../data/domains'

const NOW = 1_700_000_000_000

function task(over: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: over.id,
    done: false,
    created_at: 0,
    ...over,
  }
}

/** One recently-completed task per domain (all hot) except `exceptDomain`,
 *  which is left with no completed task at all — computeWarmth rates it
 *  'cold', the only cold/stale domain, so rescue deterministically picks it. */
function warmEveryDomainExcept(exceptDomain: string): Task[] {
  return DOMAINS.filter((d) => d !== exceptDomain).map((d) =>
    task({ id: `warm-${d}`, domain: d, done: true, completed_at: NOW - 60_000 }),
  )
}

describe('MissionCard', () => {
  it('renders the "Today\'s Mission" heading', () => {
    render(<MissionCard tasks={[]} now={NOW} />)
    expect(screen.getByText("Today's Mission")).toBeInTheDocument()
  })

  it('shows an empty state when there are no picks', () => {
    render(<MissionCard tasks={[]} now={NOW} />)
    expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument()
  })

  it('renders up to 3 mission task rows', () => {
    const tasks = [
      task({ id: 'a', priority: 3, domain: 'Career', done_when: 'Sent' }),
      task({ id: 'b', priority: 2, domain: 'Growth', done_when: 'Done' }),
      task({ id: 'c', priority: 1, domain: 'Life Admin', done_when: 'Filed' }),
    ]
    render(<MissionCard tasks={tasks} now={NOW} />)
    expect(screen.getAllByTestId('mission-task')).toHaveLength(3)
  })

  it('every rendered task shows why + done_when without hover/expander (§8)', () => {
    const tasks = [
      task({ id: 'a', priority: 3, domain: 'Career', done_when: 'Invoice sent' }),
    ]
    render(<MissionCard tasks={tasks} now={NOW} />)

    // why line is present in the DOM (not gated behind a hover/expander state).
    const row = screen.getByTestId('mission-task')
    expect(row.querySelector('.why')).not.toBeNull()
    expect(row.querySelector('.why')?.textContent?.length).toBeGreaterThan(0)

    // done_when line is present with the exact literal.
    expect(screen.getByText('Invoice sent')).toBeInTheDocument()
    expect(screen.getByText('Done when')).toBeInTheDocument()
  })

  it('shows an honest placeholder when done_when is unset', () => {
    const tasks = [task({ id: 'a', priority: 1, domain: 'Growth' })]
    render(<MissionCard tasks={tasks} now={NOW} />)
    expect(screen.getByText('Not set')).toBeInTheDocument()
  })

  it('renders the rescue ❄ dashed chip on the rescue pick (§4.3)', () => {
    // Every domain except Finance is warmed (hot); Finance is the sole
    // cold/stale domain with 3 open tasks — the per-domain cap (2) admits
    // f1+f2, leaving f3 for cold-domain rescue.
    const tasks: Task[] = [
      ...warmEveryDomainExcept('Finance'),
      task({ id: 'f1', priority: 3, created_at: 1, domain: 'Finance' }),
      task({ id: 'f2', priority: 2, created_at: 2, domain: 'Finance' }),
      task({ id: 'f3', priority: 1, created_at: 3, domain: 'Finance' }),
    ]
    render(<MissionCard tasks={tasks} now={NOW} />)
    expect(screen.getByText(/coldest-domain rescue/)).toBeInTheDocument()
  })

  it('renders a domain chip for a task with a domain', () => {
    const tasks = [task({ id: 'a', priority: 3, domain: 'Career' })]
    render(<MissionCard tasks={tasks} now={NOW} />)
    expect(screen.getByText('Career')).toBeInTheDocument()
  })

  it('dismissing a pick removes it and backfills the next-ranked task', () => {
    const tasks = [
      task({ id: 'p3', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'p2', priority: 2, created_at: 2, domain: 'Growth' }),
      task({ id: 'p1', priority: 1, created_at: 3, domain: 'Body & Mind' }),
      task({ id: 'p0', created_at: 4 }),
    ]
    render(<MissionCard tasks={tasks} now={NOW} />)

    expect(screen.getAllByTestId('mission-task')).toHaveLength(3)

    const dismissButton = screen.getByLabelText(`Dismiss ${tasks[0].title}`)
    fireEvent.click(dismissButton)

    const remaining = screen.getAllByTestId('mission-task')
    expect(remaining).toHaveLength(3)
    // p3 vetoed; p2, p1 stay; p0 (next-ranked) backfills.
    expect(screen.queryByLabelText('Dismiss p3')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Dismiss p0')).toBeInTheDocument()
  })
})
