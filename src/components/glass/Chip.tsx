import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

export type ChipVariant = 'dom' | 'p3' | 'p2' | 'rescue'

export interface ChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  variant: ChipVariant
  children: ReactNode
  /**
   * Domain color token for `variant="dom"` (e.g. `'var(--d-build)'`).
   * Sets `--dc` inline on the chip itself; omit when an ancestor (e.g. a
   * future mission-task row) already sets `--dc` in its inline style.
   */
  dc?: string
}

// DESIGN_LANGUAGE.md §4.3 — literal values copied verbatim, nothing invented.
const VARIANT_CLASS: Record<ChipVariant, string> = {
  dom: 'bg-[color-mix(in_srgb,var(--dc)_18%,transparent)] text-[color:var(--dc)]',
  p3: 'bg-[rgba(248,113,113,.15)] text-[#fca5a5]',
  p2: 'bg-[rgba(251,191,36,.14)] text-[#fcd34d]',
  rescue:
    'bg-[rgba(45,212,191,.15)] text-[#5eead4] border border-dashed border-[rgba(94,234,212,.4)]',
}

export function Chip({ variant, children, dc, className = '', style, ...rest }: ChipProps) {
  const mergedStyle: CSSProperties | undefined = dc
    ? ({ ...style, '--dc': dc } as CSSProperties)
    : style

  return (
    <span
      className={[
        // 999px pill per §2.3 ("chips/pills/segments"); no `pill` key exists
        // yet in tailwind.config.js (S20 didn't add one), so the exact
        // documented literal is expressed via a Tailwind arbitrary-value
        // class rather than touching a file outside this ticket's write-set.
        'inline-flex items-center rounded-[999px] px-2.5 py-1',
        'text-[10.5px] font-semibold tracking-[.05em] whitespace-nowrap',
        VARIANT_CLASS[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={mergedStyle}
      {...rest}
    >
      {variant === 'rescue' ? <>❄ {children}</> : children}
    </span>
  )
}
