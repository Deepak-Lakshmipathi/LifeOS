import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export interface VitalProps {
  /** `.k` — 11px uppercase label. */
  k: string
  /** Numeric target the `.v` count-up animates toward. */
  value: number
  /** Formats the animated number for display (e.g. `v => \`₹${v.toFixed(1)}L\``). */
  format?: (value: number) => string
  /** `.s` sub line, e.g. "▲ 2.1% this month". Omit to render no sub row. */
  sub?: ReactNode
  /** `.up` = --good, `.dn` = --bad; omit for neutral (--dim). */
  subDirection?: 'up' | 'dn'
  className?: string
}

const COUNT_UP_MS = 900

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * §7 count-up: `1-(1-p)^3` ease over 900ms on load, honoring reduced-motion
 * by skipping straight to the final value. Driven by `setTimeout` (not
 * `requestAnimationFrame`, which jsdom doesn't implement) so this is
 * deterministic under Vitest fake timers — §7 only mandates rAF for the
 * aurora drift, not for count-up.
 */
function useCountUp(target: number, duration = COUNT_UP_MS): number {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? target : 0))

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(target)
      return
    }

    let timer: ReturnType<typeof setTimeout>
    const start = Date.now()

    const step = () => {
      const elapsed = Date.now() - start
      const p = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(target * eased)
      if (p < 1) {
        timer = setTimeout(step, 16)
      }
    }

    step()
    return () => clearTimeout(timer)
  }, [target, duration])

  return display
}

export function Vital({ k, value, format, sub, subDirection, className = '' }: VitalProps) {
  const display = useCountUp(value)
  const shown = format ? format(display) : String(display)

  const subClass =
    subDirection === 'up' ? 'text-good' : subDirection === 'dn' ? 'text-bad' : 'text-dim'

  return (
    <div
      className={[
        'bg-panel border border-panel-brd rounded-tile backdrop-blur-tile px-[14px] py-3',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="k text-[11px] uppercase tracking-[.09em] text-faint">{k}</div>
      <div className="v text-[22px] font-bold tabular-nums text-txt">{shown}</div>
      {sub != null && (
        <div className={`s text-[12px] ${subClass} ${subDirection ?? ''}`.trim()}>{sub}</div>
      )}
    </div>
  )
}
