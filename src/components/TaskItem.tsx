import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { Task } from '../types'
import { PriorityControl, priorityLabel, type Priority } from './PriorityControl'
import { DOMAINS, DOMAIN_COLORS } from '../data/domains'
import type { Domain } from '../data/domains'

interface TaskItemProps {
  task: Task
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdate: (
    id: string,
    patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority' | 'project' | 'domain'>>
  ) => Promise<void>
  projects: string[]
  /**
   * When true the card belongs to the rescue slot (injected from the coldest
   * domain by rankNow). A ❄ cold-rescue badge is shown; the card has a subtle
   * tint so it stands out from the main NOW set.
   */
  rescue?: boolean
  /**
   * Optional callback fired when this task transitions from !done → done.
   * NowView provides this to own the UndoToast (so the toast survives the
   * card's exit animation).
   */
  onCompleted?: (id: string, title: string) => void
}

export function TaskItem({ task, onToggle, onDelete, onUpdate, projects, rescue, onCompleted }: TaskItemProps) {
  const prefersReducedMotion = useReducedMotion() ?? false

  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [doneWhenDraft, setDoneWhenDraft] = useState(task.done_when ?? '')
  const [priorityDraft, setPriorityDraft] = useState<Priority>(task.priority)
  const [projectDraft, setProjectDraft] = useState(task.project ?? '')
  const [domainDraft, setDomainDraft] = useState(task.domain ?? '')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const committingRef = useRef(false)

  /** True for ~600 ms after a completing tap — drives the ring-pulse animation. */
  const [justTapped, setJustTapped] = useState(false)

  const handleDotTap = async () => {
    if (!task.done) {
      // Completing the task ──────────────────────────────────────────
      if (!prefersReducedMotion) {
        setJustTapped(true)
        window.setTimeout(() => setJustTapped(false), 600)
      }
      // Haptic fires inside useTasks.toggleDone
      await onToggle(task.id)

      if (onCompleted) {
        // NowView owns the UndoToast (card will exit NOW list)
        onCompleted(task.id, task.title)
      }
    } else {
      // Un-completing via dot
      await onToggle(task.id)
    }
  }

  // ── Edit-mode helpers ───────────────────────────────────────────────────────

  const enterEdit = () => {
    setTitleDraft(task.title)
    setDoneWhenDraft(task.done_when ?? '')
    setPriorityDraft(task.priority)
    setProjectDraft(task.project ?? '')
    setDomainDraft(task.domain ?? '')
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

    if (!trimmedTitle) {
      setTitleDraft(task.title)
      titleInputRef.current?.focus()
      return
    }

    const trimmedProject = projectDraft.trim()
    const trimmedDomain = domainDraft.trim()

    const patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority' | 'project' | 'domain'>> = {}
    if (trimmedTitle !== task.title) patch.title = trimmedTitle
    if (trimmedDoneWhen !== (task.done_when ?? '')) patch.done_when = trimmedDoneWhen
    if (priorityDraft !== task.priority) patch.priority = priorityDraft
    if (trimmedProject !== (task.project ?? '')) patch.project = trimmedProject
    if (trimmedDomain !== (task.domain ?? '')) patch.domain = trimmedDomain

    committingRef.current = true
    try {
      if (Object.keys(patch).length > 0) {
        await onUpdate(task.id, patch)
      }
      setEditing(false)
    } catch {
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
      setPriorityDraft(task.priority)
      setProjectDraft(task.project ?? '')
      setDomainDraft(task.domain ?? '')
      setEditing(false)
    }
  }

  // ── Domain-color left-edge glow ─────────────────────────────────────────────
  // Purely visual — does not affect behavior or test selectors.
  const domainColor =
    task.domain && DOMAIN_COLORS[task.domain as Domain]
      ? DOMAIN_COLORS[task.domain as Domain]
      : null

  // ── Card exit animation ──────────────────────────────────────────────────────
  const cardExit = prefersReducedMotion
    ? { opacity: 0, transition: { duration: 0.1 } }
    : {
        // Fade to ~40% then to 0 — the layout collapse is driven by
        // mode="popLayout" in the parent AnimatePresence.
        opacity: [1, 0.38, 0] as number[],
        transition: {
          times: [0, 0.35, 1],
          duration: 0.4,
          ease: 'easeIn' as const,
        },
      }

  // Compose the card's inline style: glass base shadow + optional domain glow
  // on the left edge, plus the rescue tint if applicable.
  const cardStyle: React.CSSProperties = {
    ...(rescue ? { backgroundColor: 'rgba(0, 150, 220, 0.04)' } : {}),
    boxShadow: domainColor
      ? `inset 3px 0 0 ${domainColor}, 0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.50)`
      : '0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.50)',
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={cardExit}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="glass-panel rounded-ios-lg flex items-start gap-3 px-4 py-3 group"
      style={cardStyle}
    >
      {/* ── Status dot ───────────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0 w-6 h-6 mt-0.5">
        {/* Ring pulse — fires once on completing tap, respects reduced motion */}
        <AnimatePresence>
          {justTapped && !prefersReducedMotion && (
            <motion.span
              key="ring-pulse"
              aria-hidden
              className="absolute inset-0 rounded-full pointer-events-none"
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 2.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ border: '2px solid #34C759', borderRadius: '50%' }}
            />
          )}
        </AnimatePresence>

        {/* The dot button */}
        <motion.button
          onClick={handleDotTap}
          aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
          className="absolute inset-0 rounded-full border-2 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue"
          animate={{
            borderColor: task.done ? '#34C759' : '#C7C7CC',
            backgroundColor: task.done ? '#34C759' : 'rgba(0,0,0,0)',
          }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.82 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        >
          <AnimatePresence>
            {task.done && (
              <motion.svg
                key="check"
                initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
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
      </div>

      {/* ── Title + done_when + priority ─────────────────────────────────── */}
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
            <input
              type="text"
              list={`project-suggestions-${task.id}`}
              value={projectDraft}
              onChange={(e) => setProjectDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commit}
              placeholder="Project…"
              className="bg-transparent text-sm text-apple-gray-1 placeholder-apple-gray-2 outline-none border-b border-apple-gray-3 focus:border-apple-blue"
              aria-label="Edit project"
            />
            <datalist id={`project-suggestions-${task.id}`}>
              {projects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <select
              value={domainDraft}
              onChange={(e) => setDomainDraft(e.target.value)}
              onBlur={commit}
              className="bg-transparent text-sm text-apple-gray-1 outline-none border-b border-apple-gray-3 focus:border-apple-blue"
              aria-label="Edit domain"
            >
              <option value="">Domain…</option>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <PriorityControl
              name={`edit-priority-${task.id}`}
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
                aria-label={`Priority ${priorityLabel(task.priority)}`}
                title={`Priority ${priorityLabel(task.priority)}`}
              >
                {priorityLabel(task.priority)}
              </motion.span>
            )}
            {task.project && (
              <motion.span
                layout
                className="block text-xs leading-snug select-none text-apple-gray-2 mt-0.5"
                animate={{ opacity: task.done ? 0.38 : 1 }}
                transition={{ duration: 0.2 }}
              >
                {task.project}
              </motion.span>
            )}
            {/* ❄ rescue badge — shown only for the cold-domain rescue card */}
            {rescue && (
              <span
                className="inline-flex items-center gap-0.5 mt-1 text-xs px-1.5 py-0.5 rounded-full select-none"
                style={{ backgroundColor: 'rgba(0,150,220,0.10)', color: '#0096DC' }}
                aria-label="Cold domain rescue task"
              >
                ❄ cold rescue
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Delete button — visible on hover/focus ───────────────────────── */}
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
