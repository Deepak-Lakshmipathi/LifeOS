import { describe, it, expect } from 'vitest'
import { distinctProjects } from '../lib/distinctProjects'
import type { Task } from '../types'

function makeTask(overrides: Partial<Task> & { title: string }): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: overrides.title,
    done: false,
    created_at: Date.now(),
    project: overrides.project,
  }
}

describe('distinctProjects', () => {
  it('returns [] for empty task list', () => {
    expect(distinctProjects([])).toEqual([])
  })

  it('returns [] when no tasks have a project', () => {
    const tasks = [makeTask({ title: 'A' }), makeTask({ title: 'B' })]
    expect(distinctProjects(tasks)).toEqual([])
  })

  it('drops empty/whitespace project values', () => {
    const tasks = [
      makeTask({ title: 'A', project: '' }),
      makeTask({ title: 'B', project: '   ' }),
    ]
    expect(distinctProjects(tasks)).toEqual([])
  })

  it('trims project values before deduplication', () => {
    const tasks = [
      makeTask({ title: 'A', project: '  Work  ' }),
      makeTask({ title: 'B', project: 'Work' }),
    ]
    const result = distinctProjects(tasks)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('Work')
  })

  it('deduplicates case-insensitively (first-seen casing wins)', () => {
    const tasks = [
      makeTask({ title: 'A', project: 'Work' }),
      makeTask({ title: 'B', project: 'work' }),
      makeTask({ title: 'C', project: 'WORK' }),
    ]
    const result = distinctProjects(tasks)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('Work') // first-seen casing
  })

  it('sorts the results', () => {
    const tasks = [
      makeTask({ title: 'A', project: 'Zebra' }),
      makeTask({ title: 'B', project: 'alpha' }),
      makeTask({ title: 'C', project: 'Beta' }),
    ]
    const result = distinctProjects(tasks)
    expect(result).toEqual(['alpha', 'Beta', 'Zebra'])
  })

  it('returns all distinct projects when no duplicates', () => {
    const tasks = [
      makeTask({ title: 'A', project: 'Work' }),
      makeTask({ title: 'B', project: 'Personal' }),
      makeTask({ title: 'C', project: 'Health' }),
    ]
    const result = distinctProjects(tasks)
    expect(result).toHaveLength(3)
    expect(result).toContain('Work')
    expect(result).toContain('Personal')
    expect(result).toContain('Health')
  })

  it('ignores tasks without a project field', () => {
    const tasks = [
      makeTask({ title: 'No project' }),
      makeTask({ title: 'Has project', project: 'Work' }),
    ]
    const result = distinctProjects(tasks)
    expect(result).toEqual(['Work'])
  })
})
