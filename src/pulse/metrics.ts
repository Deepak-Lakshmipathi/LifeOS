/**
 * Pulse metrics — pure, in-memory helpers (Slice S13).
 *
 * Rules:
 *  - Pure: no side effects, no browser/OS APIs.
 *  - Clock-injected: `now` is always passed in — never call Date.now() here.
 *    This keeps unit tests fully deterministic.
 *  - Read-only: never mutates tasks; no Dexie schema change required.
 */
import type { Task } from '../types'

/** Milliseconds in one day. */
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Count tasks completed in the last 7 days (inclusive lower bound).
 *
 * A task counts when: `completed_at !== undefined && completed_at >= now - 7*DAY_MS`.
 *
 * @param tasks Full in-memory task list.
 * @param now   Current time in ms (inject; never call Date.now() here).
 */
export function doneThisWeek(tasks: Task[], now: number): number {
  const cutoff = now - 7 * DAY_MS
  return tasks.filter(
    (t) => t.completed_at !== undefined && t.completed_at >= cutoff,
  ).length
}

/**
 * Count completions per day for the last `days` days.
 *
 * Bucket order: **oldest → newest**.
 *   index 0   = the day `days` days ago (floor-bucketed from `now`)
 *   index N-1 = today
 *
 * Bucketing algorithm:
 *   daysAgo = floor((now - completed_at) / DAY_MS)
 *   idx     = days - 1 - daysAgo    (oldest → newest)
 *
 * A task is excluded when daysAgo >= days (older than the window).
 * Tasks without completed_at are always excluded.
 *
 * @param tasks Full in-memory task list.
 * @param now   Current time in ms (inject).
 * @param days  Number of days to bucket (typically 7).
 * @returns     Array of length `days` with completion counts, oldest first.
 */
export function completionsByDay(tasks: Task[], now: number, days: number): number[] {
  const counts = new Array<number>(days).fill(0)
  const cutoff = now - days * DAY_MS

  for (const task of tasks) {
    if (task.completed_at === undefined) continue
    if (task.completed_at < cutoff) continue
    const daysAgo = Math.floor((now - task.completed_at) / DAY_MS)
    if (daysAgo >= days) continue // handles exact boundary edge case
    const idx = days - 1 - daysAgo
    counts[idx]++
  }

  return counts
}
