export type Priority = 1 | 2 | 3 | undefined

/** Display labels for each priority value. `undefined` = no priority set. */
export const PRIORITY_LABELS: { num: Priority; label: string }[] = [
  { num: undefined, label: 'None' },
  { num: 1, label: 'Low' },
  { num: 2, label: 'Med' },
  { num: 3, label: 'High' },
]

/** Label for a set priority (1|2|3), used by the read-only badge. */
export function priorityLabel(p: 1 | 2 | 3): string {
  return PRIORITY_LABELS.find((o) => o.num === p)!.label
}

interface PriorityControlProps {
  /** Radio group name — must be unique per control instance on the page. */
  name: string
  value: Priority
  onChange: (v: Priority) => void
}

export function PriorityControl({ name, value, onChange }: PriorityControlProps) {
  return (
    <div role="radiogroup" aria-label="Priority" className="flex gap-1 mt-1">
      {PRIORITY_LABELS.map(({ num, label }) => {
        const checked = value === num
        return (
          <label
            key={label}
            className={`cursor-pointer text-xs px-2 py-0.5 rounded-full border transition-colors select-none ${
              checked
                ? 'bg-apple-blue text-white border-apple-blue'
                : 'bg-transparent text-apple-gray-1 border-apple-gray-3 hover:border-apple-blue hover:text-apple-blue'
            }`}
          >
            <input
              type="radio"
              name={name}
              checked={checked}
              onChange={() => onChange(num)}
              className="sr-only"
              aria-checked={checked}
            />
            {label}
          </label>
        )
      })}
    </div>
  )
}
