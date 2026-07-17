/**
 * dayStats — pure selector for the Evening Day Review card (Slice S29).
 *
 * Counts today's completions from the already-loaded task list: how many
 * were mission picks vs the wider list, and how many distinct domains got
 * a completion. No I/O, no Date.now() — caller (DayReview) injects `now`,
 * mirroring computeWarmth/rankNow's own convention.
 *
 * Signature deviation (documented light-path assumption): the ticket's
 * prose signature is `dayStats(tasks, picks, now)`, but a completed task
 * always leaves the live `missionPicks()` result — by the time a task shows
 * up in `tasks` as completed-today, it can no longer appear in a caller-
 * supplied `picks` snapshot. So "was this completion a mission pick"
 * can't be read off a passed-in `picks` value; this function reconstructs
 * it instead, reusing the shipped `missionPicks`/`computeWarmth` seams (no
 * new ranking logic, per the ticket's "no new ranking logic" constraint):
 * revert today's completions to open, recompute the mission queue over that
 * reverted list, and count which completed-today tasks land back in it.
 */
import type { Task } from '../types'
import { missionPicks } from './missionPicks'
import { computeWarmth } from '../warmth/computeWarmth'

export interface DayStats {
  /** Mission picks (today's 1–3) that were completed today. */
  missionDone: number
  /** All tasks (mission or not) completed today. */
  tasksCompleted: number
  /** Count of distinct domains with ≥1 completion today. */
  domainsWarmed: number
}

/** Start-of-day boundary in the caller's local timezone (matches Task.completed_at, a wall-clock epoch ms). */
function startOfDay(nowMs: number): number {
  const d = new Date(nowMs)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * dayStats — today's completion counts for the Day Review card.
 *
 * @param tasks  Full task list (open + done); filtered internally to today's completions.
 * @param now    Current time in ms (inject; never call Date.now() here).
 */
export function dayStats(tasks: Task[], now: number): DayStats {
  const dayStart = startOfDay(now)
  const completedToday = tasks.filter(
    (t) => t.done && t.completed_at !== undefined && t.completed_at >= dayStart,
  )
  const completedTodayIds = new Set(completedToday.map((t) => t.id))

  // Revert today's completions to open and recompute the mission queue over
  // that reverted list — any completed-today task the reconstructed queue
  // would still pick counts as a mission-pick completion.
  const reverted = tasks.map((t) =>
    completedTodayIds.has(t.id) ? { ...t, done: false, completed_at: undefined } : t,
  )
  const reconstructedWarmth = computeWarmth(reverted, now)
  const { picks: reconstructedPicks } = missionPicks(reverted, reconstructedWarmth)
  const reconstructedPickIds = new Set(reconstructedPicks.map((p) => p.task.id))

  const domains = new Set<string>()
  let missionDone = 0
  for (const t of completedToday) {
    if (t.domain) domains.add(t.domain)
    if (reconstructedPickIds.has(t.id)) missionDone += 1
  }

  return {
    missionDone,
    tasksCompleted: completedToday.length,
    domainsWarmed: domains.size,
  }
}
