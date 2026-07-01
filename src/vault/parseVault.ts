/**
 * parseVault — pure Obsidian vault markdown parser (S14).
 *
 * Converts vault markdown files (domain/project.md) to Task[].
 * No I/O — the transport layer feeds raw file content here.
 * Pure function — no side effects, never throws on malformed input.
 *
 * Vault markdown shape:
 *   <domain>/<project>.md
 *     - [ ] Title text [done_when:: criterion] [priority:: 1|2|3]
 *     - [x] Title text [priority:: 1] [done_when:: already done]
 *
 * Field syntax:
 *   done_when:: <text>   — inline acceptance criterion; stripped from title
 *   priority:: <1|2|3>  — importance; invalid values silently skipped
 *   Fields may appear in ANY order after the title.
 */

import type { Task } from '../types'
import { isDomain } from '../data/domains'

/**
 * Parse a single markdown task line into a Task.
 *
 * @param line - Raw markdown line (may be trimmed or not).
 * @param ctx  - Ambient domain + project derived from file path.
 * @returns Task on success, null on non-task or malformed line.
 */
export function parseTaskLine(
  line: string,
  ctx: { domain?: string; project?: string },
): Task | null {
  const trimmed = line.trim()

  // Must start with a checkbox prefix — unchecked `- [ ]` or checked `- [x]`
  const checkboxMatch = trimmed.match(/^- \[([ xX])\]\s+(.*)$/)
  if (!checkboxMatch) return null

  const done = checkboxMatch[1]!.toLowerCase() === 'x'
  const rest = checkboxMatch[2] ?? ''

  // ── Locate inline field markers ──────────────────────────────────────────
  // Pattern: optional-whitespace <fieldname>:: whitespace
  // Fields may appear in any order; we find all occurrences first.
  const FIELD_RE = /\s+(done_when|priority)::\s+/g
  const markers: Array<{ index: number; key: string; valueStart: number }> = []

  let m: RegExpExecArray | null
  while ((m = FIELD_RE.exec(rest)) !== null) {
    markers.push({
      index: m.index,
      key: m[1]!,
      valueStart: m.index + m[0].length,
    })
  }

  // ── Extract title and field values ───────────────────────────────────────
  let title: string
  let done_when: string | undefined
  let priority: 1 | 2 | 3 | undefined

  if (markers.length === 0) {
    // No fields — rest is the title verbatim
    title = rest.trim()
  } else {
    // Title = everything before the leading whitespace of the first marker
    title = rest.slice(0, markers[0]!.index).trim()

    for (let i = 0; i < markers.length; i++) {
      const { key, valueStart } = markers[i]!
      // Value runs from valueStart up to the next marker's index (or end of rest)
      const valueEnd = i + 1 < markers.length ? markers[i + 1]!.index : rest.length
      const value = rest.slice(valueStart, valueEnd).trim()

      if (key === 'done_when') {
        if (value) done_when = value
      } else if (key === 'priority') {
        const p = Number(value)
        // Only 1, 2, 3 are valid — anything else is silently ignored
        if (p === 1 || p === 2 || p === 3) priority = p
      }
    }
  }

  // Skip lines that parse as task syntax but have no actual title
  if (!title) return null

  // ── Build Task ────────────────────────────────────────────────────────────
  const now = Date.now()
  const task: Task = {
    id: crypto.randomUUID(),
    title,
    done,
    created_at: now,
  }

  // Vault has no real completion timestamps; use created_at so warmth/pulse
  // have a value to work with (read-only vault, no write-back until S15).
  if (done) {
    task.completed_at = now
  }

  if (done_when !== undefined) task.done_when = done_when
  if (priority !== undefined) task.priority = priority

  // Domain comes from the folder name (validated by caller via isDomain)
  if (ctx.domain) task.domain = ctx.domain

  // Project comes from the note filename (without .md)
  if (ctx.project) task.project = ctx.project

  return task
}

/**
 * Parse an array of vault files into Task[].
 *
 * Expected path format: `<domain>/<project>.md` (relative, forward slashes).
 * Paths with back-slashes are normalised before splitting.
 * Folder → domain (validated via isDomain; omitted when not one of the 7 domains).
 * Filename (without .md) → project.
 *
 * Lines that don't match the task checkbox pattern are silently skipped.
 * The returned array preserves parse order; callers sort as needed.
 */
export function parseVault(files: { path: string; content: string }[]): Task[] {
  const tasks: Task[] = []

  for (const { path, content } of files) {
    // Normalise path separators (Windows-safe)
    const parts = path.replace(/\\/g, '/').split('/')
    if (parts.length < 2) continue // need at least <folder>/<file>

    const folderName = parts[0]!
    const fileName = parts[parts.length - 1]!

    // Only include domain when folder name is one of the 7 canonical domains
    const domain = isDomain(folderName) ? folderName : undefined

    // Project = filename without .md extension
    const project = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName

    const ctx = {
      domain,
      project: project || undefined,
    }

    for (const line of content.split('\n')) {
      const task = parseTaskLine(line, ctx)
      if (task !== null) tasks.push(task)
    }
  }

  return tasks
}
