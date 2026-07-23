import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Card } from '../glass/Card'
import type { Task } from '../../types'
import { parseCalendar, freeGaps } from '../../vault/calendar'
import type { CalEvent, CalEventType, Gap } from '../../vault/calendar'
import { gapFit, estimateEffortMinutes } from '../../lib/gapFit'
import { rankNow } from '../../now/rankNow'
import { computeWarmth } from '../../warmth/computeWarmth'
import { GitTransport, type VaultTransport } from '../../vault/transport'

/**
 * TodayCard — the Home right-stack Today/calendar card (DESIGN_LANGUAGE
 * §4.5, §8, Slice S34). Renders S33's parsed `Calendar/today.md` as a
 * single time-ordered column of slot rows (event chips, GCal-style tint,
 * NO accent bars) interleaved with gap-hint rows, each of which always
 * names a fitting open task (via `gapFit`) or an honest "nothing fits"
 * note — never blank whitespace (§8).
 *
 * Mirrors HabitsCard's "head of chain" convention (src/components/home/
 * HabitsCard.tsx): HomeView mounts this with only `tasks` (already in
 * scope there for MissionCard/NowView) — calendar events self-load via the
 * transport seam. `events`/`date` props exist purely to short-circuit that
 * fetch under test, so fixture rendering never touches GitTransport (or its
 * IndexedDB/network side effects), same as HabitsCard's `habits`/`hits`.
 *
 * GitTransport.readFiles() (src/vault/transport.ts) walks the 7 domain
 * folders + Inbox/ + Habits/ + Calendar/ (S34/#151 fixed the gap where
 * Calendar/ was missing, leaving the live self-load permanently empty).
 * Under test this is moot: `events`/`date` short-circuit the fetch entirely.
 */

// §4.5 — GCal-style tinted fill + matching light text, no accent bar.
// 'other' (unknown/missing `type::`) has no assigned §4.5 color; falls back
// to the neutral panel tint already used elsewhere (e.g. attention row's
// unfilled rows) rather than inventing a new hex.
const CHIP_CLASS: Record<CalEventType, string> = {
  call: 'bg-[rgba(56,189,248,.13)] text-[#bae6fd]',
  deep: 'bg-[rgba(245,158,11,.11)] text-[#fde68a]',
  gym: 'bg-[rgba(45,212,191,.12)] text-[#99f6e4]',
  other: 'bg-[rgba(255,255,255,.06)] text-dim',
}

/** Today's local date as `YYYY-MM-DD`, matching the calendar contract's date shape. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

type TimelineItem =
  | { kind: 'event'; start: string; event: CalEvent }
  | { kind: 'gap'; start: string; gap: Gap }

export interface TodayCardProps {
  /** Full task list (open + done); passed straight through to rankNow/gapFit for gap hints. */
  tasks: Task[]
  /** Parsed calendar events. Omit in-app (component self-loads via `transport`); inject in tests. */
  events?: CalEvent[]
  /** File date from the calendar header. Same injection/short-circuit contract as `events`. */
  date?: string
  /** Reference "today" (`YYYY-MM-DD`) the staleness check compares against — inject for deterministic tests. */
  today?: string
  /** Read seam. Defaults to a fresh GitTransport. */
  transport?: VaultTransport
  /** Current time in ms — inject for deterministic rankNow/warmth tests (defaults to Date.now()). */
  now?: number
}

export function TodayCard({
  tasks,
  events: eventsProp,
  date: dateProp,
  today,
  transport,
  now,
}: TodayCardProps) {
  const [loadedEvents, setLoadedEvents] = useState<CalEvent[]>([])
  const [loadedDate, setLoadedDate] = useState<string | undefined>(undefined)
  const prefersReducedMotion = useReducedMotion() ?? false

  // Self-load from the vault when the caller didn't inject fixture data —
  // the HabitsCard "head of chain" convention: tests short-circuit this by
  // passing `events` (skips the effect entirely, so GitTransport is never
  // constructed under test).
  useEffect(() => {
    if (eventsProp !== undefined) return
    let live = true
    ;(async () => {
      try {
        const t = transport ?? new GitTransport()
        const files = await t.readFiles()
        if (!live) return
        const md = files.find((f) => f.path === 'Calendar/today.md')?.content ?? ''
        const parsed = parseCalendar(md)
        setLoadedEvents(parsed.events)
        setLoadedDate(parsed.date)
      } catch {
        // No vault configured / offline — render the honest empty state (§8: no fake-real data).
      }
    })()
    return () => {
      live = false
    }
  }, [eventsProp, transport])

  const events = eventsProp ?? loadedEvents
  const date = eventsProp !== undefined ? dateProp : loadedDate
  const todayStr = today ?? todayIso()

  const gaps = freeGaps(events)
  const warmth = computeWarmth(tasks, now ?? Date.now())
  const rankedOpenTasks = rankNow(tasks, warmth).map((r) => r.task)
  const fits = gapFit(gaps, rankedOpenTasks)

  const timeline: TimelineItem[] = [
    ...events.map((event) => ({ kind: 'event' as const, start: event.start, event })),
    ...gaps.map((gap) => ({ kind: 'gap' as const, start: gap.start, gap })),
  ].sort((a, b) => a.start.localeCompare(b.start))

  // No file found at all (date undefined AND no events) reads as "no
  // calendar data yet" — distinct from a genuinely empty day (date present,
  // freeGaps still returns the full-day gap, which renders normally below).
  const noData = date === undefined && events.length === 0

  return (
    <Card heading="Today" data-testid="today-card">
      {date !== undefined && date !== todayStr && (
        <p data-testid="today-stale-banner" className="mb-2.5 text-[12px] text-dim">
          Showing yesterday&rsquo;s plan &mdash; Calendar hasn&rsquo;t synced today.
        </p>
      )}

      {noData ? (
        <p className="text-[13px] text-dim">No calendar data yet.</p>
      ) : (
        <div className="flex flex-col">
          {timeline.map((item, i) => {
            const isLast = i === timeline.length - 1
            if (item.kind === 'event') {
              return (
                <SlotRow
                  key={`e-${item.event.start}-${item.event.title}`}
                  event={item.event}
                  isLast={isLast}
                  reduceMotion={prefersReducedMotion}
                />
              )
            }
            const fit = fits.get(item.gap) ?? null
            return <GapRow key={`g-${item.gap.start}-${item.gap.end}`} gap={item.gap} task={fit} />
          })}
        </div>
      )}
    </Card>
  )
}

interface SlotRowProps {
  event: CalEvent
  isLast: boolean
  reduceMotion: boolean
}

/** A single slot row per §4.5 anatomy: 52px time column + tinted chip, no accent bar. */
function SlotRow({ event, isLast, reduceMotion }: SlotRowProps) {
  return (
    <div
      data-testid="today-slot"
      data-type={event.type}
      className={[
        'flex items-center gap-3 py-2',
        !isLast && 'border-b border-[rgba(255,255,255,.05)]',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <time className="w-[52px] flex-shrink-0 text-[12.5px] tabular-nums text-faint">
        {event.start}
      </time>
      <div
        className={[
          'min-w-0 truncate rounded-[9px] px-2.5 py-1.5 text-[13px] font-medium',
          !reduceMotion && 'transition-colors duration-200',
          CHIP_CLASS[event.type],
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {event.title}
      </div>
    </div>
  )
}

interface GapRowProps {
  gap: Gap
  task: Task | null
}

/** A gap-hint row per §4.5: italic, 12px, --faint, indented 64px, always names a use for the gap (§8). */
function GapRow({ gap, task }: GapRowProps) {
  const hint = task
    ? `${gap.minutes}-min gap — fits ${task.title} (~${estimateEffortMinutes(task)} min)`
    : `${gap.minutes}-min gap — nothing on today's list fits`

  return (
    <div data-testid="today-gap" data-fits={task !== null} className="py-1.5 pl-16 text-[12px] italic text-faint">
      {hint}
    </div>
  )
}
