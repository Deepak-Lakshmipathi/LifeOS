import type { Task } from '../types'

/**
 * SyncProvider — the sync seam (ADR-0002).
 * UI and components depend only on this interface; they never import Dexie.
 * Slice 1 ships a `LocalOnly` implementation backed by IndexedDB.
 * A later slice swaps the body without touching call sites.
 */
export interface SyncProvider {
  /**
   * Add a new task atomically with its initial fields. Returns the persisted task.
   * `done_when` is optional; empty/whitespace is treated as absent.
   */
  add(input: { title: string; done_when?: string }): Promise<Task>

  /**
   * The ONE generic field setter (ADR-0003). Applies a partial patch to the
   * task and returns it. Later slices widen the patch's value types rather
   * than adding new mutation methods.
   *
   * Semantics:
   * - a key omitted from the patch leaves that field untouched (partial merge);
   * - empty/whitespace `done_when` UNSETS the field (never stores '');
   * - empty/whitespace `title` throws;
   * - unknown id throws.
   */
  update(
    id: string,
    patch: Partial<Pick<Task, 'title' | 'done_when'>>,
  ): Promise<Task>

  /** Return all tasks, newest first. */
  list(): Promise<Task[]>

  /** Toggle the done state of a task. Returns the updated task. */
  toggleDone(id: string): Promise<Task>

  /** Permanently delete a task by id. */
  delete(id: string): Promise<void>
}
