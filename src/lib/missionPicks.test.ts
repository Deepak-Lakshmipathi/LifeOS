import { describe, it, expect } from 'vitest'
import type { Task } from '../types'
import type { Domain } from '../data/domains'
import { DOMAINS } from '../data/domains'
import type { WarmthState } from '../warmth/computeWarmth'
import { missionPicks, MAX_PICKS } from './missionPicks'

// ---------------------------------------------------------------------------
// Helpers (mirrors rankNow.test.ts conventions)
// ---------------------------------------------------------------------------

/** Minimal Task factory — only the fields missionPicks/rankNow read matter. */
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

function warmthWith(overrides: Partial<Record<Domain, WarmthState>>): Record<Domain, WarmthState> {
  return { ...allWarm(), ...overrides }
}

describe('missionPicks — cap at MAX_PICKS (3)', () => {
  it('returns at most 3 picks even with many open tasks', () => {
    const tasks = Array.from({ length: 6 }, (_, i) =>
      task({ id: `t${i}`, priority: 2, created_at: i, domain: 'Growth' }),
    )
    const result = missionPicks(tasks, allWarm())
    expect(result.picks.length).toBeLessThanOrEqual(MAX_PICKS)
  })

  it('returns fewer than 3 when fewer tasks exist', () => {
    const tasks = [task({ id: 'a', priority: 3, domain: 'Career' })]
    const result = missionPicks(tasks, allWarm())
    expect(result.picks).toHaveLength(1)
  })

  it('returns 0 picks for empty input', () => {
    const result = missionPicks([], allWarm())
    expect(result.picks).toHaveLength(0)
  })
})

describe('missionPicks — rescue injection', () => {
  it('injects exactly one rescue pick when the coldest domain is unrepresented and has an open task', () => {
    // Finance (cold) has 3 open tasks; the per-domain cap (2) admits f1+f2
    // into the main queue, leaving f3 excluded — cold Finance rescues it.
    const tasks = [
      task({ id: 'f1', priority: 3, created_at: 1, domain: 'Finance' }),
      task({ id: 'f2', priority: 2, created_at: 2, domain: 'Finance' }),
      task({ id: 'f3', priority: 1, created_at: 3, domain: 'Finance' }),
    ]
    const result = missionPicks(tasks, warmthWith({ Finance: 'cold' }))
    const rescuePicks = result.picks.filter((p) => p.rescue)
    expect(rescuePicks).toHaveLength(1)
    expect(rescuePicks[0].task.id).toBe('f3')
    expect(rescuePicks[0].task.domain).toBe('Finance')
  })

  it('does not inject a rescue pick when no domain is cold or stale', () => {
    const tasks = [
      task({ id: 'c1', priority: 3, domain: 'Career' }),
      task({ id: 'g1', priority: 2, domain: 'Growth' }),
    ]
    const result = missionPicks(tasks, allWarm())
    expect(result.picks.every((p) => !p.rescue)).toBe(true)
  })

  it('rescue pick counts toward the 3-pick cap (never exceeds MAX_PICKS)', () => {
    // 4 Career tasks (cap 2 admitted) + 3 Finance tasks (cap 2 admitted, 1 excluded → rescue).
    const tasks = [
      task({ id: 'c1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'c2', priority: 3, created_at: 2, domain: 'Career' }),
      task({ id: 'c3', priority: 2, created_at: 3, domain: 'Career' }),
      task({ id: 'c4', priority: 1, created_at: 4, domain: 'Career' }),
      task({ id: 'f1', priority: 3, created_at: 5, domain: 'Finance' }),
      task({ id: 'f2', priority: 2, created_at: 6, domain: 'Finance' }),
      task({ id: 'f3', priority: 1, created_at: 7, domain: 'Finance' }),
    ]
    const result = missionPicks(tasks, warmthWith({ Finance: 'cold' }))
    expect(result.picks.length).toBeLessThanOrEqual(MAX_PICKS)
    expect(result.picks.filter((p) => p.rescue)).toHaveLength(1)
  })

  it('rescue pick is always the last entry in picks', () => {
    const tasks = [
      task({ id: 'c1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'f1', priority: 3, created_at: 2, domain: 'Finance' }),
      task({ id: 'f2', priority: 2, created_at: 3, domain: 'Finance' }),
      task({ id: 'f3', priority: 1, created_at: 4, domain: 'Finance' }),
    ]
    const result = missionPicks(tasks, warmthWith({ Finance: 'cold' }))
    expect(result.picks[result.picks.length - 1].rescue).toBe(true)
  })
})

describe('missionPicks — veto exclusion', () => {
  it('excludes a vetoed task and pulls the next-ranked task into its place', () => {
    const tasks = [
      task({ id: 'p3', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'p2', priority: 2, created_at: 2, domain: 'Growth' }),
      task({ id: 'p1', priority: 1, created_at: 3, domain: 'Body & Mind' }),
    ]
    const before = missionPicks(tasks, allWarm())
    expect(before.picks.map((p) => p.task.id)).toEqual(['p3', 'p2', 'p1'])

    const after = missionPicks(tasks, allWarm(), new Set(['p3']))
    expect(after.picks.map((p) => p.task.id)).toEqual(['p2', 'p1'])
  })

  it('excludes a vetoed rescue pick without resurfacing it', () => {
    const tasks = [
      task({ id: 'f1', priority: 3, created_at: 1, domain: 'Finance' }),
      task({ id: 'f2', priority: 2, created_at: 2, domain: 'Finance' }),
      task({ id: 'f3', priority: 1, created_at: 3, domain: 'Finance' }),
    ]
    const result = missionPicks(tasks, warmthWith({ Finance: 'cold' }), new Set(['f3']))
    expect(result.picks.some((p) => p.task.id === 'f3')).toBe(false)
    expect(result.picks.every((p) => !p.rescue)).toBe(true)
  })

  it('defaults to no vetoes when the argument is omitted', () => {
    const tasks = [task({ id: 'a', priority: 3, domain: 'Career' })]
    const result = missionPicks(tasks, allWarm())
    expect(result.picks.map((p) => p.task.id)).toEqual(['a'])
  })
})

describe('missionPicks — why + done_when composition (§8)', () => {
  it('every pick carries a non-empty why line', () => {
    const tasks = [
      task({ id: 'a', priority: 3, domain: 'Career', project: 'NorthStar' }),
      task({ id: 'b', priority: 2, domain: 'Growth' }),
    ]
    const result = missionPicks(tasks, allWarm())
    for (const pick of result.picks) {
      expect(pick.why.length).toBeGreaterThan(0)
    }
  })

  it('why line references the project when the task has one', () => {
    const tasks = [task({ id: 'a', priority: 3, domain: 'Career', project: 'NorthStar' })]
    const result = missionPicks(tasks, allWarm())
    expect(result.picks[0].why).toContain('NorthStar')
  })

  it('the rescue why line is distinct from a normal pick, honestly framing neglect', () => {
    const tasks = [
      task({ id: 'c1', priority: 3, created_at: 1, domain: 'Career' }),
      task({ id: 'f1', priority: 3, created_at: 2, domain: 'Finance' }),
      task({ id: 'f2', priority: 2, created_at: 3, domain: 'Finance' }),
      task({ id: 'f3', priority: 1, created_at: 4, domain: 'Finance' }),
    ]
    const result = missionPicks(tasks, warmthWith({ Finance: 'cold' }))
    const rescue = result.picks.find((p) => p.rescue)!
    const normal = result.picks.find((p) => !p.rescue)!
    expect(rescue.why).not.toEqual(normal.why)
  })
})

describe('missionPicks — purity', () => {
  it('does not mutate the input task array', () => {
    const tasks = [
      task({ id: 'a', priority: 1, created_at: 1 }),
      task({ id: 'b', priority: 3, created_at: 1 }),
    ]
    const before = tasks.map((t) => t.id)
    missionPicks(tasks, allWarm())
    expect(tasks.map((t) => t.id)).toEqual(before)
  })
})
