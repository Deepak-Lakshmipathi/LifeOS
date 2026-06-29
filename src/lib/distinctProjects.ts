import type { Task } from '../types'

/**
 * Derives a sorted, deduplicated list of project names from the task list.
 * - Trims each project value.
 * - Drops empty/whitespace values.
 * - Deduplicates case-insensitively (first-seen casing wins).
 * - Sorts the result.
 */
export function distinctProjects(tasks: Task[]): string[] {
  const seen = new Map<string, string>() // lowercase key → original value

  for (const task of tasks) {
    if (!task.project) continue
    const trimmed = task.project.trim()
    if (!trimmed) continue
    const lower = trimmed.toLowerCase()
    if (!seen.has(lower)) {
      seen.set(lower, trimmed)
    }
  }

  return [...seen.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
}
