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
  async add(title: string): Promise<Task> {
    const trimmed = title.trim()
    if (!trimmed) {
      throw new Error('Task title must not be empty or whitespace.')
    }
    const task: Task = {
      id: uuidv4(),
      title: trimmed,
      done: false,
      created_at: Date.now(),
    }
    await db.tasks.add(task)
    return task
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
