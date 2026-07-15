import { useCallback, useRef } from 'react'
import type { HTMLAttributes, MouseEvent, ReactNode } from 'react'

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode
  /** Card heading — DESIGN_LANGUAGE §2.2 `h2` (12px/600, uppercase, --faint). */
  heading?: string
  /** Appended after the heading as ` · N` (e.g. "Needs you · 4"). */
  count?: number
}

/**
 * DESIGN_LANGUAGE.md §4 — shared card base every later card/tile composes.
 * Panel fill + hairline border + r18 + blur(16px) + overflow hidden, plus
 * the REQUIRED cursor spotlight: a `::before` radial gradient positioned at
 * `--mx/--my`, updated by a mousemove listener on the card itself.
 *
 * The spotlight is reproduced via Tailwind `before:` arbitrary-value
 * utilities rather than a new stylesheet rule, since this component's
 * write-set is this file alone. Every literal in the gradient (420px,
 * rgba(255,255,255,.08), 60%, the --mx/--my defaults of 50%/-40%) is
 * copied verbatim from §4 — nothing invented.
 */
export function Card({
  children,
  className = '',
  heading,
  count,
  onMouseMove,
  ...rest
}: CardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const el = ref.current
      if (el) {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
      }
      onMouseMove?.(e)
    },
    [onMouseMove]
  )

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={[
        'relative overflow-hidden bg-panel border border-panel-brd rounded-card',
        'backdrop-blur-card px-5 py-[18px]',
        "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none",
        'before:bg-[radial-gradient(420px_circle_at_var(--mx,50%)_var(--my,-40%),rgba(255,255,255,.08),transparent_60%)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {heading != null && (
        <h2 className="mb-[14px] text-[12px] font-semibold uppercase tracking-[.12em] text-faint">
          {heading}
          {typeof count === 'number' ? ` · ${count}` : null}
        </h2>
      )}
      {children}
    </div>
  )
}
