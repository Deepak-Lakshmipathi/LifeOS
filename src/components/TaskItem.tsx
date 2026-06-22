import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Task } from '../types'

interface TaskItemProps {
  task: Task
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdate: (
    id: string,
    patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority'>>
  ) => Promise<void>
}

// ---- Priority helpers -------------------------------------------------------

type PriorityOption = 'none' | 'low' | 'med' | 'high'

const PRIORITY_LABELS: { value: PriorityOption; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'med', label: 'Med' },
  { value: 'high', label: 'High' },
]

function numToPriorityOption(p: 1 | 2 | 3 | undefined): PriorityOption {
  if (p === 1) return 'low'
  if (p === 2) return 'med'
  if (p === 3) return 'high'
  return 'none'
}

function priorityOptionToNum(opt: PriorityOption): 1 | 2 | 3 | undefined {
  if (opt === 'low') return 1
  if (opt === 'med') return 2
  if (opt === 'high') return 3
  return undefined
}

const WEIGHT_BADGE: Record<1 | 2 | 3, string> = {
  1: 'Low',
  2: 'Med',
  3: 'High',
}

// ---- PriorityControl (shared within this file) ------------------------------

interface PriorityControlProps {
  taskId: string
  value: PriorityOption
  onChange: (v: PriorityOption) => void
}

function PriorityControl({ taskId, value, onChange }: PriorityControlProps) {
  const groupName = `edit-priority-${taskId}`
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
              name={groupName}
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

// ---- TaskItem ----------------------------------------------------------------

export function TaskItem({ task, onToggle, onDelete, onUpdate }: TaskItemProps) {
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [doneWhenDraft, setDoneWhenDraft] = useState(task.done_when ?? '')
  const [priorityDraft, setPriorityDraft] = useState<PriorityOption>(
    numToPriorityOption(task.priority)
  )
  const titleInputRef = useRef<HTMLInputElement>(null)
  // Guards against double-commit (Enter then blur) and re-entrant commits.
  const committingRef = useRef(false)

  const enterEdit = () => {
    setTitleDraft(task.title)
    setDoneWhenDraft(task.done_when ?? '')
    setPriorityDraft(numToPriorityOption(task.priority))
    setEditing(true)
  }

  useEffect(() => {
    if (editing) {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }
  }, [editing])

  const commit = async () => {
    if (committingRef.current) return
    const trimmedTitle = titleDraft.trim()
    const trimmedDoneWhen = doneWhenDraft.trim()

    // Empty title is rejected by the seam — keep the row in edit mode,
    // restore the prior title, never produce a nameless task.
    if (!trimmedTitle) {
      setTitleDraft(task.title)
      titleInputRef.current?.focus()
      return
    }

    const patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority'>> = {}
    if (trimmedTitle !== task.title) patch.title = trimmedTitle
    // Emptying done_when clears it (seam unsets on empty/whitespace).
    if (trimmedDoneWhen !== (task.done_when ?? '')) patch.done_when = trimmedDoneWhen
    // Priority: always include in patch so "none" clears it.
    const newPriorityNum = priorityOptionToNum(priorityDraft)
    if (newPriorityNum !== task.priority) patch.priority = newPriorityNum

    committingRef.current = true
    try {
      if (Object.keys(patch).length > 0) {
        await onUpdate(task.id, patch)
      }
      setEditing(false)
    } catch {
      // Seam rejected (e.g. emptied title) — stay in edit mode, preserve title.
      setTitleDraft(task.title)
      titleInputRef.current?.focus()
    } finally {
      committingRef.current = false
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setTitleDraft(task.title)
      setDoneWhenDraft(task.done_when ?? '')
      setPriorityDraft(numToPriorityOption(task.priority))
      setEditing(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex items-start gap-3 px-4 py-3 group"
    >
      {/* Completion circle */}
      <motion.button
        onClick={() => onToggle(task.id)}
        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
        className="flex-shrink-0 w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue"
        style={{
          borderColor: task.done ? '#34C759' : '#C7C7CC',
          backgroundColor: task.done ? '#34C759' : 'transparent',
        }}
        whileTap={{ scale: 0.85 }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      >
        <AnimatePresence>
          {task.done && (
            <motion.svg
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
              className="w-3.5 h-3.5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Title + done_when + priority */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex flex-col gap-1">
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commit}
              className="bg-transparent text-base leading-snug text-apple-label outline-none border-b border-apple-gray-3 focus:border-apple-blue"
              aria-label="Edit task title"
            />
            <input
              type="text"
              value={doneWhenDraft}
              onChange={(e) => setDoneWhenDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commit}
              placeholder="Done when…"
              className="bg-transparent text-sm text-apple-gray-1 placeholder-apple-gray-2 outline-none border-b border-apple-gray-3 focus:border-apple-blue"
              aria-label="Edit done when"
            />
            <PriorityControl
              taskId={task.id}
              value={priorityDraft}
              onChange={setPriorityDraft}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={enterEdit}
            className="block w-full text-left focus:outline-none"
            aria-label="Edit task"
          >
            <motion.span
              layout
              className="block text-base leading-snug select-none"
              animate={{
                opacity: task.done ? 0.38 : 1,
                textDecoration: task.done ? 'line-through' : 'none',
              }}
              transition={{ duration: 0.2 }}
              style={{ color: task.done ? '#8E8E93' : '#000000' }}
            >
              {task.title}
            </motion.span>
            {task.done_when && (
              <motion.span
                layout
                className="block text-sm leading-snug select-none text-apple-gray-1"
                animate={{ opacity: task.done ? 0.38 : 1 }}
                transition={{ duration: 0.2 }}
              >
                {task.done_when}
              </motion.span>
            )}
            {task.priority != null && (
              <motion.span
                layout
                animate={{ opacity: task.done ? 0.38 : 1 }}
                transition={{ duration: 0.2 }}
                className="inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded-full border border-apple-gray-3 text-apple-gray-1 select-none"
                aria-label={`Priority ${WEIGHT_BADGE[task.priority]}`}
                title={`Priority ${WEIGHT_BADGE[task.priority]}`}
              >
                {WEIGHT_BADGE[task.priority]}
              </motion.span>
            )}
          </button>
        )}
      </div>

      {/* Delete button — visible on hover/focus */}
      <motion.button
        onClick={() => onDelete(task.id)}
        aria-label="Delete task"
        className="flex-shrink-0 w-6 h-6 mt-0.5 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-red opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
        style={{ color: '#FF3B30' }}
        whileTap={{ scale: 0.85 }}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </motion.button>
    </motion.div>
  )
}
