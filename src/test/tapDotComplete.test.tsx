/**
 * S8 — Tap-the-dot complete + undo.
 *
 * Tests verify:
 *  1. TaskItem calls onCompleted when a non-done task's dot is tapped.
 *  2. TaskItem calls onToggle when an already-done task's dot is tapped.
 *  3. UndoToast auto-dismisses after DISMISS_MS via a timer.
 *  4. UndoToast calls onUndo then onDismiss when Undo button is clicked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TaskItem } from '../components/TaskItem'
import { UndoToast } from '../components/UndoToast'
import type { Task } from '../types'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Write tests',
    done: false,
    created_at: Date.now(),
    ...overrides,
  }
}

// ─── TaskItem dot behaviour ──────────────────────────────────────────────────

describe('TaskItem dot interaction', () => {
  const noop = async () => {}

  it('calls onToggle when dot is tapped on an incomplete task', async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)
    const task = makeTask()

    render(
      <TaskItem
        task={task}
        onToggle={onToggle}
        onDelete={noop}
        onUpdate={noop}
        projects={[]}
      />
    )

    const dot = screen.getByRole('button', { name: 'Mark complete' })
    await act(async () => { fireEvent.click(dot) })

    expect(onToggle).toHaveBeenCalledOnce()
    expect(onToggle).toHaveBeenCalledWith('task-1')
  })

  it('calls onCompleted with (id, title) when provided and task is incomplete', async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)
    const onCompleted = vi.fn()
    const task = makeTask({ title: 'Write tests' })

    render(
      <TaskItem
        task={task}
        onToggle={onToggle}
        onDelete={noop}
        onUpdate={noop}
        projects={[]}
        onCompleted={onCompleted}
      />
    )

    const dot = screen.getByRole('button', { name: 'Mark complete' })
    await act(async () => { fireEvent.click(dot) })

    expect(onCompleted).toHaveBeenCalledOnce()
    expect(onCompleted).toHaveBeenCalledWith('task-1', 'Write tests')
  })

  it('does NOT call onCompleted when tapping an already-done task', async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)
    const onCompleted = vi.fn()
    const task = makeTask({ done: true })

    render(
      <TaskItem
        task={task}
        onToggle={onToggle}
        onDelete={noop}
        onUpdate={noop}
        projects={[]}
        onCompleted={onCompleted}
      />
    )

    const dot = screen.getByRole('button', { name: 'Mark incomplete' })
    await act(async () => { fireEvent.click(dot) })

    expect(onToggle).toHaveBeenCalledOnce()
    expect(onCompleted).not.toHaveBeenCalled()
  })
})

// ─── UndoToast ───────────────────────────────────────────────────────────────

describe('UndoToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders with task title and Undo button', () => {
    render(
      <UndoToast
        taskTitle="Write tests"
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />
    )

    expect(screen.getByTestId('undo-toast')).toBeInTheDocument()
    expect(screen.getByText(/"Write tests" completed/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo task completion' })).toBeInTheDocument()
  })

  it('calls onDismiss automatically after 3 seconds', () => {
    const onDismiss = vi.fn()

    render(
      <UndoToast
        taskTitle="Autoclose me"
        onUndo={vi.fn()}
        onDismiss={onDismiss}
      />
    )

    expect(onDismiss).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(3000) })

    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('does NOT call onDismiss before 3 seconds have elapsed', () => {
    const onDismiss = vi.fn()

    render(
      <UndoToast
        taskTitle="Still here"
        onUndo={vi.fn()}
        onDismiss={onDismiss}
      />
    )

    act(() => { vi.advanceTimersByTime(2999) })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('calls onUndo and onDismiss when Undo button is clicked', () => {
    const onUndo = vi.fn()
    const onDismiss = vi.fn()

    render(
      <UndoToast
        taskTitle="Undo me"
        onUndo={onUndo}
        onDismiss={onDismiss}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Undo task completion' }))

    expect(onUndo).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('cleans up the timer on unmount (no stale calls)', () => {
    const onDismiss = vi.fn()
    const { unmount } = render(
      <UndoToast
        taskTitle="Unmount me"
        onUndo={vi.fn()}
        onDismiss={onDismiss}
      />
    )

    unmount()

    act(() => { vi.advanceTimersByTime(5000) })
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
