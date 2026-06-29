import { describe, it, expect } from 'vitest'
import { groupByProject, INBOX_LABEL } from '../lib/groupByProject'
import type { Task } from '../types'

function makeTask(overrides: Partial<Task> & { title: string }): Task {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    title: overrides.title,
    done: overrides.done ?? false,
    created_at: overrides.created_at ?? Date.now(),
    done_when: overrides.done_when,
    priority: overrides.priority,
    project: overrides.project,
  }
}

describe('groupByProject', () => {
  it('returns [] for empty input', () => {
    expect(groupByProject([])).toEqual([])
  })

  it('puts unparented tasks in Inbox bucket (key null, label INBOX_LABEL)', () => {
    const t1 = makeTask({ title: 'Unparented 1' })
    const t2 = makeTask({ title: 'Unparented 2' })
    const groups = groupByProject([t1, t2])

    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBeNull()
    expect(groups[0].label).toBe(INBOX_LABEL)
    expect(groups[0].tasks).toHaveLength(2)
  })

  it('groups tasks with the same project name together', () => {
    const t1 = makeTask({ title: 'Work task 1', project: 'Work' })
    const t2 = makeTask({ title: 'Work task 2', project: 'Work' })
    const t3 = makeTask({ title: 'Personal task', project: 'Personal' })
    const groups = groupByProject([t1, t2, t3])

    const workGroup = groups.find((g) => g.key === 'Work')
    expect(workGroup).toBeDefined()
    expect(workGroup!.tasks).toHaveLength(2)
    expect(workGroup!.tasks.map((t) => t.title)).toEqual(['Work task 1', 'Work task 2'])
  })

  it('preserves within-group order from the input (no re-sort within group)', () => {
    const t1 = makeTask({ id: 'a', title: 'First', project: 'Work' })
    const t2 = makeTask({ id: 'b', title: 'Second', project: 'Work' })
    const t3 = makeTask({ id: 'c', title: 'Third', project: 'Work' })
    const groups = groupByProject([t1, t2, t3])

    expect(groups[0].tasks.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('Inbox group comes first even when named groups exist', () => {
    const t1 = makeTask({ title: 'Named', project: 'Alpha' })
    const t2 = makeTask({ title: 'Unparented' })
    const groups = groupByProject([t1, t2])

    expect(groups[0].key).toBeNull()
    expect(groups[0].label).toBe(INBOX_LABEL)
    expect(groups[1].key).toBe('Alpha')
  })

  it('Inbox-first is deterministic regardless of input order', () => {
    const t1 = makeTask({ title: 'Unparented' })
    const t2 = makeTask({ title: 'Named', project: 'Zeta' })
    // Unparented comes second in input
    const groups = groupByProject([t2, t1])

    expect(groups[0].key).toBeNull()
    expect(groups[1].key).toBe('Zeta')
  })

  it('named groups are sorted case-insensitive locale-aware', () => {
    const t1 = makeTask({ title: 'T1', project: 'zebra' })
    const t2 = makeTask({ title: 'T2', project: 'Alpha' })
    const t3 = makeTask({ title: 'T3', project: 'beta' })
    const groups = groupByProject([t1, t2, t3])

    const namedLabels = groups.filter((g) => g.key !== null).map((g) => g.label)
    expect(namedLabels).toEqual(['Alpha', 'beta', 'zebra'])
  })

  it('only emits Inbox when all tasks are unparented', () => {
    const tasks = [
      makeTask({ title: 'A' }),
      makeTask({ title: 'B' }),
    ]
    const groups = groupByProject(tasks)
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBeNull()
  })

  it('does not emit empty Inbox when all tasks have a project', () => {
    const tasks = [
      makeTask({ title: 'A', project: 'Work' }),
      makeTask({ title: 'B', project: 'Work' }),
    ]
    const groups = groupByProject(tasks)
    expect(groups.every((g) => g.key !== null)).toBe(true)
  })
})
