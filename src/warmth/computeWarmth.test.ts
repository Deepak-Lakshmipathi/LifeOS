import { describe, it, expect } from 'vitest'
import type { Task } from '../types'
import { computeWarmth, WARMTH_THRESHOLDS, type WarmthState } from './computeWarmth'
import { DOMAINS } from '../data/domains'
import type { Domain } from '../data/domains'

// Fixed clock: 2025-01-01T00:00:00.000Z
const NOW = new Date('2025-01-01T00:00:00.000Z').getTime()

const DAY_MS = 24 * 60 * 60 * 1000

/** Minimal Task factory — only fields computeWarmth reads. */
function task(over: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: over.id,
    done: true,
    created_at: 0,
    ...over,
  }
}

describe('computeWarmth', () => {
  // ---------------------------------------------------------------------------
  // All-domains coverage
  // ---------------------------------------------------------------------------

  it('returns all 7 domains in the result', () => {
    const result = computeWarmth([], NOW)
    expect(Object.keys(result)).toHaveLength(DOMAINS.length)
    for (const d of DOMAINS) {
      expect(result).toHaveProperty(d)
    }
  })

  // ---------------------------------------------------------------------------
  // "never completed" = cold
  // ---------------------------------------------------------------------------

  it('rates a domain as cold when no task in it has ever been completed', () => {
    // Task exists but has no completed_at
    const tasks = [task({ id: 't1', domain: 'Career' })]
    const result = computeWarmth(tasks, NOW)
    expect(result['Career']).toBe('cold')
  })

  it('rates a domain as cold when there are no tasks at all', () => {
    const result = computeWarmth([], NOW)
    for (const d of DOMAINS) {
      expect(result[d]).toBe('cold')
    }
  })

  it('rates a domain as cold when completed_at is undefined even if done=true', () => {
    const tasks = [task({ id: 't1', domain: 'Finance', done: true })]
    const result = computeWarmth(tasks, NOW)
    expect(result['Finance']).toBe('cold')
  })

  // ---------------------------------------------------------------------------
  // hot — completed within 2 days
  // ---------------------------------------------------------------------------

  it('rates hot when completed exactly 1 day ago', () => {
    const tasks = [task({ id: 't1', domain: 'Growth', completed_at: NOW - 1 * DAY_MS })]
    expect(computeWarmth(tasks, NOW)['Growth']).toBe('hot')
  })

  it('rates hot at the threshold boundary (exactly 2 days ago)', () => {
    const tasks = [task({ id: 't1', domain: 'Growth', completed_at: NOW - WARMTH_THRESHOLDS.hot })]
    expect(computeWarmth(tasks, NOW)['Growth']).toBe('hot')
  })

  it('rates warm when completed 1 ms past the hot threshold', () => {
    const tasks = [task({ id: 't1', domain: 'Growth', completed_at: NOW - WARMTH_THRESHOLDS.hot - 1 })]
    expect(computeWarmth(tasks, NOW)['Growth']).toBe('warm')
  })

  // ---------------------------------------------------------------------------
  // warm — completed within 5 days
  // ---------------------------------------------------------------------------

  it('rates warm when completed 3 days ago', () => {
    const tasks = [task({ id: 't1', domain: 'Career', completed_at: NOW - 3 * DAY_MS })]
    expect(computeWarmth(tasks, NOW)['Career']).toBe('warm')
  })

  it('rates warm at the 5-day boundary', () => {
    const tasks = [task({ id: 't1', domain: 'Career', completed_at: NOW - WARMTH_THRESHOLDS.warm })]
    expect(computeWarmth(tasks, NOW)['Career']).toBe('warm')
  })

  // ---------------------------------------------------------------------------
  // ok — completed within 10 days
  // ---------------------------------------------------------------------------

  it('rates ok when completed 7 days ago', () => {
    const tasks = [task({ id: 't1', domain: 'Body & Mind', completed_at: NOW - 7 * DAY_MS })]
    expect(computeWarmth(tasks, NOW)['Body & Mind']).toBe('ok')
  })

  it('rates ok at the 10-day boundary', () => {
    const tasks = [task({ id: 't1', domain: 'Body & Mind', completed_at: NOW - WARMTH_THRESHOLDS.ok })]
    expect(computeWarmth(tasks, NOW)['Body & Mind']).toBe('ok')
  })

  // ---------------------------------------------------------------------------
  // stale — completed within 20 days
  // ---------------------------------------------------------------------------

  it('rates stale when completed 15 days ago', () => {
    const tasks = [task({ id: 't1', domain: 'Life Admin', completed_at: NOW - 15 * DAY_MS })]
    expect(computeWarmth(tasks, NOW)['Life Admin']).toBe('stale')
  })

  it('rates stale at the 20-day boundary', () => {
    const tasks = [task({ id: 't1', domain: 'Life Admin', completed_at: NOW - WARMTH_THRESHOLDS.stale })]
    expect(computeWarmth(tasks, NOW)['Life Admin']).toBe('stale')
  })

  // ---------------------------------------------------------------------------
  // cold — older than 20 days
  // ---------------------------------------------------------------------------

  it('rates cold when completed 21 days ago', () => {
    const tasks = [task({ id: 't1', domain: 'Finance', completed_at: NOW - 21 * DAY_MS })]
    expect(computeWarmth(tasks, NOW)['Finance']).toBe('cold')
  })

  it('rates cold 1 ms past the stale threshold', () => {
    const tasks = [task({ id: 't1', domain: 'Relationship', completed_at: NOW - WARMTH_THRESHOLDS.stale - 1 })]
    expect(computeWarmth(tasks, NOW)['Relationship']).toBe('cold')
  })

  // ---------------------------------------------------------------------------
  // Multi-task domain — only the most recent completed_at is used
  // ---------------------------------------------------------------------------

  it('uses the most recent completed_at when a domain has multiple tasks', () => {
    const tasks = [
      task({ id: 'old', domain: 'Building Things', completed_at: NOW - 15 * DAY_MS }), // would be stale
      task({ id: 'new', domain: 'Building Things', completed_at: NOW - 1 * DAY_MS }),   // hot
    ]
    expect(computeWarmth(tasks, NOW)['Building Things']).toBe('hot')
  })

  it('ignores tasks without completed_at when computing the max', () => {
    const tasks = [
      task({ id: 'no-ts', domain: 'Building Things' }),                                  // no completed_at
      task({ id: 'old', domain: 'Building Things', completed_at: NOW - 15 * DAY_MS }),   // stale
    ]
    expect(computeWarmth(tasks, NOW)['Building Things']).toBe('stale')
  })

  // ---------------------------------------------------------------------------
  // Domain isolation — other domains unaffected
  // ---------------------------------------------------------------------------

  it('does not bleed warmth between domains', () => {
    const tasks = [
      task({ id: 'a', domain: 'Career', completed_at: NOW - 1 * DAY_MS }),  // hot
    ]
    const result = computeWarmth(tasks, NOW)
    expect(result['Career']).toBe('hot')
    // All other domains must be cold
    const others = DOMAINS.filter((d): d is Domain => d !== 'Career')
    for (const d of others) {
      expect(result[d]).toBe('cold')
    }
  })

  // ---------------------------------------------------------------------------
  // Determinism — fixed clock produces same result every call
  // ---------------------------------------------------------------------------

  it('is deterministic for the same inputs', () => {
    const tasks = [task({ id: 't1', domain: 'Finance', completed_at: NOW - 3 * DAY_MS })]
    expect(computeWarmth(tasks, NOW)).toEqual(computeWarmth(tasks, NOW))
  })

  // ---------------------------------------------------------------------------
  // Tasks without a domain are ignored
  // ---------------------------------------------------------------------------

  it('ignores tasks that have no domain', () => {
    const tasks = [task({ id: 't1', completed_at: NOW - 1 * DAY_MS })] // no domain
    const result = computeWarmth(tasks, NOW)
    for (const d of DOMAINS) {
      expect(result[d]).toBe('cold')
    }
  })

  // ---------------------------------------------------------------------------
  // All 5 states reachable in one call
  // ---------------------------------------------------------------------------

  it('can produce all 5 warmth states simultaneously', () => {
    const tasks: Task[] = [
      task({ id: 'hot',   domain: 'Building Things', completed_at: NOW - 1 * DAY_MS }),
      task({ id: 'warm',  domain: 'Career',          completed_at: NOW - 4 * DAY_MS }),
      task({ id: 'ok',    domain: 'Growth',           completed_at: NOW - 8 * DAY_MS }),
      task({ id: 'stale', domain: 'Life Admin',       completed_at: NOW - 15 * DAY_MS }),
      task({ id: 'cold',  domain: 'Body & Mind',      completed_at: NOW - 25 * DAY_MS }),
      // Finance + Relationship have no completed_at → cold
    ]
    const result = computeWarmth(tasks, NOW)
    const states: WarmthState[] = ['hot', 'warm', 'ok', 'stale', 'cold']
    const allStates = new Set(Object.values(result))
    for (const s of states) {
      expect(allStates.has(s)).toBe(true)
    }
  })

  // ---------------------------------------------------------------------------
  // S31 — habit-hit events fold into the same latest-per-domain pass
  // ---------------------------------------------------------------------------

  it('back-compat: calling with no events arg matches calling with events=[]', () => {
    const tasks = [task({ id: 't1', domain: 'Finance', completed_at: NOW - 15 * DAY_MS })]
    expect(computeWarmth(tasks, NOW)).toEqual(computeWarmth(tasks, NOW, []))
  })

  it('a today-dated habit event raises a cold/stale domain', () => {
    const tasks = [task({ id: 't1', domain: 'Growth', completed_at: NOW - 15 * DAY_MS })] // stale
    const withoutEvent = computeWarmth(tasks, NOW)
    expect(withoutEvent['Growth']).toBe('stale')

    const today = new Date(NOW).toISOString().slice(0, 10)
    const withEvent = computeWarmth(tasks, NOW, [{ domain: 'Growth', date: today }])
    expect(withEvent['Growth']).toBe('hot')
  })

  it('raises a wholly cold (never-completed) domain via events alone', () => {
    const today = new Date(NOW).toISOString().slice(0, 10)
    const result = computeWarmth([], NOW, [{ domain: 'Relationship', date: today }])
    expect(result['Relationship']).toBe('hot')
  })

  it('ignores events with a malformed date', () => {
    const result = computeWarmth([], NOW, [{ domain: 'Career', date: 'not-a-date' }])
    expect(result['Career']).toBe('cold')
  })
})
