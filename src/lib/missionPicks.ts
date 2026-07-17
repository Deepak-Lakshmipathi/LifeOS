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
 */
import type { Task } from '../types'
import { rankNow } from '../now/rankNow'
import type { RankedTask } from '../now/rankNow'
import type { Domain } from '../data/domains'
import type { WarmthState } from '../warmth/computeWarmth'

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
 */
export function missionPicks(
  tasks: Task[],
  warmth: Record<Domain, WarmthState>,
  vetoedIds: ReadonlySet<string> = new Set(),
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
  const mainPicks = main.slice(0, Math.max(mainCap, 0))

  const picks: MissionPick[] = mainPicks.map((r) => ({
    task: r.task,
    rescue: false,
    why: synthesizeWhy(r.task, false),
  }))

  if (rescue) {
    picks.push({ task: rescue.task, rescue: true, why: synthesizeWhy(rescue.task, true) })
  }

  // picks.length <= mainCap + (rescue ? 1 : 0) === MAX_PICKS by construction; no extra slice needed.
  return { picks }
}
