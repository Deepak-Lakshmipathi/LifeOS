import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Task } from '../../types'
import { NowView } from '../NowView'
import { CaptureSheet } from '../CaptureSheet'

/**
 * HomeView — the Home tab.
 *
 * S24 lands the v1 NOW content here verbatim (balance-brain task list +
 * capture) so no functionality is lost in the shell restructure. Later slices
 * (S27+) grow this into Today's Mission / Needs You / calendar / habits /
 * fleet-strip per §5 — but this is the ONLY place that changes for those; App
 * mounts HomeView once and never edits it again.
 *
 * Capture used to live on the bottom TabBar's `+` button; the cockpit's tab
 * bar is a top pill with no `+`, so the add flow moves in here as a "New task"
 * button that opens the same bottom sheet.
 */

type AddInput = {
  title: string
  done_when?: string
  priority?: 1 | 2 | 3
  project?: string
  domain?: string
}

interface HomeViewProps {
  tasks: Task[]
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdate: (
    id: string,
    patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority' | 'project' | 'domain'>>
  ) => Promise<void>
  onAdd: (input: AddInput) => Promise<void>
  projects: string[]
}

export function HomeView({ tasks, onToggle, onDelete, onUpdate, onAdd, projects }: HomeViewProps) {
  const [addOpen, setAddOpen] = useState(false)

  const handleAdd = async (input: AddInput) => {
    await onAdd(input)
    setAddOpen(false)
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-[999px] border border-panel-brd bg-panel px-4 py-[7px] text-[13px] text-txt backdrop-blur-seg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-txt"
        >
          + New task
        </button>
      </div>

      <NowView
        tasks={tasks}
        onToggle={onToggle}
        onDelete={onDelete}
        onUpdate={onUpdate}
        projects={projects}
      />

      {/* Add task sheet — slides up from bottom (v1 capture flow, unchanged behavior). */}
      <AnimatePresence>
        {addOpen && (
          <motion.div
            key="add-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={() => setAddOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute bottom-0 left-0 right-0 mx-auto max-w-shell rounded-t-card border border-panel-brd bg-panel backdrop-blur-card"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between px-4 pb-1">
                <span className="text-base font-semibold text-txt">New Task</span>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="text-sm font-medium text-dim focus:outline-none"
                >
                  Cancel
                </button>
              </div>
              <CaptureSheet onAdd={handleAdd} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
