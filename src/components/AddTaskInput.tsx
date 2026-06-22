import { useState, type KeyboardEvent } from 'react'

interface AddTaskInputProps {
  onAdd: (input: { title: string; done_when?: string; priority?: 1 | 2 | 3 }) => Promise<void>
}

type PriorityOption = 'none' | 'low' | 'med' | 'high'

const PRIORITY_LABELS: { value: PriorityOption; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'med', label: 'Med' },
  { value: 'high', label: 'High' },
]

function priorityOptionToNum(opt: PriorityOption): 1 | 2 | 3 | undefined {
  if (opt === 'low') return 1
  if (opt === 'med') return 2
  if (opt === 'high') return 3
  return undefined
}

interface PriorityControlProps {
  value: PriorityOption
  onChange: (v: PriorityOption) => void
}

function PriorityControl({ value, onChange }: PriorityControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Priority"
      className="flex gap-1 mt-1"
    >
      {PRIORITY_LABELS.map(({ value: opt, label }) => {
        const checked = value === opt
        return (
          <label
            key={opt}
            className={`cursor-pointer text-xs px-2 py-0.5 rounded-full border transition-colors select-none ${
              checked
                ? 'bg-apple-blue text-white border-apple-blue'
                : 'bg-transparent text-apple-gray-1 border-apple-gray-3 hover:border-apple-blue hover:text-apple-blue'
            }`}
          >
            <input
              type="radio"
              name="add-task-priority"
              value={opt}
              checked={checked}
              onChange={() => onChange(opt)}
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

export function AddTaskInput({ onAdd }: AddTaskInputProps) {
  const [value, setValue] = useState('')
  const [doneWhen, setDoneWhen] = useState('')
  const [priority, setPriority] = useState<PriorityOption>('none')
  const [shaking, setShaking] = useState(false)

  const commit = async () => {
    const trimmed = value.trim()
    if (!trimmed) {
      // Brief shake to signal rejection
      setShaking(true)
      setTimeout(() => setShaking(false), 400)
      return
    }
    // Normalize empty/whitespace done_when to undefined before hitting the seam.
    const trimmedDoneWhen = doneWhen.trim()
    await onAdd({
      title: trimmed,
      done_when: trimmedDoneWhen || undefined,
      priority: priorityOptionToNum(priority),
    })
    setValue('')
    setDoneWhen('')
    setPriority('none')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
  }

  return (
    <div className="px-4 py-3">
      <div
        className={`flex items-start gap-3 bg-apple-gray-6 rounded-ios px-4 py-3 transition-all ${
          shaking ? 'animate-shake' : ''
        }`}
      >
        <svg
          className="w-5 h-5 text-apple-gray-1 flex-shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <div className="flex-1 flex flex-col gap-1">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="New task"
            className="bg-transparent text-apple-label placeholder-apple-gray-1 text-base outline-none"
            aria-label="New task title"
          />
          <input
            type="text"
            value={doneWhen}
            onChange={(e) => setDoneWhen(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Done when…"
            className="bg-transparent text-apple-gray-1 placeholder-apple-gray-2 text-sm outline-none"
            aria-label="Done when"
          />
          <PriorityControl value={priority} onChange={setPriority} />
        </div>
      </div>
    </div>
  )
}
