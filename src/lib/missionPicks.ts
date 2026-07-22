/**
 * missionPicks — pure selector for the Today's Mission card (Slice S27).
 *
 * Composes the already-shipped ranking seams — `rankNow` (priority queue +
 * per-domain cap) and `computeWarmth` (coldest-domain rescue signal) — into
 * the top 1–3 picks for Home's mission card. No new ranking logic: this file
 * is pure orchestration + a `why` line synthesis, and never touches
 * `rankNow.ts` / `computeWarmth.ts`.
 *
 * `why` line assumption (documented on the S27 issue): `Task` carries no
 * dedicated `why` field yet. Until a real source lands (see S45 — course
 * candidates carry provenance), the why line is synthesized: a task with a
 * `project` reads "Part of <project>"; otherwise a generic per-domain
 * balance rationale, distinct for the rescue pick vs a normal pick. This
 * keeps the function pure (no I/O, no Task schema change) and is out of this
 * slice's write-set to fix — it composes existing fields only.
 *
 * S45 adds an optional course candidate: a synthesized pseudo-task from the
 * most-progressed unfinished course's `next::` step (see
 * `synthesizeCourseCandidate`), which `missionPicks` may fold in as one of
 * today's picks (career/growth balance pressure made visible). It never
 * competes with real ranked tasks or the rescue slot — it only fills a slot
 * `rankNow`'s real output left empty, same principle as "never displaces a
 * rescue" extended to the whole main queue.
 */
import type { Task } from '../types'
import { rankNow, DOMAIN_CAP_DEFAULT } from '../now/rankNow'
import type { RankedTask } from '../now/rankNow'
import type { Domain } from '../data/domains'
import { isDomain } from '../data/domains'
import type { WarmthState } from '../warmth/computeWarmth'
import type { Course } from '../vault/career'

/** Cap on mission picks shown in the card — the contract's "1–3 picks". */
export const MAX_PICKS = 3

/** A single mission pick: the task, whether it's the rescue slot, and its why line. */
export interface MissionPick {
  task: Task
  rescue: boolean
  why: string
}

export interface MissionPicksResult {
  /** Up to MAX_PICKS picks, rescue (if present) always last. */
  picks: MissionPick[]
}

/** Priority baked into every synthesized course-candidate pseudo-task. */
const COURSE_CANDIDATE_PRIORITY = 2 as const

/**
 * A course-derived mission-pick candidate: the synthesized pseudo-task
 * (`title` = the course's `next::` step, `domain` from the course when it's
 * one of the 7 canonical domains, `priority` 2) plus the course's own name,
 * kept alongside for the why-line provenance ("from course: <name>") — the
 * pseudo-task's `title` is the *lesson*, not the course, so the name can't be
 * recovered from the task alone.
 */
export interface CourseCandidate {
  task: Task
  courseName: string
}

/**
 * Synthesize a mission-pick candidate from the most-progressed *unfinished*
 * (`progress < 100`) course's `next::` step. Pure; ties broken by array
 * order (first-declared wins, mirroring `rankNow`'s own tie-break).
 *
 * Returns `null` when there's no unfinished course, or the most-progressed
 * one has no `next::` step — nothing to pick either way.
 */
export function synthesizeCourseCandidate(courses: Course[]): CourseCandidate | null {
  let best: Course | null = null
  for (const course of courses) {
    if (course.progress >= 100) continue
    if (best === null || course.progress > best.progress) best = course
  }
  if (best === null || !best.next) return null

  const domain = best.domain && isDomain(best.domain) ? (best.domain as Domain) : undefined

  const task: Task = {
    id: `course::${best.name}`,
    title: best.next,
    done: false,
    created_at: 0,
    priority: COURSE_CANDIDATE_PRIORITY,
    ...(domain ? { domain } : {}),
  }

  return { task, courseName: best.name }
}

/**
 * Synthesize the why line for a pick. Reuses `project` when set; otherwise a
 * generic domain-balance rationale. Rescue picks get a distinct, honest
 * framing per §8 ("let cold domains look cold").
 */
function synthesizeWhy(task: Task, rescue: boolean): string {
  if (task.project) {
    return `Part of ${task.project}.`
  }
  const domain = task.domain
  if (rescue) {
    return domain ? `${domain} hasn't moved in a while.` : `This domain hasn't moved in a while.`
  }
  return domain ? `Keeps ${domain} moving.` : `Keeps things moving.`
}

/**
 * missionPicks — top ≤3 picks for Today's Mission.
 *
 * @param tasks    Full task list (open + done); passed straight to rankNow.
 * @param warmth   Per-domain warmth from computeWarmth(tasks, now). Injected
 *                 by the caller (MissionCard) — this function never calls
 *                 computeWarmth or Date.now() itself.
 * @param vetoedIds Task ids the user has dismissed this session — excluded
 *                 from consideration so the next-ranked pick fills the slot.
 * @param courseCandidate Optional S45 course-derived pick (see
 *                 `synthesizeCourseCandidate`). Only ever fills a slot real
 *                 ranked tasks left empty — it never bumps a real pick and
 *                 never becomes (or displaces) the rescue slot, and it still
 *                 respects the per-domain cap real tasks obey so Growth
 *                 can't crowd out another domain just for being synthetic.
 */
export function missionPicks(
  tasks: Task[],
  warmth: Record<Domain, WarmthState>,
  vetoedIds: ReadonlySet<string> = new Set(),
  courseCandidate?: CourseCandidate | null,
): MissionPicksResult {
  const ranked: RankedTask[] = rankNow(tasks, warmth)

  // Split into main queue (rescue:false) and the single rescue slot
  // (rescue:true), preserving rankNow's own ordering within each.
  const main = ranked.filter((r) => !r.rescue && !vetoedIds.has(r.task.id))
  const rescue = ranked.find((r) => r.rescue && !vetoedIds.has(r.task.id)) ?? null

  // Reserve a slot for the rescue pick (if present) so it's never crowded
  // out by the main queue — mirrors rankNow's own "rescue always appended"
  // contract, just capped to MAX_PICKS total.
  const mainCap = rescue ? MAX_PICKS - 1 : MAX_PICKS
  let mainPicks = main.slice(0, Math.max(mainCap, 0))

  // S45: the course candidate only fills a slot real tasks left empty. It
  // never competes on rank against a real task and never reaches the rescue
  // slot (that's computed above, entirely from `tasks` — untouched here).
  if (courseCandidate && !vetoedIds.has(courseCandidate.task.id) && mainPicks.length < mainCap) {
    const domain = courseCandidate.task.domain
    const domainCount = domain ? mainPicks.filter((r) => r.task.domain === domain).length : 0
    if (!domain || domainCount < DOMAIN_CAP_DEFAULT) {
      mainPicks = [...mainPicks, { task: courseCandidate.task, rescue: false }]
    }
  }

  const picks: MissionPick[] = mainPicks.map((r) => ({
    task: r.task,
    rescue: false,
    why:
      courseCandidate && r.task.id === courseCandidate.task.id
        ? `From course: ${courseCandidate.courseName}.`
        : synthesizeWhy(r.task, false),
  }))

  if (rescue) {
    picks.push({ task: rescue.task, rescue: true, why: synthesizeWhy(rescue.task, true) })
  }

  // picks.length <= mainCap + (rescue ? 1 : 0) === MAX_PICKS by construction; no extra slice needed.
  return { picks }
}
