import type { Task } from '../../types'
import { dayStats } from '../../lib/dayStats'
import { Card } from '../glass/Card'

/**
 * DayReview — the Evening Day Review card (DESIGN_LANGUAGE §6, Slice S29).
 *
 * pm-only reflection card, first child on Home when `body.pm`. Purple-tinted
 * per §6 (`border rgba(167,139,250,.35)`, `bg rgba(167,139,250,.07)`), a flex
 * row of stat pairs (19px value / 13.5px label): mission done, tasks
 * completed, domains warmed (all real, from `dayStats`), plus two honest
 * placeholders (§8: no fake-real data) for stats no slice computes yet.
 */

interface StatPair {
  value: string
  label: string
}

export interface DayReviewProps {
  /** Full task list (open + done); passed straight through to dayStats. */
  tasks: Task[]
  /** Current time in ms — inject for deterministic tests (defaults to Date.now()). */
  now?: number
}

export function DayReview({ tasks, now }: DayReviewProps) {
  const stats = dayStats(tasks, now ?? Date.now())

  const pairs: StatPair[] = [
    { value: String(stats.missionDone), label: 'Mission done' },
    { value: String(stats.tasksCompleted), label: 'Tasks completed' },
    { value: String(stats.domainsWarmed), label: 'Domains warmed' },
    // Honest placeholders — no slice computes these yet (§8: no fake-real data).
    { value: '—', label: 'Debts owed' },
    { value: '—', label: "Tomorrow's seed" },
  ]

  return (
    <Card
      heading="Day Review"
      className="[border-color:rgba(167,139,250,.35)] [background:rgba(167,139,250,.07)]"
    >
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {pairs.map((pair) => (
          <div key={pair.label} data-testid="day-review-stat">
            <div className="text-[19px] font-semibold leading-none text-txt">{pair.value}</div>
            <div className="mt-1 text-[13.5px] text-dim">{pair.label}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}
