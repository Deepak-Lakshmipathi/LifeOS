import { describe, it, expect } from 'vitest'
import type { Task } from '../types'
import type { Domain } from '../data/domains'
import { DOMAINS } from '../data/domains'
import type { WarmthState } from '../warmth/computeWarmth'
import { rankNow, DOMAIN_CAP_DEFAULT } from './rankNow'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal Task factory — only the fields rankNow reads matter. */
function task(over: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: over.id,
    done: false,
    created_at: 0,
    ...over,
  }
}

/** All-warm baseline warmth map — no rescue eligible domain. */
function allWarm(): Record<Domain, WarmthState> {
  return Object.fromEntries(DOMAINS.map((d) => [d, 'warm' as WarmthState])) as Record<
    Domain,
    WarmthState
  >
}

/** Build a warmth map from a baseline of 'warm' with specific overrides. */
function warmthWith(
  overrides: Partial<Record<Domain, WarmthState>>,
): Record<Domain, WarmthState> {
  return { ...allWarm(), ...overrides }
}

// ---------------------------------------------------------------------------
// S6 ordering — must survive the new signature unchanged (regression guard)
// ---------------------------------------------------------------------------

describe('rankNow — S6 ordering (regression)', () => {
  it('orders by priority descending (3 before 2 before 1)', () => {
    const tasks = [
      task({ id: 'p1', priority: 1, created_at: 1 }),
      task({ id: 'p3', priority: 3, created_at: 1 }),
      task({ id: 'p2', priority: 2, created_at: 1 }),
    ]
    expect(rankNow(tasks, allWarm()).map((r) => r.task.id)).toEqual(['p3', 'p2', 'p1'])
  })

  it('sinks tasks with no priority below any prioritized task', () => {
    const tasks = [
      task({ id: 'none', created_at: 1 }),
      task({ id: 'low', priority: 1, created_at: 1 }),
    ]
    expect(rankNow(tasks, allWarm()).map((r) => r.task.id)).toEqual(['low', 'none'])
  })

  it('breaks priority ties by created_at ascending (oldest first)', () => {
    const tasks = [
      task({ id: 'newer', priority: 2, created_at: 200 }),
      task({ id: 'older', priority: 2, created_at: 100 }),
    ]
    expect(rankNow(tasks, allWarm()).map((r) => r.task.id)).toEqual(['older', 'newer'])
  })

  it('excludes done tasks', () => {
    const tasks = [
      task({ id: 'open', priority: 1, created_at: 1 }),
      task({ id: 'closed', priority: 3, created_at: 1, done: true }),
    ]
    expect(rankNow(tasks, allWarm()).map((r) => r.task.id)).toEqual(['open'])
  })

  it('returns [] for empty input', () => {
    expect(rankNow([], allWarm())).toEqual([])
  })

  it('does not mutate the caller array', () => {
    const tasks = [
      task({ id: 'a', priority: 1, created_at: 1 }),
      task({ id: 'b', priority: 3, created_at: 1 }),
    ]
    const before = tasks.map((t) => t.id)
    rankNow(tasks, allWarm())
    expect(tasks.map((t) => t.id)).toEqual(before)
  })

  it('all returned entries have rescue:false when no cold domain', () => {
    const tasks = [
      task({ id: 'a', priority: 3, domain: 'Career' }),
      task({ id: 'b', priority: 2, domain: 'Growth' }),
    ]
    const result = rankNow(tasks, allWarm())
    expect(result.every((r) => r.rescue === false)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Per-domain cap
// ---------------------------------------------------------------------------

describe('rankNow — per-domain cap', () => {
  it(`caps at DOMAIN_CAP_DEFAULT (${DOMAIN_CAP_DEFAULT}) tasks per domain`, () => {
    const tasks = [
      task({ id: 'c1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'c2', priority: 2, created_at: 2, domain: 'Career' }),
      task({ id: 'c3', priority: 1, created_at: 3, domain: 'Career' }), // should be capped
      task({ id: 'g1', priority: 3, created_at: 1, domain: 'Growth' }),
    ]
    const result = rankNow(tasks, allWarm())
    const ids = result.map((r) => r.task.id)
    // Career capped at 2: c1, c2 in; c3 out. Growth: g1 in.
    expect(ids).toContain('c1')
    expect(ids).toContain('c2')
    expect(ids).not.toContain('c3')
    expect(ids).toContain('g1')
  })

  it('respects a custom domainCap option', () => {
    const tasks = [
      task({ id: 'c1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'c2', priority: 2, created_at: 2, domain: 'Career' }),
      task({ id: 'c3', priority: 1, created_at: 3, domain: 'Career' }),
    ]
    const result = rankNow(tasks, allWarm(), { domainCap: 1 })
    const ids = result.map((r) => r.task.id)
    expect(ids).toContain('c1')
    expect(ids).not.toContain('c2')
    expect(ids).not.toContain('c3')
  })

  it('domain-less (inbox) tasks are never capped', () => {
    // 5 inbox tasks — all should appear
    const tasks = Array.from({ length: 5 }, (_, i) =>
      task({ id: `inbox-${i}`, priority: 1, created_at: i }),
    )
    const result = rankNow(tasks, allWarm())
    expect(result).toHaveLength(5)
  })

  it('admits all tasks when fewer than cap tasks per domain', () => {
    const tasks = [
      task({ id: 'c1', priority: 3, domain: 'Career' }),
      task({ id: 'g1', priority: 2, domain: 'Growth' }),
    ]
    expect(rankNow(tasks, allWarm())).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Rescue injection
// ---------------------------------------------------------------------------

describe('rankNow — rescue injection', () => {
  it('injects exactly one rescue task from the coldest domain', () => {
    // Career has 3 tasks; cap=2 so c3 is excluded. Career is cold → c3 rescued.
    const tasks = [
      task({ id: 'c1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'c2', priority: 2, created_at: 2, domain: 'Career' }),
      task({ id: 'c3', priority: 1, created_at: 3, domain: 'Career' }),
    ]
    const result = rankNow(tasks, warmthWith({ Career: 'cold' }))
    const rescue = result.filter((r) => r.rescue)
    expect(rescue).toHaveLength(1)
    expect(rescue[0].task.id).toBe('c3')
  })

  it('rescue task is marked with rescue:true; others with rescue:false', () => {
    const tasks = [
      task({ id: 'c1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'c2', priority: 2, created_at: 2, domain: 'Career' }),
      task({ id: 'c3', priority: 1, created_at: 3, domain: 'Career' }),
    ]
    const result = rankNow(tasks, warmthWith({ Career: 'cold' }))
    const main = result.filter((r) => !r.rescue)
    const rescue = result.filter((r) => r.rescue)
    expect(main.every((r) => r.rescue === false)).toBe(true)
    expect(rescue).toHaveLength(1)
    expect(rescue[0].rescue).toBe(true)
  })

  it('rescue task is appended after the admitted set', () => {
    const tasks = [
      task({ id: 'c1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'c2', priority: 2, created_at: 2, domain: 'Career' }),
      task({ id: 'c3', priority: 1, created_at: 3, domain: 'Career' }),
    ]
    const result = rankNow(tasks, warmthWith({ Career: 'cold' }))
    expect(result[result.length - 1].rescue).toBe(true)
    expect(result[result.length - 1].task.id).toBe('c3')
  })

  it('no rescue when no cold or stale domain exists (all warm)', () => {
    const tasks = [
      task({ id: 'c1', priority: 3, domain: 'Career' }),
      task({ id: 'c2', priority: 2, domain: 'Career' }),
      task({ id: 'c3', priority: 1, domain: 'Career' }),
    ]
    const result = rankNow(tasks, allWarm()) // all warm — no rescue
    expect(result.filter((r) => r.rescue)).toHaveLength(0)
  })

  it('no rescue when no cold/stale domain but ok/warm/hot exist', () => {
    const tasks = [task({ id: 'a', domain: 'Career' })]
    const result = rankNow(tasks, warmthWith({ Career: 'ok' }))
    expect(result.filter((r) => r.rescue)).toHaveLength(0)
  })

  it('no rescue when cold domain has no open tasks', () => {
    // Career is cold but all its tasks are done — nothing to rescue.
    const tasks = [
      task({ id: 'c1', done: true, domain: 'Career' }),
      task({ id: 'g1', priority: 2, domain: 'Growth' }),
    ]
    const result = rankNow(tasks, warmthWith({ Career: 'cold' }))
    expect(result.filter((r) => r.rescue)).toHaveLength(0)
  })

  it('no rescue when all cold domain tasks are already admitted (under cap)', () => {
    // Career is cold but only has 1 task — it's already admitted, nothing left to rescue.
    const tasks = [task({ id: 'c1', priority: 3, domain: 'Career' })]
    const result = rankNow(tasks, warmthWith({ Career: 'cold' }))
    // c1 is admitted; no uncapped task remains → no rescue entry
    expect(result.filter((r) => r.rescue)).toHaveLength(0)
    // c1 is in the main set
    expect(result).toHaveLength(1)
    expect(result[0].task.id).toBe('c1')
    expect(result[0].rescue).toBe(false)
  })

  it('rescue is never a duplicate of an admitted task', () => {
    // Career: 2 tasks (exactly at cap); both are admitted. Cold domain but no overflow.
    const tasks = [
      task({ id: 'c1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'c2', priority: 2, created_at: 2, domain: 'Career' }),
    ]
    const result = rankNow(tasks, warmthWith({ Career: 'cold' }), { domainCap: 2 })
    const admittedIds = result.filter((r) => !r.rescue).map((r) => r.task.id)
    const rescueEntry = result.find((r) => r.rescue)
    // Both tasks admitted; nothing to rescue
    expect(rescueEntry).toBeUndefined()
    expect(admittedIds).toContain('c1')
    expect(admittedIds).toContain('c2')
  })

  it('picks the coldest (cold) domain over a stale domain', () => {
    // Finance=cold, Career=stale — rescue should come from Finance.
    const tasks = [
      task({ id: 'f1', priority: 3, created_at: 1, domain: 'Finance' }),
      task({ id: 'f2', priority: 2, created_at: 2, domain: 'Finance' }),
      task({ id: 'f3', priority: 1, created_at: 3, domain: 'Finance' }),
      task({ id: 'c1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'c2', priority: 2, created_at: 2, domain: 'Career' }),
      task({ id: 'c3', priority: 1, created_at: 3, domain: 'Career' }),
    ]
    const result = rankNow(
      tasks,
      warmthWith({ Finance: 'cold', Career: 'stale' }),
    )
    const rescue = result.find((r) => r.rescue)
    expect(rescue).toBeDefined()
    expect(rescue!.task.domain).toBe('Finance')
  })

  it('picks the best (highest priority, then oldest) task from the cold domain as rescue', () => {
    // Career cold, cap=2: c1+c2 admitted; c3(p:2,old) and c4(p:1,new) remain.
    // Best remaining = c3 (higher priority).
    const tasks = [
      task({ id: 'c1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'c2', priority: 3, created_at: 2, domain: 'Career' }),
      task({ id: 'c3', priority: 2, created_at: 3, domain: 'Career' }),
      task({ id: 'c4', priority: 1, created_at: 4, domain: 'Career' }),
    ]
    const result = rankNow(tasks, warmthWith({ Career: 'cold' }), { domainCap: 2 })
    const rescue = result.find((r) => r.rescue)
    expect(rescue?.task.id).toBe('c3')
  })

  it('stale domain also triggers rescue', () => {
    const tasks = [
      task({ id: 'g1', priority: 3, created_at: 1, domain: 'Growth' }),
      task({ id: 'g2', priority: 2, created_at: 2, domain: 'Growth' }),
      task({ id: 'g3', priority: 1, created_at: 3, domain: 'Growth' }),
    ]
    const result = rankNow(tasks, warmthWith({ Growth: 'stale' }))
    expect(result.filter((r) => r.rescue)).toHaveLength(1)
    expect(result.find((r) => r.rescue)!.task.id).toBe('g3')
  })

  it('empty task list produces no rescue and empty result', () => {
    // Even with a cold domain, no tasks to rescue.
    const result = rankNow([], warmthWith({ Career: 'cold' }))
    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Integration: cap + rescue together
// ---------------------------------------------------------------------------

describe('rankNow — cap + rescue integration', () => {
  it('multi-domain scenario: cap applied per-domain, one rescue from coldest', () => {
    const tasks = [
      // Career (warm): 3 tasks → cap=2 admits c1, c2; c3 excluded
      task({ id: 'c1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'c2', priority: 2, created_at: 2, domain: 'Career' }),
      task({ id: 'c3', priority: 1, created_at: 3, domain: 'Career' }),
      // Finance (cold): 3 tasks → cap=2 admits f1, f2; f3 excluded → rescue
      task({ id: 'f1', priority: 3, created_at: 1, domain: 'Finance' }),
      task({ id: 'f2', priority: 2, created_at: 2, domain: 'Finance' }),
      task({ id: 'f3', priority: 1, created_at: 3, domain: 'Finance' }),
      // Growth (hot): 1 task → admitted, no rescue from here
      task({ id: 'g1', priority: 2, created_at: 1, domain: 'Growth' }),
    ]
    const result = rankNow(
      tasks,
      warmthWith({ Finance: 'cold', Growth: 'hot' }),
    )
    const mainIds = result.filter((r) => !r.rescue).map((r) => r.task.id)
    const rescue = result.find((r) => r.rescue)

    // Career: c1, c2 in; c3 excluded
    expect(mainIds).toContain('c1')
    expect(mainIds).toContain('c2')
    expect(mainIds).not.toContain('c3')
    // Finance: f1, f2 in; f3 excluded but becomes rescue
    expect(mainIds).toContain('f1')
    expect(mainIds).toContain('f2')
    expect(mainIds).not.toContain('f3')
    // Growth: g1 in
    expect(mainIds).toContain('g1')
    // Rescue from Finance (coldest cold)
    expect(rescue).toBeDefined()
    expect(rescue!.task.id).toBe('f3')
    expect(rescue!.task.domain).toBe('Finance')
  })

  it('result has exactly one rescue entry', () => {
    // Two cold domains — only one rescue task should appear.
    const tasks = [
      task({ id: 'c1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'c2', priority: 2, created_at: 2, domain: 'Career' }),
      task({ id: 'c3', priority: 1, created_at: 3, domain: 'Career' }),
      task({ id: 'f1', priority: 3, created_at: 1, domain: 'Finance' }),
      task({ id: 'f2', priority: 2, created_at: 2, domain: 'Finance' }),
      task({ id: 'f3', priority: 1, created_at: 3, domain: 'Finance' }),
    ]
    const result = rankNow(tasks, warmthWith({ Career: 'cold', Finance: 'cold' }))
    expect(result.filter((r) => r.rescue)).toHaveLength(1)
  })
})
