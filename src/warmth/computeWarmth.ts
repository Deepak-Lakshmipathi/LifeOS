/**
 * computeWarmth — pure, in-memory domain warmth derivation (Slice S9).
 *
 * Warmth is DERIVED from completed_at timestamps on tasks; it is never
 * stored or logged. This function has no side effects and calls no
 * browser/OS APIs — inject `now` for full testability.
 *
 * No Dexie query is made here; the caller passes the already-loaded task
 * list. Schema stays at v2; no index on completed_at (ADR-0005 extension).
 */
import type { Task } from '../types'
import { DOMAINS } from '../data/domains'
import type { Domain } from '../data/domains'

export type WarmthState = 'hot' | 'warm' | 'ok' | 'stale' | 'cold'

/**
 * A warmth-relevant event outside of tasks — currently habit hits (S31).
 * `date` is an ISO calendar date `YYYY-MM-DD`, folded in at UTC midnight.
 */
export type WarmthEvent = { domain: Domain; date: string }

/** Milliseconds per day — used in WARMTH_THRESHOLDS. */
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Age thresholds (inclusive upper bounds in ms since last completed task).
 * Change only these constants to retune warmth sensitivity.
 *
 *   hot   — completed within 2 days
 *   warm  — completed within 5 days
 *   ok    — completed within 10 days
 *   stale — completed within 20 days
 *   cold  — older than 20 days, or never completed
 */
export const WARMTH_THRESHOLDS = {
  hot: 2 * DAY_MS,
  warm: 5 * DAY_MS,
  ok: 10 * DAY_MS,
  stale: 20 * DAY_MS,
} as const

/**
 * Derive the warmth state for every canonical domain from the loaded task list.
 *
 * @param tasks  The full in-memory task list (from useTasks / SyncProvider.list).
 * @param now    Current time in ms (inject; never call Date.now() here).
 * @param events Optional non-task warmth events (e.g. habit hits, S31).
 *               Deviation from ticket prose (`computeWarmth(tasks, events?)`):
 *               placed as the 3rd param, after `now`, so every pre-existing
 *               `computeWarmth(tasks, now)` call site and test stays valid
 *               unmodified (DoD #1) — `now` already shipped as the 2nd param.
 * @returns      A record mapping every Domain to its WarmthState.
 */
export function computeWarmth(
  tasks: Task[],
  now: number,
  events?: WarmthEvent[],
): Record<Domain, WarmthState> {
  // Find the most recent completed_at per domain (single pass over tasks + events).
  const latestPerDomain: Partial<Record<Domain, number>> = {}

  for (const task of tasks) {
    if (!task.domain || task.completed_at === undefined) continue
    const domain = task.domain as Domain
    const prev = latestPerDomain[domain]
    if (prev === undefined || task.completed_at > prev) {
      latestPerDomain[domain] = task.completed_at
    }
  }

  for (const evt of events ?? []) {
    const ts = Date.parse(evt.date + 'T00:00:00Z')
    if (Number.isNaN(ts)) continue // malformed date — skip defensively
    const prev = latestPerDomain[evt.domain]
    if (prev === undefined || ts > prev) {
      latestPerDomain[evt.domain] = ts
    }
  }

  // Bucket each domain into a WarmthState.
  const result = {} as Record<Domain, WarmthState>

  for (const domain of DOMAINS) {
    const latest = latestPerDomain[domain]
    if (latest === undefined) {
      result[domain] = 'cold'
      continue
    }
    const age = now - latest
    if (age <= WARMTH_THRESHOLDS.hot) {
      result[domain] = 'hot'
    } else if (age <= WARMTH_THRESHOLDS.warm) {
      result[domain] = 'warm'
    } else if (age <= WARMTH_THRESHOLDS.ok) {
      result[domain] = 'ok'
    } else if (age <= WARMTH_THRESHOLDS.stale) {
      result[domain] = 'stale'
    } else {
      result[domain] = 'cold'
    }
  }

  return result
}
