/**
 * LifeOSDb — Dexie schema definition.
 * This file is the ONLY place in the codebase that imports Dexie.
 * All other code goes through SyncProvider (the sync seam).
 */
import Dexie, { type EntityTable } from 'dexie'
import type { Task } from '../types'

class LifeOSDatabase extends Dexie {
  tasks!: EntityTable<Task, 'id'>

  constructor() {
    super('LifeOS')
    this.version(1).stores({
      tasks: 'id, created_at, done',
    })
    // v2: adds `priority` index. No upgrade()/backfill — legacy rows have no
    // `priority` key and simply fall out of the priority index. They continue
    // to load correctly via get() and orderBy('created_at').
    this.version(2).stores({
      tasks: 'id, created_at, done, priority',
    })
  }
}

export const db = new LifeOSDatabase()
export type { LifeOSDatabase }
