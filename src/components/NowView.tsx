import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Task } from '../types'
import { TaskItem } from './TaskItem'
import { rankNow } from '../now/rankNow'

interface NowViewProps {
  tasks: Task[]
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdate: (
    id: string,
    patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority' | 'project' | 'domain'>>
  ) => Promise<void>
  projects: string[]
}

const LIVE_COUNT = 3
const UPNEXT_COUNT = 5

export function NowView({ tasks, onToggle, onDelete, onUpdate, projects }: NowViewProps) {
  const ranked = rankNow(tasks)

  if (ranked.length === 0) {
    return (
      <motion.div
        key="now-empty"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col items-center justify-center py-20 px-8 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-apple-gray-6 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-apple-gray-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-lg font-medium text-apple-label">Nothing for now</p>
        <p className="text-sm text-apple-gray-1 mt-1">You're all caught up.</p>
      </motion.div>
    )
  }

  const live = ranked.slice(0, LIVE_COUNT)
  const upNext = ranked.slice(LIVE_COUNT, LIVE_COUNT + UPNEXT_COUNT)
  const later = ranked.slice(LIVE_COUNT + UPNEXT_COUNT)

  const taskRow = (task: Task) => (
    <TaskItem
      key={task.id}
      task={task}
      onToggle={onToggle}
      onDelete={onDelete}
      onUpdate={onUpdate}
      projects={projects}
    />
  )

  return (
    <motion.div
      layout
      className="divide-y"
      style={{ '--tw-divide-opacity': '1', borderColor: 'rgba(60,60,67,0.12)' } as React.CSSProperties}
    >
      {/* Live cards — the NOW queue */}
      <AnimatePresence initial={false} mode="popLayout">
        {live.map(taskRow)}
      </AnimatePresence>

      {upNext.length > 0 && (
        <FoldSection label="Up next" count={upNext.length}>
          {upNext.map(taskRow)}
        </FoldSection>
      )}

      {later.length > 0 && (
        <FoldSection label="Later" count={later.length}>
          {later.map(taskRow)}
        </FoldSection>
      )}
    </motion.div>
  )
}

interface FoldSectionProps {
  label: string
  count: number
  children: React.ReactNode
}

function FoldSection({ label, count, children }: FoldSectionProps) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-left focus:outline-none"
        style={{ color: '#8E8E93' }}
      >
        <span>{`${label} (${count})`}</span>
        <span aria-hidden className="ml-auto text-apple-gray-2">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <AnimatePresence initial={false} mode="popLayout">
          {children}
        </AnimatePresence>
      )}
    </div>
  )
}
