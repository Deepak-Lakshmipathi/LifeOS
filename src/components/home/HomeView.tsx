import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Task } from '../../types'
import { NowView } from '../NowView'
import { CaptureSheet } from '../CaptureSheet'
import { MissionCard } from './MissionCard'
import { DayReview } from './DayReview'
import { HabitsCard } from './HabitsCard'
import { TodayCard } from './TodayCard'
import { useTimeOfDay } from '../../hooks/useTimeOfDay'
import type { CockpitMode } from '../../lib/timeOfDay'

/**
 * HomeView — the Home tab.
 *
 * S24 landed the v1 NOW content here verbatim (balance-brain task list +
 * capture) so no functionality was lost in the shell restructure. S27
 * (this slice) replaces the top of that NOW list with Today's Mission — the
 * same balance-brain picks, now with why + done_when always visible
 * (§4.3, §8) — via the new MissionCard/missionPicks seam; NowView still owns
 * the fuller Up next / Later fold sections below it. S29 prepends the
 * evening-only Day Review (§6) full-width, ahead of everything else, when
 * `useTimeOfDay` resolves to `pm`. S32 (this slice) is the head of the
 * right-stack chain: it introduces the §5 two-column Home body
 * (`1.5fr 1fr`, 1 col ≤840px — same breakpoint idiom MoneyView already
 * uses) and mounts the first right-stack card, HabitsCard, with no data
 * props (it self-loads via the transport seam — see HabitsCard's own
 * "head of chain" comment, mirroring VitalsRow). S34 prepends TodayCard
 * ahead of HabitsCard in that same stack, per §5's documented order (Today,
 * then Habits, then a Fleet mini-strip in a later slice) — it takes `tasks`
 * (already in scope here for MissionCard/NowView) and self-loads calendar
 * events the same way HabitsCard self-loads habits. Later slices grow the
 * right stack further (Fleet mini-strip per §5) and the left stack (Needs
 * You) — this is the ONLY place that changes for those; App mounts
 * HomeView once and never edits it again.
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
  /**
   * S29: forces `useTimeOfDay`'s mode for deterministic Day Review
   * visibility tests (same injection pattern Header's own seg-control
   * override uses). Omitted in the app — the wall clock decides.
   */
  modeOverride?: CockpitMode
}

export function HomeView({
  tasks,
  onToggle,
  onDelete,
  onUpdate,
  onAdd,
  projects,
  modeOverride,
}: HomeViewProps) {
  const [addOpen, setAddOpen] = useState(false)
  // Own useTimeOfDay instance (mirrors Header's, same wall clock — both
  // agree under normal operation). Known gap, out of this slice's write-set
  // to fix: Header's seg-control override is component-local state, so
  // manually forcing "Evening" in the header won't flip Day Review into view
  // this session; App.tsx (the only place that could lift shared mode state)
  // is S24's exclusive hotspot.
  const { mode } = useTimeOfDay(modeOverride)

  const handleAdd = async (input: AddInput) => {
    await onAdd(input)
    setAddOpen(false)
  }

  return (
    <div>
      {mode === 'pm' && (
        <div className="mb-3">
          <DayReview tasks={tasks} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 [@media(min-width:841px)]:grid-cols-[1.5fr_1fr]">
        <div>
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

          <div className="mb-3">
            <MissionCard tasks={tasks} onToggle={onToggle} />
          </div>

          <NowView
            tasks={tasks}
            onToggle={onToggle}
            onDelete={onDelete}
            onUpdate={onUpdate}
            projects={projects}
            hideLive
          />
        </div>

        {/* Right stack (§5): Today (calendar) + Habits; Fleet mini-strip
            joins this column in a later slice (S37+). */}
        <div className="flex flex-col gap-3">
          <TodayCard tasks={tasks} />
          <HabitsCard />
        </div>
      </div>

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
