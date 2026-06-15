import { motion, AnimatePresence } from 'framer-motion'
import type { Task } from '../types'

interface TaskItemProps {
  task: Task
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex items-center gap-3 px-4 py-3 group"
    >
      {/* Completion circle */}
      <motion.button
        onClick={() => onToggle(task.id)}
        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
        className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue"
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

      {/* Title */}
      <motion.span
        layout
        className="flex-1 text-base leading-snug select-none"
        animate={{
          opacity: task.done ? 0.38 : 1,
          textDecoration: task.done ? 'line-through' : 'none',
        }}
        transition={{ duration: 0.2 }}
        style={{ color: task.done ? '#8E8E93' : '#000000' }}
      >
        {task.title}
      </motion.span>

      {/* Delete button — visible on hover/focus */}
      <motion.button
        onClick={() => onDelete(task.id)}
        aria-label="Delete task"
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-red opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
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
