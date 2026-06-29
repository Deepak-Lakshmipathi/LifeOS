import { describe, it, expect } from 'vitest'
import type { Task } from '../types'
import { rankNow } from './rankNow'

// Minimal Task factory — only the fields rankNow reads matter.
function task(over: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: over.id,
    done: false,
    created_at: 0,
    ...over,
  }
}

describe('rankNow', () => {
  it('orders by priority descending (3 before 2 before 1)', () => {
    const tasks = [
      task({ id: 'p1', priority: 1, created_at: 1 }),
      task({ id: 'p3', priority: 3, created_at: 1 }),
      task({ id: 'p2', priority: 2, created_at: 1 }),
    ]
    expect(rankNow(tasks).map((t) => t.id)).toEqual(['p3', 'p2', 'p1'])
  })

  it('sinks tasks with no priority below any prioritized task', () => {
    const tasks = [
      task({ id: 'none', created_at: 1 }),
      task({ id: 'low', priority: 1, created_at: 1 }),
    ]
    expect(rankNow(tasks).map((t) => t.id)).toEqual(['low', 'none'])
  })

  it('breaks priority ties by created_at ascending (oldest first)', () => {
    const tasks = [
      task({ id: 'newer', priority: 2, created_at: 200 }),
      task({ id: 'older', priority: 2, created_at: 100 }),
    ]
    expect(rankNow(tasks).map((t) => t.id)).toEqual(['older', 'newer'])
  })

  it('excludes done tasks', () => {
    const tasks = [
      task({ id: 'open', priority: 1, created_at: 1 }),
      task({ id: 'closed', priority: 3, created_at: 1, done: true }),
    ]
    expect(rankNow(tasks).map((t) => t.id)).toEqual(['open'])
  })

  it('returns [] for empty input', () => {
    expect(rankNow([])).toEqual([])
  })

  it('does not mutate the caller array', () => {
    const tasks = [
      task({ id: 'a', priority: 1, created_at: 1 }),
      task({ id: 'b', priority: 3, created_at: 1 }),
    ]
    const before = tasks.map((t) => t.id)
    rankNow(tasks)
    expect(tasks.map((t) => t.id)).toEqual(before)
  })
})
