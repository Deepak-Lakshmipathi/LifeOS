import { useState, useEffect, useCallback, useRef } from 'react'
import type { Task } from '../types'
import type { SyncProvider } from '../sync/SyncProvider'

export interface UseTasksResult {
  tasks: Task[]
  loading: boolean
  /** Set when the initial load failed (e.g. vault clone/auth error). */
  error: string | null
  refresh: () => Promise<void>
  addTask: (input: { title: string; done_when?: string; priority?: 1 | 2 | 3; project?: string; domain?: string }) => Promise<void>
  updateTask: (
    id: string,
    patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority' | 'project' | 'domain'>>
  ) => Promise<void>
  toggleDone: (id: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>
}

export function useTasks(provider: SyncProvider): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // False once the component unmounts — every async setState below checks it so
  // no state update (or window access) happens post-teardown. See issue #120.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    const all = await provider.list()
    if (!mountedRef.current) return
    setTasks(all)
  }, [provider])

  useEffect(() => {
    provider
      .list()
      .then((all) => {
        if (!mountedRef.current) return
        setTasks(all)
        setLoading(false)
      })
      .catch((e) => {
        if (!mountedRef.current) return
        // Without this, a failed vault clone/auth leaves loading=true forever
        // (infinite spinner). Surface the reason and stop loading instead.
        console.error('[LifeOS] initial task load failed:', e)
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
  }, [provider])

  const addTask = useCallback(
    async (input: { title: string; done_when?: string; priority?: 1 | 2 | 3; project?: string; domain?: string }) => {
      const trimmed = input.title.trim()
      if (!trimmed) return
      await provider.add({ title: trimmed, done_when: input.done_when, priority: input.priority, project: input.project, domain: input.domain })
      await refresh()
    },
    [provider, refresh]
  )

  const updateTask = useCallback(
    async (id: string, patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority' | 'project' | 'domain'>>) => {
      await provider.update(id, patch)
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

  return { tasks, loading, error, refresh, addTask, updateTask, toggleDone, deleteTask }
}
