/**
 * dayStats tests (Slice S29). Covers the numbered DoD:
 *  2. dayStats counts correct on fixture (N tasks completed today, M of
 *     them mission picks, K distinct domains) — unit-tested.
 */
import { describe, it, expect } from 'vitest'
import type { Task } from '../types'
import { dayStats } from './dayStats'

const NOW = new Date(2024, 0, 15, 20, 0, 0).getTime() // 15 Jan 2024, 20:00 local
const TODAY_9AM = new Date(2024, 0, 15, 9, 0, 0).getTime()
const YESTERDAY_9PM = new Date(2024, 0, 14, 21, 0, 0).getTime()

function task(over: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: over.id,
    done: false,
    created_at: 0,
    ...over,
  }
}

describe('dayStats', () => {
  it('all-zero on an empty task list', () => {
    expect(dayStats([], NOW)).toEqual({ missionDone: 0, tasksCompleted: 0, domainsWarmed: 0 })
  })

  it('counts only tasks completed today (not yesterday, not still-open)', () => {
    const tasks = [
      task({ id: 'a', done: true, completed_at: TODAY_9AM, domain: 'Career' }),
      task({ id: 'b', done: true, completed_at: YESTERDAY_9PM, domain: 'Growth' }),
      task({ id: 'c', done: false, domain: 'Finance' }),
    ]
    const stats = dayStats(tasks, NOW)
    expect(stats.tasksCompleted).toBe(1)
  })

  it('counts distinct domains warmed today (dedupes repeats within the same domain)', () => {
    const tasks = [
      task({ id: 'a', done: true, completed_at: TODAY_9AM, domain: 'Career' }),
      task({ id: 'b', done: true, completed_at: TODAY_9AM, domain: 'Career' }),
      task({ id: 'c', done: true, completed_at: TODAY_9AM, domain: 'Growth' }),
      task({ id: 'd', done: true, completed_at: TODAY_9AM }), // domain-less — not counted
    ]
    const stats = dayStats(tasks, NOW)
    expect(stats.tasksCompleted).toBe(4)
    expect(stats.domainsWarmed).toBe(2) // Career, Growth
  })

  it('missionDone counts completions that were still a mission pick at completion time', () => {
    // Only one open Career task all day -> it's the sole mission pick.
    // Completing it today should count as a mission-pick completion.
    const tasks = [task({ id: 'a', priority: 3, created_at: 1, domain: 'Career', done: true, completed_at: TODAY_9AM })]
    const stats = dayStats(tasks, NOW)
    expect(stats.missionDone).toBe(1)
    expect(stats.tasksCompleted).toBe(1)
  })

  it('missionDone excludes a completed task that would not have been a mission pick (crowded out)', () => {
    // 3 higher-priority Career tasks (domain cap 2) admit only 2 into rankNow;
    // a 3rd, lower-priority Career task completing today is not a mission
    // pick even though it finished.
    const tasks = [
      task({ id: 'p1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'p2', priority: 2, created_at: 2, domain: 'Career' }),
      task({
        id: 'p3',
        priority: 1,
        created_at: 3,
        domain: 'Career',
        done: true,
        completed_at: TODAY_9AM,
      }),
    ]
    const stats = dayStats(tasks, NOW)
    expect(stats.tasksCompleted).toBe(1)
    expect(stats.missionDone).toBe(0)
  })

  it('N tasks completed today, M of them mission picks, K distinct domains — combined fixture', () => {
    const tasks = [
      // Mission-pick completions (top of their domain, admitted by rankNow):
      task({ id: 'm1', priority: 3, created_at: 1, domain: 'Career', done: true, completed_at: TODAY_9AM }),
      task({ id: 'm2', priority: 3, created_at: 2, domain: 'Growth', done: true, completed_at: TODAY_9AM }),
      // Non-mission-pick completion (domain-less task always admitted, but
      // still counts toward tasksCompleted, not domainsWarmed):
      task({ id: 'x1', done: true, completed_at: TODAY_9AM }),
      // Not completed today — excluded entirely:
      task({ id: 'old', done: true, completed_at: YESTERDAY_9PM, domain: 'Finance' }),
      task({ id: 'open', done: false, domain: 'Body & Mind' }),
    ]
    const stats = dayStats(tasks, NOW)
    expect(stats.tasksCompleted).toBe(3) // m1, m2, x1
    expect(stats.missionDone).toBe(3) // m1, m2, x1 (domain-less is never capped, so it's a pick too)
    expect(stats.domainsWarmed).toBe(2) // Career, Growth (x1 has no domain)
  })
})
