import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Card } from '../glass/Card'
import type { Domain } from '../../data/domains'
import { parseHabits, parseHabitLog, weekGrid, streak, type Habit, type HabitHit } from '../../vault/habits'
import { appendHabitHit } from '../../vault/habitsWrite'
import { GitTransport, type VaultTransport } from '../../vault/transport'

/**
 * HabitsCard — the Home right-stack Habits card (DESIGN_LANGUAGE §4.6, §5,
 * Slice S32). One row per habit: name + sub-line, a 7-day week grid tinted
 * by the habit's domain, and a streak column (hot/broken/fraction).
 *
 * Mirrors VitalsRow's own "head of chain" convention (src/components/cockpit/
 * VitalsRow.tsx): App/HomeView mount this with no data props in the live
 * app, so the component sources its own Habits/*.md via the transport seam;
 * `habits`/`hits` props exist purely to short-circuit that fetch under test,
 * so fixture rendering never touches GitTransport (or its IndexedDB/network
 * side effects). Renders straight off S30's real parser output
 * (parseHabits/parseHabitLog/weekGrid/streak) — nothing about the per-habit
 * shape is invented here.
 *
 * Tapping today's dashed square is the one interaction: it appends a hit via
 * `appendHabitHit` (S32, the S30-serializer write half) through the SAME
 * `transport` prop — no direct fs/git call lives in this file. The square
 * flips optimistically (local `hits` state updates before the write
 * settles); a `pendingRef` guards against a second real append landing if
 * the tap fires twice before a re-render disables the button.
 */

// Canonical domain → design token CSS var (§2.1). Copied verbatim from
// VitalsRow/MissionCard's own DOMAIN_VAR — each card's write-set names its
// own literal table rather than sharing one (established precedent, see
// MissionCard.tsx's comment on this exact point).
const DOMAIN_VAR: Record<Domain, string> = {
  'Building Things': 'var(--d-build)',
  Career: 'var(--d-career)',
  Growth: 'var(--d-growth)',
  'Life Admin': 'var(--d-admin)',
  'Body & Mind': 'var(--d-body)',
  Finance: 'var(--d-fin)',
  Relationship: 'var(--d-rel)',
}

/** Today's local date as `YYYY-MM-DD`, matching the habits contract's date shape. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Sub-line ties a habit to its minimum duration and/or its domain (§4.6: "heats Body & Mind"). */
function subLine(habit: Habit): string | undefined {
  const parts: string[] = []
  if (habit.min) parts.push(`${habit.min} minimum`)
  if (habit.domain) parts.push(`heats ${habit.domain}`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/**
 * Streak column display (§4.6): `.hot` (🔥, streak alive and ≥2 days —
 * a single live day isn't yet a "streak" worth celebrating), `.broken`
 * (✕, streak died), or a neutral `.fraction` (n/7 hits this week) for a
 * live-but-brand-new run. This threshold isn't numerically pinned in
 * DESIGN_LANGUAGE.md's prose — it's inferred from the one worked example
 * the doc gives ("neutral fraction (3/7)"), which matches exactly what
 * this rule produces for the committed "Call a friend" fixture (3 hits
 * this week, streak-of-1 today) — see HabitsCard.test.tsx.
 */
function streakDisplay(
  hits: HabitHit[],
  habit: string,
  today: string,
  grid: boolean[],
): { text: string; cls: 'hot' | 'broken' | 'fraction' } {
  const { n, broken } = streak(hits, habit, today)
  if (broken) return { text: `✕ ${n}d`, cls: 'broken' }
  if (n >= 2) return { text: `🔥 ${n}d`, cls: 'hot' }
  const weekCount = grid.filter(Boolean).length
  return { text: `${weekCount}/7`, cls: 'fraction' }
}

const STREAK_CLASS: Record<'hot' | 'broken' | 'fraction', string> = {
  hot: 'text-[#fcd34d]',
  broken: 'text-[#fca5a5]',
  fraction: 'text-dim',
}

export interface HabitsCardProps {
  /** Habit definitions. Omit in-app (component self-loads via `transport`); inject in tests. */
  habits?: Habit[]
  /** Habit hits. Same injection/short-circuit contract as `habits`. */
  hits?: HabitHit[]
  /** Write (and, when `habits`/`hits` are omitted, read) seam. Defaults to a fresh GitTransport. */
  transport?: VaultTransport
  /** Reference date (`YYYY-MM-DD`) the week grid/streak are computed against — inject for deterministic tests. */
  today?: string
}

export function HabitsCard({
  habits: habitsProp,
  hits: hitsProp,
  transport,
  today,
}: HabitsCardProps = {}) {
  const [loadedHabits, setLoadedHabits] = useState<Habit[]>([])
  const [hits, setHits] = useState<HabitHit[]>(hitsProp ?? [])
  const habits = habitsProp ?? loadedHabits
  const todayStr = today ?? todayIso()

  // Keep local hits in sync with an injected fixture (fixture-render tests
  // pass `hits` directly and expect the grid to reflect it immediately).
  useEffect(() => {
    if (hitsProp !== undefined) setHits(hitsProp)
  }, [hitsProp])

  // Self-load from the vault when the caller didn't inject fixture data —
  // the VitalsRow "head of chain" convention: tests short-circuit this by
  // passing `habits` (skips the effect entirely, so GitTransport is never
  // constructed under test).
  useEffect(() => {
    if (habitsProp !== undefined) return
    let live = true
    ;(async () => {
      try {
        const t = transport ?? new GitTransport()
        const files = await t.readFiles()
        if (!live) return
        const habitsMd = files.find((f) => f.path === 'Habits/habits.md')?.content ?? ''
        const logMd = files.find((f) => f.path === 'Habits/log.md')?.content ?? ''
        setLoadedHabits(parseHabits(habitsMd))
        setHits(parseHabitLog(logMd))
      } catch {
        // No vault configured / offline — render the honest empty state (§8: no fake-real data).
      }
    })()
    return () => {
      live = false
    }
  }, [habitsProp, transport])

  // Synchronous double-tap guard: React state updates aren't guaranteed to
  // have flushed between two rapid clicks, so the "already hit today" check
  // alone can't prove a second real append never fires. A ref does.
  const pendingRef = useRef<Set<string>>(new Set())

  const handleTap = useCallback(
    (habit: Habit) => {
      if (pendingRef.current.has(habit.name)) return
      const alreadyHitToday = weekGrid(hits, habit.name, todayStr)[6]
      if (alreadyHitToday) return

      pendingRef.current.add(habit.name)
      const hit: HabitHit = { habit: habit.name, date: todayStr, source: 'pwa' }
      // Optimistic flip — the square updates before the write settles.
      setHits((prev) => [...prev, hit])

      void appendHabitHit(transport ?? new GitTransport(), hit).catch(() => {
        // Transport is a never-throw seam by contract (ADR-0003); guard
        // anyway so a write hiccup can't surface as an unhandled rejection.
      })
    },
    [hits, todayStr, transport],
  )

  return (
    <Card heading="Habits" data-testid="habits-card">
      {habits.length === 0 ? (
        <p className="text-[13px] text-dim">No habits tracked yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {habits.map((habit) => (
            <HabitRow
              key={habit.name}
              habit={habit}
              hits={hits}
              today={todayStr}
              onTap={handleTap}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

interface HabitRowProps {
  habit: Habit
  hits: HabitHit[]
  today: string
  onTap: (habit: Habit) => void
}

/** A single habit row per §4.6 anatomy: `grid 1fr auto auto; gap:12px`. */
function HabitRow({ habit, hits, today, onTap }: HabitRowProps) {
  const grid = weekGrid(hits, habit.name, today)
  const { text: streakText, cls: streakCls } = streakDisplay(hits, habit.name, today, grid)
  const hc = habit.domain ? DOMAIN_VAR[habit.domain] : 'var(--faint)'
  const sub = subLine(habit)
  const style = { '--hc': hc } as CSSProperties

  return (
    <div
      data-testid="habit-row"
      data-habit={habit.name}
      style={style}
      className="grid grid-cols-[1fr_auto_auto] items-center gap-3"
    >
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] text-txt">{habit.name}</span>
        {sub && <small className="block text-[11.5px] text-dim">{sub}</small>}
      </span>

      <span className="flex items-center gap-1" data-testid="habit-week">
        {grid.map((hit, i) =>
          i === 6 ? (
            <button
              key={i}
              type="button"
              data-testid="habit-today-square"
              data-hit={hit}
              aria-label={hit ? `${habit.name}: done today` : `Mark ${habit.name} done today`}
              disabled={hit}
              onClick={() => onTap(habit)}
              className="h-[11px] w-[11px] rounded-[var(--r-dot)] motion-reduce:transition-none transition-colors disabled:cursor-default"
              style={{
                backgroundColor: hit ? 'var(--hc)' : 'transparent',
                border: hit ? 'none' : '1px dashed var(--hc)',
              }}
            />
          ) : (
            <i
              key={i}
              data-testid="habit-square"
              data-hit={hit}
              className="block h-[11px] w-[11px] rounded-[var(--r-dot)] not-italic"
              style={{ backgroundColor: hit ? 'var(--hc)' : 'rgba(255,255,255,.08)' }}
            />
          ),
        )}
      </span>

      <span
        data-testid="habit-streak"
        data-streak={streakCls}
        className={`w-[52px] text-right text-[12.5px] tabular-nums ${STREAK_CLASS[streakCls]}`}
      >
        {streakText}
      </span>
    </div>
  )
}
