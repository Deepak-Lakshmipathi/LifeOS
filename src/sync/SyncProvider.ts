import type { Task } from '../types'

/**
 * SyncProvider — the sync seam (ADR-0002).
 * UI and components depend only on this interface; they never import Dexie.
 * Slice 1 ships a `LocalOnly` implementation backed by IndexedDB.
 * A later slice swaps the body without touching call sites.
 */
export interface SyncProvider {
  /** Add a new task. Returns the persisted task. */
  add(title: string): Promise<Task>

  /** Return all tasks, newest first. */
  list(): Promise<Task[]>

  /** Toggle the done state of a task. Returns the updated task. */
  toggleDone(id: string): Promise<Task>

  /** Permanently delete a task by id. */
  delete(id: string): Promise<void>
}
