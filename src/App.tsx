import { useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { LocalOnly } from './sync/LocalOnly'
import type { SyncProvider } from './sync/SyncProvider'
import { useTasks } from './hooks/useTasks'
import { AddTaskInput } from './components/AddTaskInput'
import { TaskList } from './components/TaskList'

// The provider is instantiated once at module level.
// Swap to a RemoteSync implementation here when sync lands (ADR-0002).
const provider: SyncProvider = new LocalOnly()

export default function App() {
  // Memoize to ensure stable reference across re-renders
  const stableProvider = useMemo(() => provider, [])
  const { tasks, loading, addTask, toggleDone, deleteTask } = useTasks(stableProvider)

  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif' }}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b px-4 pt-12 pb-4" style={{ borderColor: 'rgba(60,60,67,0.12)' }}>
        <h1 className="text-3xl font-bold tracking-tight text-apple-label">Tasks</h1>
      </header>

      {/* Add task */}
      <div className="bg-white/95 backdrop-blur-md border-b" style={{ borderColor: 'rgba(60,60,67,0.12)' }}>
        <AddTaskInput onAdd={addTask} />
      </div>

      {/* Task list */}
      <main className="max-w-xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-apple-gray-3 border-t-apple-blue rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <TaskList tasks={tasks} onToggle={toggleDone} onDelete={deleteTask} />
          </AnimatePresence>
        )}
      </main>
    </div>
  )
}
