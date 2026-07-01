/**
 * serialize — pure vault markdown serializer (S15a).
 *
 * Converts a Task back to a single vault markdown task line.
 * Exact inverse of parseTaskLine — write path passes through the same seam.
 * Pure function — no I/O, never throws.
 *
 * Output format (bracket-free field syntax):
 *   - [ ] Title text done_when:: criterion priority:: 1|2|3
 *   - [x] Title text done_when:: criterion priority:: 1|2|3
 *
 * Field serialization rules:
 *   - done_when emitted BEFORE priority (canonical order matches ADR-0010)
 *   - A field is emitted ONLY when present on the task (never undefined)
 *   - Single leading space before each `field::` marker
 *   - NO id:: — ids are ephemeral; re-synthesised on every parse
 *   - NO timestamps — created_at / completed_at live only in memory
 *
 * Domain and project are NOT serialized to the task line; they are inferred
 * from the file path at parse time (folder → domain, filename → project).
 */

import type { Task } from '../types'

/**
 * Serialize a single Task into a vault markdown task line.
 *
 * @param task - The task to serialize.
 * @returns A single markdown line with no trailing newline.
 */
export function serializeTaskLine(task: Task): string {
  // Checkbox prefix: done → `- [x] `, not done → `- [ ] `
  const checkbox = task.done ? '- [x] ' : '- [ ] '

  let line = checkbox + task.title

  // Emit done_when BEFORE priority (canonical field order — ADR-0010 §4)
  if (task.done_when !== undefined) {
    line += ' done_when:: ' + task.done_when
  }

  if (task.priority !== undefined) {
    line += ' priority:: ' + task.priority
  }

  return line
}
