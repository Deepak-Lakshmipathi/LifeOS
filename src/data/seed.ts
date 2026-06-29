/**
 * Seed importer (Slice S5, ADR-0006).
 *
 * Imports seed_tasks_detailed.json into an empty local store once, on mount.
 * Idempotent: no-ops if any task already exists.
 * Test hook: returns 0 immediately when `?noseed` is present in the URL.
 */
import seedData from '../../seed_tasks_detailed.json'
import type { SyncProvider } from '../sync/SyncProvider'

/**
 * Seeds the store from seed_tasks_detailed.json when the DB is empty.
 *
 * Returns the number of tasks added (107 on a clean DB, 0 otherwise).
 *
 * Skip conditions:
 *  - `?noseed` is present in location.search (test hook, ADR-0006).
 *  - provider.list() returns at least one task (idempotent no-op).
 */
export async function seedIfEmpty(provider: SyncProvider): Promise<number> {
  // Test hook: ?noseed skips the entire import.
  if (new URLSearchParams(location.search).has('noseed')) {
    return 0
  }

  // Idempotency check: do nothing if the store already has tasks.
  const existing = await provider.list()
  if (existing.length > 0) {
    return 0
  }

  let count = 0
  for (const project of seedData.projects) {
    for (const task of project.tasks) {
      // Normalize priority: seed JSON uses 0 for "no priority"; map to undefined.
      const rawPriority = task.priority as number | undefined
      const priority: 1 | 2 | 3 | undefined =
        rawPriority === 1 || rawPriority === 2 || rawPriority === 3
          ? rawPriority
          : undefined
      await provider.add({
        title: task.title,
        done_when: task.done_when ?? undefined,
        priority,
        project: project.name,
        domain: project.folder,
      })
      count++
    }
  }
  return count
}
