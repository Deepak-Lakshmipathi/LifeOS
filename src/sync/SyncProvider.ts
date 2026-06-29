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
   * `priority` is optional; when present must be 1, 2, or 3 (3 = highest).
   * `project` is optional; empty/whitespace is treated as absent.
   */
  add(input: { title: string; done_when?: string; priority?: 1 | 2 | 3; project?: string }): Promise<Task>

  /**
   * The ONE generic field setter (ADR-0004). Applies a partial patch to the
   * task and returns it. Later slices widen the patch's value types rather
   * than adding new mutation methods.
   *
   * Semantics:
   * - a key omitted from the patch leaves that field untouched (partial merge);
   * - empty/whitespace `done_when` UNSETS the field (never stores '');
   * - `priority` present with value `undefined` CLEARS the field (never stores null/undefined);
   * - empty/whitespace `title` throws;
   * - out-of-range `priority` (not 1, 2, or 3) throws;
   * - empty/whitespace `project` UNSETS the field (never stores '');
   * - unknown id throws.
   */
  update(
    id: string,
    patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority' | 'project'>>,
  ): Promise<Task>

  /** Return all tasks, newest first. */
  list(): Promise<Task[]>

  /** Toggle the done state of a task. Returns the updated task. */
  toggleDone(id: string): Promise<Task>

  /** Permanently delete a task by id. */
  delete(id: string): Promise<void>
}
