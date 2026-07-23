import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Task } from '../../types'
import { NowView } from '../NowView'
import { CaptureSheet } from '../CaptureSheet'
import { MissionCard } from './MissionCard'
import { DayReview } from './DayReview'
import { HabitsCard } from './HabitsCard'
import { TodayCard } from './TodayCard'
import { AttentionCard } from './AttentionCard'
import { FleetStrip } from './FleetStrip'
import { useTimeOfDay } from '../../hooks/useTimeOfDay'
import type { CockpitMode } from '../../lib/timeOfDay'
import { parseBrief, latestBriefPath } from '../../vault/briefs'
import { GitTransport, type VaultTransport } from '../../vault/transport'

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
 * events the same way HabitsCard self-loads habits. S37 mounts AttentionCard
 * ("Needs you", §4.4) in the left stack below MissionCard — same "head of
 * chain" self-load convention, no data props from here. S48 mounts
 * FleetStrip ("Fleet mini strip", §4.7/§5) at the bottom of the right
 * stack, below HabitsCard — same self-load convention, no data props from
 * here. This is the ONLY place that changes for new right-stack cards; App
 * mounts HomeView once and never edits it again.
 *
 * S50 (the final v2 card) prepends the daily-brief agent's 5-line morning
 * brief (`Briefs/<date>.md`, src/vault/briefs.ts's `parseBrief`) as one
 * small dim block, morning mode ONLY — visually the first thing under the
 * cockpit shell's header greeting, since HomeView's own root is the first
 * thing rendered below that header. Same "head of chain" self-load
 * convention as AttentionCard/FleetStrip: `briefLines` short-circuits the
 * fetch under test. A missing or malformed brief renders nothing (§8: no
 * fake-real data, no error UI) — the block simply doesn't mount rather than
 * showing a placeholder or error. `mode === 'am'` reuses the exact same
 * `useTimeOfDay`/`modeOverride` seam Day Review already uses for its own
 * pm-only gating, so the am-only behavior is testable the same way.
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
  /**
   * S50: today's brief lines (morning-only dim block). Omit in-app
   * (self-loads `Briefs/<date>.md` via `briefTransport`); inject a fixture
   * array (including `[]`) in tests to skip the fetch entirely — same
   * "head of chain" convention as AttentionCard's `items`/FleetStrip's
   * `statuses`.
   */
  briefLines?: string[]
  /** Read seam for the brief self-load. Defaults to a fresh GitTransport. */
  briefTransport?: VaultTransport
}

export function HomeView({
  tasks,
  onToggle,
  onDelete,
  onUpdate,
  onAdd,
  projects,
  modeOverride,
  briefLines: briefLinesProp,
  briefTransport,
}: HomeViewProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [loadedBriefLines, setLoadedBriefLines] = useState<string[]>([])
  // Own useTimeOfDay instance (mirrors Header's, same wall clock — both
  // agree under normal operation). Known gap, out of this slice's write-set
  // to fix: Header's seg-control override is component-local state, so
  // manually forcing "Evening" in the header won't flip Day Review into view
  // this session; App.tsx (the only place that could lift shared mode state)
  // is S24's exclusive hotspot.
  const { mode } = useTimeOfDay(modeOverride)

  // Self-load today's brief from the vault when the caller didn't inject
  // fixture data — the AttentionCard/FleetStrip "head of chain" convention.
  // Note: GitTransport.readFiles() does not yet walk a `Briefs/` folder (it
  // only walks the 7 domain folders + Inbox/Habits/Calendar/Mail) — the same
  // class of gap FleetStrip documented for `agents/` before its own
  // transport extension, so the live self-load always resolves to "no
  // brief" (renders nothing) until a later slice extends the transport.
  // Out of this slice's write-set to fix.
  useEffect(() => {
    if (briefLinesProp !== undefined) return
    if (!briefTransport && !import.meta.env.VITE_VAULT_REPO_URL) return
    let live = true
    ;(async () => {
      try {
        const t = briefTransport ?? new GitTransport()
        const files = await t.readFiles()
        if (!live) return
        const path = latestBriefPath(new Date())
        const md = files.find((f) => f.path === path)?.content ?? null
        setLoadedBriefLines(parseBrief(md))
      } catch {
        // No vault configured / offline / no brief yet — render nothing (§8: no fake-real data, no error UI).
      }
    })()
    return () => {
      live = false
    }
  }, [briefLinesProp, briefTransport])

  const briefLines = briefLinesProp ?? loadedBriefLines

  const handleAdd = async (input: AddInput) => {
    await onAdd(input)
    setAddOpen(false)
  }

  return (
    <div>
      {mode === 'am' && briefLines.length > 0 && (
        <div data-testid="home-brief" className="mb-3 flex flex-col gap-0.5 text-[13px] text-dim">
          {briefLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

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

          <div className="mb-3">
            <AttentionCard />
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

        {/* Right stack (§5): Today (calendar), Habits, Fleet mini-strip. */}
        <div className="flex flex-col gap-3">
          <TodayCard tasks={tasks} />
          <HabitsCard />
          <FleetStrip />
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
