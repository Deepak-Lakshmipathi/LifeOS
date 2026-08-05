import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Task } from '../../types'
import { CaptureSheet } from '../CaptureSheet'
import { NowView } from '../NowView'
import { DomainsMap } from '../DomainsMap'
import { PulseView } from '../PulseView'
import { Segmented } from '../glass/Segmented'

/**
 * TasksView — the Tasks tab (Slice S58).
 *
 * Home used to own the NowView task list plus two whole top-level tabs
 * (Domains, Pulse). Owner feedback: Home should be ONLY the check-in surface;
 * everything list-shaped re-parents here behind a `Segmented` sub-nav
 * (§4.1's small `.seg` size) — `Tasks · Domains · Pulse`, default `Tasks`.
 *
 * This is a re-parenting slice, not a rewrite: `NowView`, `DomainsMap` and
 * `PulseView` render verbatim, unchanged. NowView renders with `hideLive`
 * OFF here (the default) — MissionCard no longer sits above it in this view,
 * so the top-ranked tasks must be visible, not hidden.
 *
 * #183: capture now lives HERE and nowhere else. S58 had put `+ New task` on
 * Home (the cockpit's tab bar is a top pill with no `+`, so the v1 bottom-bar
 * add flow had to land somewhere); the owner's call is that Home is a
 * check-in surface, and capture belongs with the tasks. The button and its
 * bottom sheet moved from `HomeView` verbatim — same `CaptureSheet`, same
 * markup, same `aria-label="Add task"`.
 *
 * The button sits ABOVE the `Segmented` sub-nav, so it belongs to the tab
 * rather than to a segment and is present on all three (owner decision,
 * 2026-08-05). Capturing a task is exactly what you want to do while looking
 * at Domains or Pulse, and a button that appears and disappears as you switch
 * segments is a worse affordance than one that simply stays put.
 *
 * Beyond capture, props are still pass-through; this file owns no
 * data/ranking logic of its own.
 */

type SegmentId = 'tasks' | 'domains' | 'pulse'

const SEGMENTS: { id: SegmentId; label: string }[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'domains', label: 'Domains' },
  { id: 'pulse', label: 'Pulse' },
]

type AddInput = {
  title: string
  done_when?: string
  priority?: 1 | 2 | 3
  project?: string
  domain?: string
}

interface TasksViewProps {
  tasks: Task[]
  onToggle: (id: string) => Promise<void>
  onAdd: (input: AddInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdate: (
    id: string,
    patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority' | 'project' | 'domain'>>
  ) => Promise<void>
  projects: string[]
}

export function TasksView({ tasks, onToggle, onAdd, onDelete, onUpdate, projects }: TasksViewProps) {
  const [segment, setSegment] = useState<SegmentId>('tasks')
  const [addOpen, setAddOpen] = useState(false)

  const handleAdd = async (input: AddInput) => {
    await onAdd(input)
    setAddOpen(false)
  }

  return (
    <div>
      {/* Above the sub-nav on purpose (#183): capture belongs to the Tasks
          tab, not to any one segment, so it never moves or vanishes. */}
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Add task"
          className="rounded-[999px] border border-panel-brd bg-panel px-4 py-[7px] text-[13px] text-txt backdrop-blur-seg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-txt"
        >
          + New task
        </button>
      </div>

      <div className="mb-3 flex justify-center">
        <Segmented
          options={SEGMENTS}
          value={segment}
          onChange={(id) => setSegment(id as SegmentId)}
          ariaLabel="Tasks sub-navigation"
        />
      </div>

      {segment === 'tasks' && (
        <NowView
          tasks={tasks}
          onToggle={onToggle}
          onDelete={onDelete}
          onUpdate={onUpdate}
          projects={projects}
        />
      )}
      {segment === 'domains' && <DomainsMap tasks={tasks} />}
      {segment === 'pulse' && <PulseView tasks={tasks} />}

      {/* Add task sheet — slides up from bottom (v1 capture flow, unchanged
          behavior). Moved here from HomeView by #183, markup verbatim. */}
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
