/**
 * habitEvents — join habit hits to warmth events (Slice S31).
 *
 * A habit hit heats its habit's domain exactly like completing a task there
 * (docs/DESIGN_LANGUAGE.md §4.6). Pure, no I/O, never throws — same contract
 * as computeWarmth and the habits parser it sits next to.
 */
import type { Habit, HabitHit } from '../vault/habits'
import type { WarmthEvent } from './computeWarmth'

/**
 * Map habit hits to warmth events by joining hit.habit -> Habit.name.
 * A hit is dropped when no habit with that name exists, or the matched
 * habit has no `domain` set — both silently, never thrown.
 */
export function habitHitsToEvents(hits: HabitHit[], habits: Habit[]): WarmthEvent[] {
  const byName = new Map(habits.map((h) => [h.name, h]))
  const events: WarmthEvent[] = []

  for (const hit of hits) {
    const habit = byName.get(hit.habit)
    if (!habit || !habit.domain) continue
    events.push({ domain: habit.domain, date: hit.date })
  }

  return events
}
