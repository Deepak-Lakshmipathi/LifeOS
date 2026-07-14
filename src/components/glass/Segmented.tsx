export interface SegmentedOption {
  id: string
  label: string
}

export interface SegmentedProps {
  options: SegmentedOption[]
  /** id of the active option. */
  value: string
  onChange: (id: string) => void
  ariaLabel?: string
  className?: string
}

/**
 * DESIGN_LANGUAGE.md §4.1 — frosted pill track, borderless buttons, active
 * = brighter white fill. `role="tablist"`/`role="tab"` per §7's a11y floor;
 * real `<button>`s throughout; visible focus ring for keyboard users.
 */
export function Segmented({ options, value, onChange, ariaLabel, className = '' }: SegmentedProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[
        // 999px pill per §2.3; see Chip.tsx for why this is an arbitrary-
        // value class rather than a named `rounded-pill` Tailwind key.
        'flex bg-panel border border-panel-brd rounded-[999px] p-[3px] backdrop-blur-seg',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {options.map((opt) => {
        const on = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(opt.id)}
            className={[
              'rounded-[999px] px-4 py-[7px] text-[13px] transition',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-txt',
              on ? 'on bg-white/[0.12] text-txt' : 'bg-transparent text-dim',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
