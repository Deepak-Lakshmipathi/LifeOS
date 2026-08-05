import { useEffect, useState } from 'react'
import type { Task } from '../../types'
import { MissionCard } from './MissionCard'
import { DayReview } from './DayReview'
import { HabitsCard } from './HabitsCard'
import { TodayCard } from './TodayCard'
import { AttentionCard } from './AttentionCard'
import { FleetStrip } from './FleetStrip'
import { useTimeOfDay } from '../../hooks/useTimeOfDay'
import type { CockpitMode } from '../../lib/timeOfDay'
import { parseBrief, latestBriefPath } from '../../vault/briefs'
import { getVaultTransport, type VaultTransport } from '../../vault/transport'

/**
 * HomeView — the Home tab.
 *
 * S24 landed the v1 NOW content here verbatim (balance-brain task list +
 * capture) so no functionality was lost in the shell restructure. S27
 * replaced the top of that list with Today's Mission — the same
 * balance-brain picks, now with why + done_when always visible (§4.3, §8) —
 * via the MissionCard/missionPicks seam. S29 prepends the evening-only Day
 * Review (§6) full-width, ahead of everything else, when `useTimeOfDay`
 * resolves to `pm`. S32 (this slice) is the head of the right-stack chain:
 * it introduces the §5 two-column Home body (`1.5fr 1fr`, 1 col ≤840px —
 * same breakpoint idiom MoneyView already uses) and mounts the first
 * right-stack card, HabitsCard, with no data props (it self-loads via the
 * transport seam — see HabitsCard's own "head of chain" comment, mirroring
 * VitalsRow). S34 prepends TodayCard ahead of HabitsCard in that same
 * stack, per §5's documented order (Today, then Habits, then a Fleet
 * mini-strip in a later slice) — it takes `tasks` (already in scope here
 * for MissionCard) and self-loads calendar events the same way HabitsCard
 * self-loads habits. S37 mounts AttentionCard ("Needs you", §4.4) in the
 * left stack below MissionCard — same "head of chain" self-load
 * convention, no data props from here. S48 mounts FleetStrip ("Fleet mini
 * strip", §4.7/§5) at the bottom of the right stack, below HabitsCard —
 * same self-load convention, no data props from here. This is the ONLY
 * place that changes for new right-stack cards; App mounts HomeView once
 * and never edits it again.
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
 * S58 makes Home ONLY the check-in surface, per owner feedback: the
 * Up next / Later folds (`NowView`, previously rendered here with
 * `hideLive`) move out entirely into the new Tasks tab
 * (`src/components/tasks/TasksView.tsx`), alongside the old Domains/Pulse
 * top-level tabs as `Segmented` sub-nav segments. Home keeps MissionCard,
 * AttentionCard and the whole right stack (Today, Habits, Fleet strip).
 *
 * **Capture is NOT here — do not add it back.** History, so this isn't
 * re-litigated a third time: v1 put capture on the bottom TabBar's `+`; the
 * cockpit's tab bar is a top pill with no `+`, so S58 parked the add flow on
 * Home as a "+ New task" button. #183 finished the S58 thought the owner had
 * actually asked for — if Home is only the check-in surface, a write
 * affordance does not belong on it. The button and its bottom sheet now live
 * in `TasksView`, which is the only capture surface in the app. HomeView
 * takes no `onAdd` prop at all, so re-adding capture here is a deliberate
 * act, not an accident.
 */

interface HomeViewProps {
  tasks: Task[]
  onToggle: (id: string) => Promise<void>
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
  /** Read seam for the brief self-load. Defaults to the shared vault transport (S66/#176). */
  briefTransport?: VaultTransport
}

export function HomeView({
  tasks,
  onToggle,
  modeOverride,
  briefLines: briefLinesProp,
  briefTransport,
}: HomeViewProps) {
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
  // GitTransport.readFiles() walks the `Briefs/` folder recursively (S61/
  // #158 — the same transport extension that taught it to reach
  // `agents/<name>/status.json`), so the live self-load resolves today's
  // brief when `Briefs/<date>.md` exists instead of always rendering nothing.
  useEffect(() => {
    if (briefLinesProp !== undefined) return
    // No unconfigured-vault short-circuit here (S62/#155 — deleted):
    // GitTransport itself now rejects synchronously before the dynamic
    // isomorphic-git import when unconfigured, so the try/catch below
    // already lands on the same "render nothing" empty state.
    let live = true
    ;(async () => {
      try {
        const t = briefTransport ?? getVaultTransport()
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
          <div className="mb-3">
            <MissionCard tasks={tasks} onToggle={onToggle} />
          </div>

          <div className="mb-3">
            <AttentionCard />
          </div>
        </div>

        {/* Right stack (§5): Today (calendar), Habits, Fleet mini-strip. */}
        <div className="flex flex-col gap-3">
          <TodayCard tasks={tasks} />
          <HabitsCard />
          <FleetStrip />
        </div>
      </div>

    </div>
  )
}
