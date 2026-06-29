/**
 * LocalOnly — the no-op sync implementation for Slice 1 (ADR-0002).
 * Persists tasks in IndexedDB via Dexie.
 * This is the ONLY non-db file that may import from ../db.
 * UI and components must never import this file or the db directly.
 */
import { db } from '../db/LifeOSDb'
import type { Task } from '../types'
import type { SyncProvider } from './SyncProvider'
import { isDomain } from '../data/domains'

/** Allowed priority values; anything outside this set is rejected. */
const isValidPriority = (p: number) => p === 1 || p === 2 || p === 3

export class LocalOnly implements SyncProvider {
  async add(input: { title: string; done_when?: string; priority?: 1 | 2 | 3; project?: string; domain?: string }): Promise<Task> {
    const trimmed = input.title.trim()
    if (!trimmed) {
      throw new Error('Task title must not be empty or whitespace.')
    }
    // Validate priority before writing anything (ADR-0004).
    if (input.priority !== undefined && !isValidPriority(input.priority)) {
      throw new Error('Task priority must be 1, 2, or 3.')
    }
    const task: Task = {
      id: crypto.randomUUID(),
      title: trimmed,
      done: false,
      created_at: Date.now(),
    }
    // Only persist done_when when it carries a real value (never store '').
    const doneWhen = input.done_when?.trim()
    if (doneWhen) {
      task.done_when = doneWhen
    }
    // Only persist priority when explicitly provided (never store undefined).
    if (input.priority !== undefined) {
      task.priority = input.priority
    }
    // Only persist project when it carries a real value (never store '').
    const project = input.project?.trim()
    if (project) {
      task.project = project
    }
    // Only persist domain when it is a valid canonical domain (never store '' or invalid).
    const domain = input.domain?.trim()
    if (domain && isDomain(domain)) {
      task.domain = domain
    }
    await db.tasks.add(task)
    return task
  }

  async update(
    id: string,
    patch: Partial<Pick<Task, 'title' | 'done_when' | 'priority' | 'project' | 'domain'>>,
  ): Promise<Task> {
    const task = await db.tasks.get(id)
    if (!task) throw new Error(`Task ${id} not found`)

    // Validate priority before mutating anything (ADR-0004).
    if ('priority' in patch && patch.priority !== undefined && !isValidPriority(patch.priority)) {
      throw new Error('Task priority must be 1, 2, or 3.')
    }

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

    if ('priority' in patch) {
      if (patch.priority !== undefined) {
        updated.priority = patch.priority
      } else {
        // `priority: undefined` in patch explicitly clears the field.
        delete updated.priority
      }
    }

    if ('project' in patch) {
      const trimmed = patch.project?.trim()
      if (trimmed) {
        updated.project = trimmed
      } else {
        // Empty/whitespace unsets the field — never store ''.
        delete updated.project
      }
    }

    if ('domain' in patch) {
      const trimmed = patch.domain?.trim()
      if (trimmed && isDomain(trimmed)) {
        updated.domain = trimmed
      } else {
        // Empty/whitespace or invalid domain unsets the field — never store '' or an invalid value.
        delete updated.domain
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
    const completing = !task.done
    const updated: Task = { ...task, done: completing }
    if (completing) {
      updated.completed_at = Date.now()
    } else {
      delete updated.completed_at
    }
    await db.tasks.put(updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    await db.tasks.delete(id)
  }
}
