import { AnimatePresence, motion } from 'framer-motion'
import type { Task } from '../types'
import { TaskItem } from './TaskItem'

interface TaskListProps {
  tasks: Task[]
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function TaskList({ tasks, onToggle, onDelete }: TaskListProps) {
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
      <AnimatePresence initial={false} mode="popLayout">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
