/**
 * Domain-level grouping helpers (Slice S5).
 *
 * Builds on groupByProject — domain-level grouping nests project groups
 * inside each domain bucket, preserving the project-level ordering rules.
 */
import type { Task } from '../types'
import { groupByProject, type ProjectGroup } from './groupByProject'
import { DOMAINS, isDomain } from '../data/domains'

export { type ProjectGroup }

export const NO_DOMAIN_LABEL = 'Inbox'

export interface DomainGroup {
  /** null for domain-less tasks (renders as "Inbox"); canonical domain string otherwise. */
  key: string | null
  /** Display label — NO_DOMAIN_LABEL for the null bucket, or the domain name. */
  label: string
  /** Project sub-groups within this domain (via groupByProject). */
  projects: ProjectGroup[]
}

/**
 * Groups tasks by domain, then by project within each domain.
 *
 * Rules:
 * - Tasks with no domain or an invalid domain fall into key `null` (NO_DOMAIN_LABEL / "Inbox"), sorted first.
 * - Present named domains follow the canonical `DOMAINS` array order (NOT alphabetical).
 * - Only domains that have at least one task appear in the output.
 * - Within each domain, projects come from groupByProject (Inbox-first, then named alphabetically).
 * - Returns [] when tasks is empty.
 */
export function groupByDomain(tasks: Task[]): DomainGroup[] {
  if (tasks.length === 0) return []

  // Bucket tasks by domain key (null for domain-less/invalid).
  const inboxTasks: Task[] = []
  const domainBuckets = new Map<string, Task[]>()

  for (const task of tasks) {
    const d = task.domain?.trim()
    if (d && isDomain(d)) {
      const bucket = domainBuckets.get(d)
      if (bucket) {
        bucket.push(task)
      } else {
        domainBuckets.set(d, [task])
      }
    } else {
      inboxTasks.push(task)
    }
  }

  const result: DomainGroup[] = []

  // Inbox (null) bucket sorts first.
  if (inboxTasks.length > 0) {
    result.push({
      key: null,
      label: NO_DOMAIN_LABEL,
      projects: groupByProject(inboxTasks),
    })
  }

  // Named domains in DOMAINS array order.
  for (const domain of DOMAINS) {
    const bucket = domainBuckets.get(domain)
    if (bucket && bucket.length > 0) {
      result.push({
        key: domain,
        label: domain,
        projects: groupByProject(bucket),
      })
    }
  }

  return result
}

/**
 * Returns the domain of the first existing task whose project matches
 * `project` (case-insensitive, trimmed). Returns `undefined` if no match.
 *
 * Pure helper — nothing is persisted.
 */
export function domainForProject(tasks: Task[], project: string): string | undefined {
  const needle = project.trim().toLowerCase()
  if (!needle) return undefined

  for (const task of tasks) {
    if (task.project?.trim().toLowerCase() === needle && task.domain) {
      return task.domain
    }
  }
  return undefined
}
