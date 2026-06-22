/**
 * LocalOnly — the no-op sync implementation for Slice 1 (ADR-0002).
 * Persists tasks in IndexedDB via Dexie.
 * This is the ONLY non-db file that may import from ../db.
 * UI and components must never import this file or the db directly.
 */
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/LifeOSDb'
import type { Task } from '../types'
import type { SyncProvider } from './SyncProvider'

export class LocalOnly implements SyncProvider {
  async add(input: { title: string; done_when?: string }): Promise<Task> {
    const trimmed = input.title.trim()
    if (!trimmed) {
      throw new Error('Task title must not be empty or whitespace.')
    }
    const task: Task = {
      id: uuidv4(),
      title: trimmed,
      done: false,
      created_at: Date.now(),
    }
    // Only persist done_when when it carries a real value (never store '').
    const doneWhen = input.done_when?.trim()
    if (doneWhen) {
      task.done_when = doneWhen
    }
    await db.tasks.add(task)
    return task
  }

  async update(
    id: string,
    patch: Partial<Pick<Task, 'title' | 'done_when'>>,
  ): Promise<Task> {
    const task = await db.tasks.get(id)
    if (!task) throw new Error(`Task ${id} not found`)

    const updated: Task = { ...task }

    if ('title' in patch) {
      const trimmed = patch.title?.trim()
      if (!trimmed) {
        throw new Error('Task title must not be empty or whitespace.')
      }
      updated.title = trimmed
    }

    if ('done_when' in patch) {
      const trimmed = patch.done_when?.trim()
      if (trimmed) {
        updated.done_when = trimmed
      } else {
        // Empty/whitespace unsets the field — never store ''.
        delete updated.done_when
      }
    }

    await db.tasks.put(updated)
    return updated
  }

  async list(): Promise<Task[]> {
    return db.tasks.orderBy('created_at').reverse().toArray()
  }

  async toggleDone(id: string): Promise<Task> {
    const task = await db.tasks.get(id)
    if (!task) throw new Error(`Task ${id} not found`)
    const updated: Task = { ...task, done: !task.done }
    await db.tasks.put(updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    await db.tasks.delete(id)
  }
}
