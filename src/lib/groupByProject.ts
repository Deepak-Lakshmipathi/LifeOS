import type { Task } from '../types'

export const INBOX_LABEL = 'Inbox'

export interface ProjectGroup {
  key: string | null
  label: string
  tasks: Task[]
}

/**
 * Groups tasks by their `project` field.
 * - Unparented tasks (no project) get key `null` and label INBOX_LABEL, sorted first.
 * - Named groups are sorted case-insensitive locale-aware.
 * - Within-group order is preserved from the input array (no re-sort).
 */
export function groupByProject(tasks: Task[]): ProjectGroup[] {
  if (tasks.length === 0) return []

  const inbox: ProjectGroup = { key: null, label: INBOX_LABEL, tasks: [] }
  const named = new Map<string, ProjectGroup>()

  for (const task of tasks) {
    if (!task.project) {
      inbox.tasks.push(task)
    } else {
      const existing = named.get(task.project)
      if (existing) {
        existing.tasks.push(task)
      } else {
        named.set(task.project, { key: task.project, label: task.project, tasks: [task] })
      }
    }
  }

  // Sort named groups case-insensitive locale-aware
  const sortedNamed = [...named.values()].sort((a, b) =>
    (a.key as string).localeCompare(b.key as string, undefined, { sensitivity: 'base' }),
  )

  // Inbox first, then named groups (only emit non-empty groups)
  const result: ProjectGroup[] = []
  if (inbox.tasks.length > 0) result.push(inbox)
  result.push(...sortedNamed)

  return result
}
