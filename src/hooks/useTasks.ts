import { useState, useEffect, useCallback } from 'react'
import type { Task } from '../types'
import type { SyncProvider } from '../sync/SyncProvider'

export interface UseTasksResult {
  tasks: Task[]
  loading: boolean
  addTask: (title: string) => Promise<void>
  toggleDone: (id: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>
}

export function useTasks(provider: SyncProvider): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const all = await provider.list()
    setTasks(all)
  }, [provider])

  useEffect(() => {
    provider.list().then((all) => {
      setTasks(all)
      setLoading(false)
    })
  }, [provider])

  const addTask = useCallback(
    async (title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      await provider.add(trimmed)
      await refresh()
    },
    [provider, refresh]
  )

  const toggleDone = useCallback(
    async (id: string) => {
      await provider.toggleDone(id)
      // Haptic feedback on mobile
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10)
      }
      await refresh()
    },
    [provider, refresh]
  )

  const deleteTask = useCallback(
    async (id: string) => {
      await provider.delete(id)
      await refresh()
    },
    [provider, refresh]
  )

  return { tasks, loading, addTask, toggleDone, deleteTask }
}
