/**
 * reply — confirmation-message formatting for bot-created tasks (S16b).
 *
 * Format: `✓ added '<title>' · <domain> · P<priority>` — the priority segment
 * is omitted entirely when priority is unset, mirroring serializeTaskLine's
 * emit-only-when-present rule for that field (src/vault/serialize.ts).
 */

export interface ReplyTask {
  title: string
  /** Undefined means the task landed in Inbox (ADR-0010 §5 path rules). */
  domain?: string
  priority?: 1 | 2 | 3
}

export function buildCreateReply(task: ReplyTask): string {
  const domainLabel = task.domain ?? 'Inbox'
  const prioritySegment = task.priority !== undefined ? ` · P${task.priority}` : ''
  return `✓ added '${task.title}' · ${domainLabel}${prioritySegment}`
}
