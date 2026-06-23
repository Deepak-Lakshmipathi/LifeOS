/**
 * Behavior tests for Slice S3b — priority UI.
 * Focused on the slice behaviors, not seam internals (covered by S3a):
 *  - create with a chosen priority passes the numeric value through the seam
 *  - create with no choice passes priority: undefined (untriaged default)
 *  - the weight badge renders (with an accessible, non-color-alone label) when
 *    priority is set, and nothing when it is absent
 *  - inline edit changes a priority, and selecting "None" clears it
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AddTaskInput } from '../components/AddTaskInput'
import { TaskItem } from '../components/TaskItem'
import type { Task } from '../types'

afterEach(cleanup)

function makeTask(overrides: Partial<Task> = {}): Task {
  return { id: 't1', title: 'Write the report', done: false, created_at: 0, ...overrides }
}

const noop = async () => {}

describe('AddTaskInput — create with priority', () => {
  it('passes the chosen priority (High → 3) to onAdd', async () => {
    const onAdd = vi.fn(async () => {})
    render(<AddTaskInput onAdd={onAdd} />)

    fireEvent.change(screen.getByLabelText('New task title'), { target: { value: 'Ship S3b' } })
    fireEvent.click(screen.getByRole('radio', { name: 'High' }))
    fireEvent.keyDown(screen.getByLabelText('New task title'), { key: 'Enter' })

    await vi.waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ship S3b', priority: 3 }))
    )
  })

  it('defaults to untriaged — no choice passes priority: undefined', async () => {
    const onAdd = vi.fn(async () => {})
    render(<AddTaskInput onAdd={onAdd} />)

    fireEvent.change(screen.getByLabelText('New task title'), { target: { value: 'Quick capture' } })
    fireEvent.keyDown(screen.getByLabelText('New task title'), { key: 'Enter' })

    await vi.waitFor(() => expect(onAdd).toHaveBeenCalled())
    expect(onAdd.mock.calls[0][0].priority).toBeUndefined()
  })

  it('"None" is the selected radio by default', () => {
    render(<AddTaskInput onAdd={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'None' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'High' })).not.toBeChecked()
  })
})

describe('TaskItem — weight badge', () => {
  it('renders nothing for priority when it is absent', () => {
    render(<TaskItem task={makeTask()} onToggle={noop} onDelete={noop} onUpdate={noop} />)
    expect(screen.queryByLabelText(/^Priority /)).not.toBeInTheDocument()
  })

  it('renders a labeled (non-color-alone) badge when priority is set', () => {
    render(
      <TaskItem task={makeTask({ priority: 3 })} onToggle={noop} onDelete={noop} onUpdate={noop} />
    )
    // Accessible name carries the meaning, not color alone.
    expect(screen.getByLabelText('Priority High')).toHaveTextContent('High')
  })
})

describe('TaskItem — inline edit priority', () => {
  it('changing the priority commits the numeric value (Low → High = 3)', async () => {
    const onUpdate = vi.fn(async () => {})
    render(
      <TaskItem task={makeTask({ priority: 1 })} onToggle={noop} onDelete={noop} onUpdate={onUpdate} />
    )

    fireEvent.click(screen.getByLabelText('Edit task'))
    fireEvent.click(screen.getByRole('radio', { name: 'High' }))
    fireEvent.keyDown(screen.getByLabelText('Edit task title'), { key: 'Enter' })

    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith('t1', { priority: 3 }))
  })

  it('selecting "None" clears the priority (priority: undefined)', async () => {
    const onUpdate = vi.fn(async () => {})
    render(
      <TaskItem task={makeTask({ priority: 2 })} onToggle={noop} onDelete={noop} onUpdate={onUpdate} />
    )

    fireEvent.click(screen.getByLabelText('Edit task'))
    fireEvent.click(screen.getByRole('radio', { name: 'None' }))
    fireEvent.keyDown(screen.getByLabelText('Edit task title'), { key: 'Enter' })

    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith('t1', { priority: undefined }))
  })
})
