import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LocalOnly } from './sync/LocalOnly'
import type { SyncProvider } from './sync/SyncProvider'
import { useTasks } from './hooks/useTasks'
import { AddTaskInput } from './components/AddTaskInput'
import { NowView } from './components/NowView'
import { DomainsMap } from './components/DomainsMap'
import { TabBar, type ViewTab } from './components/TabBar'
import { distinctProjects } from './lib/distinctProjects'
import { seedIfEmpty } from './data/seed'

// The provider is instantiated once at module level.
// Swap to a RemoteSync implementation here when sync lands (ADR-0002).
const provider: SyncProvider = new LocalOnly()

/** Pulse is a labeled placeholder — content arrives in S13. */
function PulsePlaceholder() {
  return (
    <motion.div
      key="pulse-placeholder"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center py-20 px-8 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-apple-gray-6 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-apple-gray-2"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      <p className="text-lg font-medium text-apple-label">Pulse</p>
      <p className="text-sm text-apple-gray-1 mt-1">coming soon</p>
    </motion.div>
  )
}

export default function App() {
  const { tasks, loading, refresh, addTask, updateTask, toggleDone, deleteTask } = useTasks(provider)
  const projects = distinctProjects(tasks)
  const [tab, setTab] = useState<ViewTab>('now')
  const [addOpen, setAddOpen] = useState(false)

  // One-shot seed import on mount: no-ops when DB is non-empty or ?noseed is set (ADR-0006).
  // After seeding, refresh the task list so the UI reflects the new rows.
  useEffect(() => {
    seedIfEmpty(provider).then((count) => {
      if (count > 0) refresh()
    })
  }, [refresh])

  const handleAddTask = async (input: {
    title: string
    done_when?: string
    priority?: 1 | 2 | 3
    project?: string
    domain?: string
  }) => {
    await addTask(input)
    setAddOpen(false)
  }

  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif' }}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b px-4 pt-12 pb-4" style={{ borderColor: 'rgba(60,60,67,0.12)' }}>
        <h1 className="text-3xl font-bold tracking-tight text-apple-label">Tasks</h1>
      </header>

      {/* Tab content — pb-20 clears the fixed tab bar height */}
      <main className="max-w-xl mx-auto pb-20">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-apple-gray-3 border-t-apple-blue rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {tab === 'now' && (
              <NowView
                key="now"
                tasks={tasks}
                onToggle={toggleDone}
                onDelete={deleteTask}
                onUpdate={updateTask}
                projects={projects}
              />
            )}
            {tab === 'domains' && (
              <DomainsMap
                key="domains"
                tasks={tasks}
              />
            )}
            {tab === 'pulse' && <PulsePlaceholder key="pulse" />}
          </AnimatePresence>
        )}
      </main>

      {/* Bottom tab bar — fixed, safe-area aware */}
      <TabBar active={tab} onTabChange={setTab} onAdd={() => setAddOpen(true)} />

      {/* Add task sheet — slides up from bottom when + tab is tapped */}
      <AnimatePresence>
        {addOpen && (
          <motion.div
            key="add-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30"
            style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
            onClick={() => setAddOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-ios-lg shadow-ios-md"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sheet drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-apple-gray-4" />
              </div>
              {/* Sheet header */}
              <div className="flex items-center justify-between px-4 pb-1">
                <span className="text-base font-semibold text-apple-label">New Task</span>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="text-sm font-medium focus:outline-none"
                  style={{ color: '#007AFF' }}
                >
                  Cancel
                </button>
              </div>
              <AddTaskInput onAdd={handleAddTask} projects={projects} tasks={tasks} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
