import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { LocalOnly } from './sync/LocalOnly'
import { VaultSync } from './sync/VaultSync'
import type { SyncProvider } from './sync/SyncProvider'
import { useTasks } from './hooks/useTasks'
import { Aurora } from './components/glass/Aurora'
import { Header } from './components/cockpit/Header'
import { VitalsRow } from './components/cockpit/VitalsRow'
import { TabBar, type ViewTab } from './components/TabBar'
import { HomeView } from './components/home/HomeView'
import { TasksView } from './components/tasks/TasksView'
import { MoneyView } from './components/money/MoneyView'
import { CareerView } from './components/career/CareerView'
import { AgentsView } from './components/agents/AgentsView'
import { distinctProjects } from './lib/distinctProjects'
import { seedIfEmpty } from './data/seed'
import { clearVaultPat } from './vault/pat'

// The provider is instantiated once at module level.
// Swap to a RemoteSync implementation here when sync lands (ADR-0002).
const provider: SyncProvider = import.meta.env.VITE_VAULT === '1' ? new VaultSync() : new LocalOnly()

// §7 tab fade: opacity + 6px rise over .3s ease — the same framer-motion
// `useReducedMotion()` gate the rest of the app uses (TaskItem, UndoToast).
// Under reduced motion the section still swaps, just with no movement/fade.
//
// ENTER-ONLY, DELIBERATELY (S63/#173 — docs/adr/0015-shell-owns-no-presence-protocol.md).
// This object declares no leaving state, and the sections below are NOT wrapped
// in framer-motion's presence component. That wrapper runs an acknowledgement
// protocol which any descendant of any panel can join implicitly — by declaring
// a leaving state, or `layout`/`layoutId` — with no opt-in, no type-level
// signal, no retry once the edge is missed, and no timeout anywhere in the path.
// Under `mode="wait"` a single unacknowledged descendant means the incoming
// panel never renders at all: the app blanks with stale, invisible, still
// hit-testable content mounted underneath, recoverable only by reload. That was
// #173, the highest-severity find of the 2026-07-31 live-testing session.
// The shell's correctness must not be a function of the internal animation
// details of arbitrary panel descendants, so the shell hosts no such protocol:
// React unmounts the outgoing section synchronously on the `key` change.
// Note that TAB_STATIC has never declared a leaving state and has always
// worked — this makes the motion branch match the branch already proven correct.
// The cost is the outgoing fade, which becomes a cut; §2.3 specifies a duration,
// two properties and an intent, and mandates no leaving animation. DO NOT
// re-introduce the presence wrapper here (src/test/shellNavigation.test.tsx
// guards this), and do not paper over it with a watchdog or exit-complete
// timeout — that compensates for a protocol you can simply not use.
const TAB_FADE = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: 'easeOut' },
} as const
const TAB_STATIC = { initial: false, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } } as const

/**
 * App — the Glass Cockpit shell (§5). Its only job is layout + mount points:
 * an aurora canvas ground (z0), then the 1180px `.shell` (z1) holding the
 * header slot, vitals slot, the five-tab pill bar, one section per tab, and a
 * footer. Every tab section is its own component — App carries NO mission,
 * vitals-data, or money logic inline, so from here on each later slice edits
 * only its own file and never this one.
 *
 * S58 folded the old Domains/Pulse top-level tabs into the new Tasks tab
 * (`TasksView`, which owns their imports + a `Segmented` sub-nav).
 *
 * S63 (#173) removed the presence wrapper that used to surround the tab
 * sections. The shell is a microkernel and the tab panels are plugins; that
 * wrapper's `mode="wait"` acknowledgement protocol let a plugin hang the core.
 * The shell now owns no such protocol — see the TAB_FADE block below and
 * docs/adr/0015-shell-owns-no-presence-protocol.md before adding any motion
 * choreography across tab sections.
 *
 * OWNERSHIP (wave 14, 2026-08-01 — supersedes S58's sole-toucher clause).
 * The single-owner rule was a serialization guard, not a design constraint;
 * three wave-14 slices must edit this file, so it is retired in favour of an
 * explicit order. This file is a HOTSPOT: edit it only from a slice listed
 * here, and rebase on the prior one rather than editing in parallel.
 *   1. S63 (#173) — LANDED. Removed the shell's `mode="wait"` presence
 *      wrapper; its acknowledgement protocol is what blanked the app when a
 *      tab panel joined it implicitly (via a leaving state OR
 *      `layout`/`layoutId`). See ADR-0015.
 *   2. S70 (#180) — lifts cockpit mode state so Header and HomeView stop
 *      holding separate `useTimeOfDay` instances. Rebase on S63.
 *   3. S73 (#183) — threads `onAdd` to `TasksView` when capture moves off
 *      Home. Rebase on whatever landed before it.
 * Add the next slice to this list rather than deleting the rule.
 */
export default function App() {
  const { tasks, loading, error, refresh, addTask, updateTask, toggleDone, deleteTask } = useTasks(provider)
  const projects = distinctProjects(tasks)
  const [tab, setTab] = useState<ViewTab>('home')
  const tabMotion = useReducedMotion() ? TAB_STATIC : TAB_FADE

  // One-shot seed import on mount: no-ops when DB is non-empty or ?noseed is set (ADR-0006).
  useEffect(() => {
    seedIfEmpty(provider).then((count) => {
      if (count > 0) refresh()
    })
  }, [refresh])

  return (
    <div className="relative min-h-screen text-txt">
      <Aurora />

      <div className="relative z-[1] mx-auto max-w-shell px-4 pt-10 pb-16 sm:px-6">
        <Header />
        <VitalsRow />
        <TabBar active={tab} onTabChange={setTab} />

        <main>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-panel-brd border-t-txt" />
            </div>
          ) : error ? (
            <div className="mx-auto mt-8 max-w-md rounded-card border border-panel-brd bg-panel p-4 text-center backdrop-blur-card">
              <p className="text-base font-semibold text-txt">Couldn’t load your vault</p>
              <p className="mt-1 break-words text-sm text-dim">{error}</p>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="text-sm font-medium text-txt"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearVaultPat()
                    window.location.reload()
                  }}
                  className="text-sm font-medium text-txt"
                >
                  Re-enter token
                </button>
              </div>
            </div>
          ) : (
            /* Unwrapped by design — see TAB_FADE above and ADR-0015. The
               `key` change is what swaps tabs: React unmounts the outgoing
               section synchronously and the incoming one fades in. */
            <motion.section key={tab} {...tabMotion}>
              {tab === 'home' && (
                <HomeView tasks={tasks} onToggle={toggleDone} onAdd={addTask} />
              )}
              {tab === 'tasks' && (
                <TasksView
                  tasks={tasks}
                  onToggle={toggleDone}
                  onDelete={deleteTask}
                  onUpdate={updateTask}
                  projects={projects}
                />
              )}
              {tab === 'money' && <MoneyView />}
              {tab === 'career' && <CareerView />}
              {tab === 'agents' && <AgentsView />}
            </motion.section>
          )}
        </main>

        <footer className="mt-10 text-center text-xs text-faint">LifeOS · your life, one cockpit</footer>
      </div>
    </div>
  )
}
