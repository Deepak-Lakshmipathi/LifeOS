import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
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
const TAB_FADE = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
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
 * OWNERSHIP (wave 14, 2026-08-01 — supersedes S58's sole-toucher clause).
 * The single-owner rule was a serialization guard, not a design constraint;
 * three wave-14 slices must edit this file, so it is retired in favour of an
 * explicit order. This file is a HOTSPOT: edit it only from a slice listed
 * here, and rebase on the prior one rather than editing in parallel.
 *   1. S63 (#173) — removes the shell's `AnimatePresence mode="wait"`; its
 *      presence-acknowledgement protocol is what blanks the app when a tab
 *      panel joins it implicitly (via `exit` OR `layout`/`layoutId`).
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
            <AnimatePresence mode="wait">
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
            </AnimatePresence>
          )}
        </main>

        <footer className="mt-10 text-center text-xs text-faint">LifeOS · your life, one cockpit</footer>
      </div>
    </div>
  )
}
