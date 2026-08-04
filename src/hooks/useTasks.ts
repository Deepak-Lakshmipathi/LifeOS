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

/**
 * Replace (or remove) a single task by id in a list, never rebuilding the
 * whole array from a server response. `next === null` removes the id.
 * Pure/module-level: no closure over hook state, so it's safe to reuse from
 * any commit() call site.
 */
function replaceById(list: Task[], id: string, next: Task | null): Task[] {
  if (next === null) return list.filter((t) => t.id !== id)
  return list.map((t) => (t.id === id ? next : t))
}

/**
 * Mirrors VaultSync.toggleDone's flip EXACTLY (VaultSync.ts:351-357),
 * including the completed_at set/delete — computeWarmth.ts:64-68 reads it,
 * so a naive `{ ...task, done: !task.done }` would render the wrong warmth
 * for one frame.
 */
function flipDone(task: Task): Task {
  const completing = !task.done
  const next: Task = { ...task, done: completing }
  if (completing) {
    next.completed_at = Date.now()
  } else {
    delete next.completed_at
  }
  return next
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

  // Mirrors `tasks` synchronously so two writes in the same tick (e.g. two
  // toggles on different ids fired from the same click handler) both read
  // fresh state instead of racing against React's batched setState.
  const tasksRef = useRef<Task[]>(tasks)

  // Bumped by every LOCAL task mutation (optimistic apply, reconcile,
  // rollback) — never by a server list() commit. refresh() samples this
  // before its await and discards a list() result if it moved (S64 #174,
  // finding 2): list() is not enqueued through VaultSync's FIFO, so a
  // late-resolving list() can otherwise clobber a write that landed while
  // it was in flight.
  const localVersionRef = useRef(0)

  // At most one un-settled provider op per id. Also read by refresh()'s
  // staleness guard: a write in flight before list() even sampled the
  // version counter above wouldn't have moved it, so the version check
  // alone isn't sufficient.
  const inFlightRef = useRef<Set<string>>(new Set())

  // Deferred-inversion latch (DoD #7, amended 2026-08-03, owner-sanctioned).
  // One bit per id — never a queue of operations. A toggleDone(id) call
  // that lands while `id` is already in inFlightRef cannot call the
  // provider again (the in-flight invariant above), so it flips the row
  // locally and records "a follow-up is owed"; the settle handler in
  // toggleDone consumes the bit and issues exactly one follow-up call.
  const owedRef = useRef<Set<string>>(new Set())

  /**
   * The single mutation point for `tasks`. Keeps `tasksRef` in lockstep and
   * bumps `localVersionRef` for local mutations (never for a server list()
   * commit — pass `local: false` there). Never called during render.
   */
  const commit = (updater: (prev: Task[]) => Task[], local: boolean) => {
    const next = updater(tasksRef.current)
    tasksRef.current = next
    if (local) localVersionRef.current += 1
    setTasks(next)
  }

  const refresh = useCallback(async () => {
    const versionBefore = localVersionRef.current
    const all = await provider.list()
    if (!mountedRef.current) return
    // Staleness guard: discard a list() that a local write outran. Both
    // conditions are required — see localVersionRef/inFlightRef comments
    // above. No catch here — that is S68 (#178)'s channel, not this slice's.
    if (localVersionRef.current !== versionBefore || inFlightRef.current.size > 0) return
    commit(() => all, false)
  }, [provider])

  useEffect(() => {
    // Routed through refresh() (not a second provider.list() call) so the
    // mount load gets the same staleness guard as a manual refresh — a slow
    // mount list() racing an optimistic write is the same hazard either way
    // (S64 #174 finding 2; test (d) exercises exactly this race).
    refresh()
      .then(() => {
        if (!mountedRef.current) return
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
  }, [refresh])

  const addTask = useCallback(
    async (input: { title: string; done_when?: string; priority?: 1 | 2 | 3; project?: string; domain?: string }) => {
      const trimmed = input.title.trim()
      if (!trimmed) return
      // No optimistic pre-apply here (S64 #174 finding 3): add() mints the
      // id server-side (VaultSync.ts:207), so there is no real id to show
      // optimistically. Apply the provider's return value directly — no
      // re-read (drops the old `await refresh()`).
      const created = await provider.add({
        title: trimmed,
        done_when: input.done_when,
        priority: input.priority,
        project: input.project,
        domain: input.domain,
      })
      if (!mountedRef.current) return
      commit((prev) => [...prev, created].sort((a, b) => b.created_at - a.created_at), true)
    },
    [provider]
  )

  const updateTask = useCallback(
    async (id: string, patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority' | 'project' | 'domain'>>) => {
      // No optimistic pre-apply here either: SyncProvider.update's unset/
      // clear rules (empty done_when/project/domain unset the field,
      // priority: undefined clears it) aren't safely reproducible with a
      // naive `{ ...before, ...patch }` spread without duplicating provider
      // semantics across the seam. Apply the returned Task once it lands.
      const updated = await provider.update(id, patch)
      if (!mountedRef.current) return
      commit((prev) => replaceById(prev, id, updated), true)
    },
    [provider]
  )

  /**
   * Toggle a task's done state.
   *
   * Contract (S64 #174 — S72 #182 depends on this): the flip is applied
   * synchronously, before this function's first `await`. A caller may read
   * the new `done` value on `tasks` immediately after invoking this
   * function without awaiting it — no need to wait for the write to land.
   *
   * A second call for an id that is already in flight does not call the
   * provider again (at most one un-settled provider op per id); it applies
   * its own flip synchronously and returns (never throws — MissionCard.tsx
   * awaits onToggle uncaught), recording that exactly one follow-up call is
   * owed once the in-flight op settles (DoD #7 — the deferred-inversion
   * latch, `owedRef`).
   *
   * Rejects if the write ultimately fails, after rolling the affected id
   * back to its pre-click value. Rollback is always scoped to the single
   * id — never a whole-list restore.
   */
  const toggleDone = useCallback(
    async (id: string): Promise<void> => {
      if (inFlightRef.current.has(id)) {
        owedRef.current.add(id)
        const current = tasksRef.current.find((t) => t.id === id)
        if (current) {
          commit((prev) => replaceById(prev, id, flipDone(current)), true)
        }
        return
      }

      const before = tasksRef.current.find((t) => t.id === id)
      if (!before) return

      inFlightRef.current.add(id)
      // Optimistic flip — synchronous, before the first await. Mirrors
      // VaultSync.toggleDone exactly (see flipDone above).
      commit((prev) => replaceById(prev, id, flipDone(before)), true)

      let rollbackTo = before
      let isFirstAttempt = true

      try {
        for (;;) {
          let result: Task
          try {
            result = await provider.toggleDone(id)
          } catch (err) {
            // Failed settle: clear the latch (no follow-up), roll the id
            // back to what it showed before THIS attempt, and propagate
            // only for the first caller — a follow-up's own failure has no
            // user-visible surface (S68's channel), just a breadcrumb.
            owedRef.current.delete(id)
            if (mountedRef.current) {
              commit((prev) => replaceById(prev, id, rollbackTo), true)
            }
            console.error(
              isFirstAttempt ? '[LifeOS] toggleDone failed:' : '[LifeOS] toggleDone follow-up failed:',
              err
            )
            if (isFirstAttempt) throw err
            return
          }

          // Haptic feedback on mobile — stays post-await, matches master.
          if (isFirstAttempt && typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(10)
          }
          if (!mountedRef.current) return

          if (owedRef.current.delete(id)) {
            // A deferred flip landed while this op was in flight — the row
            // already shows the inverted state, so reconciling `result`
            // here would visibly bounce it back. Skip the reconcile,
            // capture what we'd roll back to if the follow-up fails, and
            // issue exactly one follow-up with no further optimistic apply.
            isFirstAttempt = false
            rollbackTo = tasksRef.current.find((t) => t.id === id) ?? rollbackTo
            continue
          }

          commit((prev) => replaceById(prev, id, result), true)
          return
        }
      } finally {
        inFlightRef.current.delete(id)
      }
    },
    [provider]
  )

  const deleteTask = useCallback(
    async (id: string): Promise<void> => {
      const before = tasksRef.current.find((t) => t.id === id)
      if (!before) return

      inFlightRef.current.add(id)
      // Optimistic removal — synchronous, before the first await.
      commit((prev) => replaceById(prev, id, null), true)

      try {
        await provider.delete(id)
      } catch (err) {
        if (mountedRef.current) {
          // Re-insert and re-sort newest-first to match VaultSync.list()
          // ordering (VaultSync.ts:189) — never by index, the list may have
          // changed shape since the optimistic removal.
          commit((prev) => [...prev, before].sort((a, b) => b.created_at - a.created_at), true)
        }
        console.error('[LifeOS] deleteTask failed:', err)
        throw err
      } finally {
        inFlightRef.current.delete(id)
      }
    },
    [provider]
  )

  return { tasks, loading, error, refresh, addTask, updateTask, toggleDone, deleteTask }
}
