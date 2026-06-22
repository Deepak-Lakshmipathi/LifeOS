/**
 * Behavior tests for Slice S2b — done_when UI.
 * Focused on the three slice behaviors, not seam internals (covered by S2a):
 *  - create with done_when passes a normalized value through the seam
 *  - inline edit clears done_when (and a rejected empty title keeps edit mode)
 *  - an absent done_when renders nothing (no empty secondary line)
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AddTaskInput } from '../components/AddTaskInput'
import { TaskItem } from '../components/TaskItem'
import type { Task } from '../types'

afterEach(cleanup)

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Write the report',
    done: false,
    created_at: 0,
    ...overrides,
  }
}

const noop = async () => {}

describe('AddTaskInput — create with done_when', () => {
  it('passes a normalized done_when to onAdd', async () => {
    const onAdd = vi.fn(async () => {})
    render(<AddTaskInput onAdd={onAdd} />)

    fireEvent.change(screen.getByLabelText('New task title'), {
      target: { value: 'Ship S2b' },
    })
    fireEvent.change(screen.getByPlaceholderText('Done when…'), {
      target: { value: '  PR merged  ' },
    })
    fireEvent.keyDown(screen.getByLabelText('New task title'), { key: 'Enter' })

    await vi.waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({ title: 'Ship S2b', done_when: 'PR merged' })
    )
  })

  it('normalizes empty/whitespace done_when to undefined', async () => {
    const onAdd = vi.fn(async () => {})
    render(<AddTaskInput onAdd={onAdd} />)

    fireEvent.change(screen.getByLabelText('New task title'), {
      target: { value: 'No criterion' },
    })
    fireEvent.change(screen.getByPlaceholderText('Done when…'), {
      target: { value: '   ' },
    })
    fireEvent.keyDown(screen.getByLabelText('New task title'), { key: 'Enter' })

    await vi.waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({ title: 'No criterion', done_when: undefined })
    )
  })
})

describe('TaskItem — card render', () => {
  it('renders nothing for done_when when it is absent', () => {
    render(
      <TaskItem task={makeTask()} onToggle={noop} onDelete={noop} onUpdate={noop} />
    )
    expect(screen.getByText('Write the report')).toBeInTheDocument()
    // No secondary line: only the title text is present.
    expect(screen.queryByLabelText('Edit done when')).not.toBeInTheDocument()
  })

  it('renders the done_when secondary line when present', () => {
    render(
      <TaskItem
        task={makeTask({ done_when: 'Boss signs off' })}
        onToggle={noop}
        onDelete={noop}
        onUpdate={noop}
      />
    )
    expect(screen.getByText('Boss signs off')).toBeInTheDocument()
  })
})

describe('TaskItem — inline edit', () => {
  it('emptying done_when clears it through updateTask', async () => {
    const onUpdate = vi.fn(async () => {})
    render(
      <TaskItem
        task={makeTask({ done_when: 'Boss signs off' })}
        onToggle={noop}
        onDelete={noop}
        onUpdate={onUpdate}
      />
    )

    fireEvent.click(screen.getByLabelText('Edit task'))
    const doneWhen = screen.getByLabelText('Edit done when')
    fireEvent.change(doneWhen, { target: { value: '' } })
    fireEvent.keyDown(doneWhen, { key: 'Enter' })

    await vi.waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith('t1', { done_when: '' })
    )
  })

  it('rejected empty title keeps the row in edit mode and preserves the prior title', async () => {
    const onUpdate = vi.fn(async () => {})
    render(
      <TaskItem task={makeTask()} onToggle={noop} onDelete={noop} onUpdate={onUpdate} />
    )

    fireEvent.click(screen.getByLabelText('Edit task'))
    const title = screen.getByLabelText('Edit task title') as HTMLInputElement
    fireEvent.change(title, { target: { value: '   ' } })
    fireEvent.keyDown(title, { key: 'Enter' })

    // Seam never called for a nameless task; row stays in edit mode.
    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Edit task title')).toBeInTheDocument()
    // Prior title restored in the draft.
    await vi.waitFor(() =>
      expect((screen.getByLabelText('Edit task title') as HTMLInputElement).value).toBe(
        'Write the report'
      )
    )
  })
})
