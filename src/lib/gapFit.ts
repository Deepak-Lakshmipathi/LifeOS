/**
 * gapFit — naive gap → task suggestion heuristic (Slice S34).
 *
 * Pure, DOM-free: no I/O, no Date.now(). `tasks` is expected to already be
 * in rankNow order (see `now/rankNow.ts`) — TodayCard composes
 * `rankNow(tasks, warmth)` and passes the ranked open tasks straight in; this
 * module does no ranking of its own, only a per-gap "does it plausibly fit"
 * filter over that order.
 *
 * For each gap (walked in input order), the first not-yet-suggested
 * rank-ordered task that plausibly fits is picked:
 *   - gaps under 60 minutes only accept "short" tasks (quiz/lesson/course/
 *     reading-shaped titles — §4.5's own worked example is exactly this: a
 *     quiz suggested for a short gap);
 *   - gaps of 60+ minutes accept any task whose estimated effort is <= the
 *     gap's length.
 * A task, once suggested for a gap, is not suggested again for a later gap
 * in the same call (each open task backs at most one hint). When no
 * remaining task fits a gap, that gap maps to `null` — TodayCard renders an
 * honest "nothing fits" hint rather than inventing a suggestion (§8: never
 * blank, but never fake either).
 *
 * ponytail: effort estimation is a keyword sniff over `task.title` only —
 * Task carries no real duration/effort field yet, and adding one is out of
 * this slice's write-set. This is a ceiling, not a scheduler: it doesn't
 * consider dependencies, actual historical duration, splitting one task
 * across multiple gaps, or anything beyond a three-bucket keyword guess.
 * Good enough to make every gap "suggest a fitting task" (§8) without
 * inventing a schema field this slice doesn't own.
 */
import type { Task } from '../types'
import type { Gap } from '../vault/calendar'

/** Title keywords that read as short, quiz/lesson/reading-shaped work. */
const SHORT_KEYWORDS = [
  'quiz',
  'lesson',
  'module',
  'course',
  'read',
  'review',
  'flashcard',
  'skim',
  'email',
  'reply',
]

/** Title keywords that read as long, heads-down work. */
const LONG_KEYWORDS = ['deep work', 'deep-work', 'build', 'design', 'draft', 'write proposal', 'research', 'refactor']

/** Effort estimate in minutes for a "short" task (§4.5's quiz example: ~45min for a 90-min gap; short tasks bucket well under that). */
export const SHORT_EFFORT_MINUTES = 20
/** Default effort estimate for a task with no keyword signal either way. */
export const DEFAULT_EFFORT_MINUTES = 45
/** Effort estimate for a task that reads as heads-down/long work. */
export const LONG_EFFORT_MINUTES = 90

/** True when the task's title matches the short-task keyword list. */
function isShortTask(task: Task): boolean {
  const title = task.title.toLowerCase()
  return SHORT_KEYWORDS.some((k) => title.includes(k))
}

/**
 * Naive per-task effort estimate in minutes, from title keywords alone.
 * Exported so the UI can render the "(~NN min)" estimate alongside a hint
 * without re-implementing the same keyword table.
 */
export function estimateEffortMinutes(task: Task): number {
  const title = task.title.toLowerCase()
  if (SHORT_KEYWORDS.some((k) => title.includes(k))) return SHORT_EFFORT_MINUTES
  if (LONG_KEYWORDS.some((k) => title.includes(k))) return LONG_EFFORT_MINUTES
  return DEFAULT_EFFORT_MINUTES
}

/**
 * gapFit — map each gap to the best-fitting not-yet-used rank-ordered open
 * task, or `null` when nothing fits.
 *
 * @param gaps  Free-time gaps, e.g. `freeGaps(events)` (src/vault/calendar.ts).
 * @param tasks Open tasks in rankNow order (top-ranked first). Caller's
 *              responsibility — this function trusts the order given.
 */
export function gapFit(gaps: Gap[], tasks: Task[]): Map<Gap, Task | null> {
  const result = new Map<Gap, Task | null>()
  const used = new Set<string>()

  for (const gap of gaps) {
    const shortGapOnly = gap.minutes < 60

    const fit =
      tasks.find((t) => {
        if (used.has(t.id)) return false
        if (shortGapOnly) return isShortTask(t)
        return estimateEffortMinutes(t) <= gap.minutes
      }) ?? null

    if (fit) used.add(fit.id)
    result.set(gap, fit)
  }

  return result
}
