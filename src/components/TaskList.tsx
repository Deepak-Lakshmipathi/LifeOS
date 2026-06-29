import { AnimatePresence, motion } from 'framer-motion'
import type { Task } from '../types'
import { TaskItem } from './TaskItem'
import { groupByDomain } from '../lib/groupByDomain'

interface TaskListProps {
  tasks: Task[]
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdate: (
    id: string,
    patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority' | 'project' | 'domain'>>
  ) => Promise<void>
  projects: string[]
}

export function TaskList({ tasks, onToggle, onDelete, onUpdate, projects }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <motion.div
        key="empty"
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
        <p className="text-lg font-medium text-apple-label">All clear</p>
        <p className="text-sm text-apple-gray-1 mt-1">Add a task above to get started.</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      className="divide-y"
      style={{ '--tw-divide-opacity': '1', borderColor: 'rgba(60,60,67,0.12)' } as React.CSSProperties}
    >
      {groupByDomain(tasks).map((domainGroup) => (
        <div key={domainGroup.key ?? '__inbox_domain__'}>
          {/* Domain header */}
          <div
            data-testid="domain-header"
            className="px-4 pt-5 pb-1 text-sm font-bold uppercase tracking-widest"
            style={{ color: '#3C3C43' }}
          >
            {domainGroup.label}
          </div>
          {/* Project sub-groups within this domain */}
          {domainGroup.projects.map((group) => (
            <div key={group.key ?? '__inbox__'}>
              <div
                className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-apple-gray-1"
                style={{ color: '#8E8E93' }}
              >
                {group.label}
              </div>
              <AnimatePresence initial={false} mode="popLayout">
                {group.tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onUpdate={onUpdate}
                    projects={projects}
                  />
                ))}
              </AnimatePresence>
            </div>
          ))}
        </div>
      ))}
    </motion.div>
  )
}
