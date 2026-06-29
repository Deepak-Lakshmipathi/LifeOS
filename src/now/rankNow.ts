import type { Task } from '../types'

// S6 dumb brain: flat, domain-blind, priority-only ranking of open tasks.
// S10 (balance brain) will widen this signature with warmth — do NOT add params now.
export function rankNow(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => !t.done)
    .slice() // do not mutate caller's array
    .sort((a, b) => {
      const pa = a.priority ?? 0
      const pb = b.priority ?? 0
      if (pa !== pb) return pb - pa // priority descending (3→2→1→none)
      return a.created_at - b.created_at // tie: oldest first
    })
}
