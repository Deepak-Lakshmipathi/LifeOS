/**
 * rankNow — balance brain v1 (Slice S10, extends S6 dumb brain).
 *
 * Pure function: no I/O, no Date.now(), no side effects.
 * Caller injects warmth (from computeWarmth) so this stays fully testable.
 *
 * Algorithm:
 * 1. Filter open tasks; sort priority desc, created_at asc (S6 order preserved).
 * 2. Walk sorted list; admit each task into the capped set until its domain
 *    hits domainCap. Domain-less (inbox) tasks are never capped.
 * 3. Find the coldest rescue-eligible domain (cold or stale); pick its best
 *    open task not already admitted as the single rescue slot.
 * 4. Return admitted tasks (rescue:false) + rescue task (rescue:true) if found.
 *
 * See docs/adr/0008-balance-brain.md.
 */
import type { Task } from '../types'
import { DOMAINS, isDomain } from '../data/domains'
import type { Domain } from '../data/domains'
import type { WarmthState } from '../warmth/computeWarmth'

/** A task entry in the NOW ranked list with an optional rescue flag. */
export interface RankedTask {
  task: Task
  /**
   * True for the single rescue task injected from the coldest domain (if any).
   * The view uses this to render a distinct ❄ rescue card.
   */
  rescue: boolean
}

export interface RankNowOpts {
  /** Per-domain cap in the admitted set. Default: DOMAIN_CAP_DEFAULT. */
  domainCap?: number
}

/** Default per-domain cap — no single domain may flood the NOW queue. */
export const DOMAIN_CAP_DEFAULT = 2

/**
 * WarmthState values that trigger rescue injection.
 * Only domains at these states supply a rescue task.
 * 'cold' ranks colder than 'stale'; both indicate neglect.
 */
const RESCUE_ELIGIBLE_STATES: ReadonlySet<WarmthState> = new Set(['cold', 'stale'])

/** Numeric rank for warmth states (lower = colder). Used for tie-breaking. */
const WARMTH_RANK: Record<WarmthState, number> = {
  cold: 0,
  stale: 1,
  ok: 2,
  warm: 3,
  hot: 4,
}

/**
 * rankNow — balance brain v1.
 *
 * @param tasks   Full task list (open + done); filtered internally.
 * @param warmth  Per-domain warmth from computeWarmth(tasks, now). Injected;
 *                never call computeWarmth or Date.now() inside this function.
 * @param opts    Optional overrides (domainCap).
 */
export function rankNow(
  tasks: Task[],
  warmth: Record<Domain, WarmthState>,
  opts?: RankNowOpts,
): RankedTask[] {
  const cap = opts?.domainCap ?? DOMAIN_CAP_DEFAULT

  // 1. Filter and sort open tasks: priority desc, age asc (oldest first).
  const open = tasks
    .filter((t) => !t.done)
    .slice()
    .sort((a, b) => {
      const pa = a.priority ?? 0
      const pb = b.priority ?? 0
      if (pa !== pb) return pb - pa // priority descending (3→2→1→none)
      return a.created_at - b.created_at // tie: oldest first
    })

  // 2. Per-domain cap pass: walk priority-sorted tasks, admit until capped.
  const domainCount: Partial<Record<Domain, number>> = {}
  const admittedIds = new Set<string>()
  const admitted: Task[] = []

  for (const task of open) {
    const domain = isDomain(task.domain ?? '') ? (task.domain as Domain) : null

    if (domain !== null) {
      const count = domainCount[domain] ?? 0
      if (count >= cap) continue // domain cap reached — skip
      domainCount[domain] = count + 1
    }
    // domain-less (inbox) tasks are always admitted (no per-domain limit)
    admitted.push(task)
    admittedIds.add(task.id)
  }

  // 3. Rescue injection: find the coldest rescue-eligible domain.
  //    Among ties, DOMAINS iteration order (first declared = highest priority).
  let rescueTask: Task | null = null
  let coldestRank = Infinity
  let coldestDomain: Domain | null = null

  for (const domain of DOMAINS) {
    const state = warmth[domain]
    if (!RESCUE_ELIGIBLE_STATES.has(state)) continue
    const rank = WARMTH_RANK[state]
    if (rank < coldestRank) {
      coldestRank = rank
      coldestDomain = domain
    }
  }

  if (coldestDomain !== null) {
    // Best non-admitted open task from that domain (already priority-sorted).
    const candidate = open.find(
      (t) => t.domain === coldestDomain && !admittedIds.has(t.id),
    )
    if (candidate !== undefined) {
      rescueTask = candidate
    }
  }

  // 4. Build result: main set (rescue:false) + rescue entry (rescue:true).
  const result: RankedTask[] = admitted.map((task) => ({ task, rescue: false }))
  if (rescueTask !== null) {
    result.push({ task: rescueTask, rescue: true })
  }

  return result
}
