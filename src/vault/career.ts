/**
 * career — pure Career vault markdown parsers (S43).
 *
 * The Career tab is backed by two vault files:
 *   Career/pipeline.md  — job-pipeline kanban entries (owner + job-scout agent)
 *   Career/courses.md   — course-progress log
 *
 * No I/O — the transport layer feeds raw file content here. Pure functions,
 * no side effects, never throw on malformed input (skip-malformed, like
 * `parseVault.ts`). Same inline-field style as habits/finance contracts:
 * parenthesised `(key:: value)` markers after a title.
 *
 * Pipeline line shape:
 *   - <company> — <role> (stage:: applied) (age:: 6d) (match:: 82%) (next:: …)
 *   Fields (all optional except an implied stage, which defaults to `found`):
 *     stage::   one of found | applied | interview | closed (kanban columns,
 *               §4.10); any unknown/absent value → `found` (source preserved)
 *     age::     free-form age string (e.g. "6d"), kept verbatim
 *     match::   free-form match string (e.g. "82%"), kept verbatim
 *     hot::     `true` → urgent card (§4.10 `.hot`); anything else → false
 *     next::    next-step text
 *     source::  provenance (e.g. "job-scout"); §8
 *     outcome:: terminal outcome (e.g. "rejected")
 *
 * Courses line shape:
 *   - <name> (progress:: 62) (next:: Module 4 quiz ~45min) (domain:: Growth)
 *     progress:: integer, clamped to 0–100; a course with no numeric progress
 *                is treated as malformed and skipped
 *     next::     next-lesson text (optional, tolerated when absent)
 *     domain::   free-form domain tag (optional)
 */

/** Canonical kanban stages, in fixed left-to-right column order (§4.10). */
export const STAGES = ['found', 'applied', 'interview', 'closed'] as const
export type Stage = typeof STAGES[number]

function isStage(v: string): v is Stage {
  return (STAGES as readonly string[]).includes(v)
}

export interface JobEntry {
  company: string
  role: string
  stage: Stage
  age?: string
  match?: string
  hot: boolean
  next?: string
  source?: string
  outcome?: string
}

export interface Course {
  name: string
  progress: number
  next?: string
  domain?: string
}

/** Grouping keyed by stage; always carries all 4 canonical keys. */
export type StageGroups = Record<Stage, JobEntry[]>

// ── Field extraction ────────────────────────────────────────────────────────
// A field marker is `(key:: value)` where value runs up to the closing paren.
// Values never contain `)` in this contract, so this is unambiguous.
const FIELD_RE = /\((\w+)::\s*([^)]*)\)/g
const LIST_MARKER_RE = /^\s*-\s+/

/**
 * Split a raw list line into its title (fields removed) and a field map.
 * Returns null when the line is not a `- ` list item.
 */
function splitLine(line: string): { title: string; fields: Map<string, string> } | null {
  if (!LIST_MARKER_RE.test(line)) return null
  const body = line.replace(LIST_MARKER_RE, '')

  const fields = new Map<string, string>()
  let m: RegExpExecArray | null
  FIELD_RE.lastIndex = 0
  while ((m = FIELD_RE.exec(body)) !== null) {
    const key = m[1]!.toLowerCase()
    const value = (m[2] ?? '').trim()
    // First occurrence wins; ignore empty values so later logic can default.
    if (!fields.has(key) && value) fields.set(key, value)
  }

  const title = body.replace(FIELD_RE, '').trim()
  return { title, fields }
}

/**
 * Parse `Career/pipeline.md` into JobEntry[].
 *
 * Malformed lines (non-list, or no company) are skipped, never thrown.
 * Unknown/absent `stage::` → `found`, with `source::` preserved (DoD #4).
 */
export function parsePipeline(md: string): JobEntry[] {
  const entries: JobEntry[] = []

  for (const line of md.split('\n')) {
    const split = splitLine(line)
    if (split === null) continue

    // Title = `<company> — <role>`; the em dash separates the two.
    // Split on the FIRST em dash so a role may itself contain one.
    const emDash = split.title.indexOf('—')
    let company: string
    let role: string
    if (emDash === -1) {
      company = split.title.trim()
      role = ''
    } else {
      company = split.title.slice(0, emDash).trim()
      role = split.title.slice(emDash + 1).trim()
    }

    // A pipeline entry with no company is malformed — skip it.
    if (!company) continue

    const { fields } = split
    const rawStage = fields.get('stage')
    const stage: Stage = rawStage && isStage(rawStage) ? rawStage : 'found'

    const entry: JobEntry = {
      company,
      role,
      stage,
      hot: fields.get('hot') === 'true',
    }

    // Copy through the optional passthrough fields when present.
    for (const key of ['age', 'match', 'next', 'source', 'outcome'] as const) {
      const value = fields.get(key)
      if (value) entry[key] = value
    }

    entries.push(entry)
  }

  return entries
}

/**
 * Group entries by stage into the 4 canonical columns, in fixed order.
 * Every stage key is always present, even when its column is empty (DoD #2).
 */
export function groupByStage(entries: JobEntry[]): StageGroups {
  const groups = {
    found: [],
    applied: [],
    interview: [],
    closed: [],
  } as StageGroups

  for (const entry of entries) {
    groups[entry.stage].push(entry)
  }

  return groups
}

/**
 * Parse `Career/courses.md` into Course[].
 *
 * `progress::` is clamped to 0–100 (DoD #3). A course with no numeric
 * progress, or a non-list line, is skipped. Missing `next::` is tolerated.
 */
export function parseCourses(md: string): Course[] {
  const courses: Course[] = []

  for (const line of md.split('\n')) {
    const split = splitLine(line)
    if (split === null) continue

    const name = split.title.trim()
    if (!name) continue

    const rawProgress = split.fields.get('progress')
    if (rawProgress === undefined) continue
    const n = Number(rawProgress)
    if (!Number.isFinite(n)) continue
    const progress = Math.min(100, Math.max(0, Math.round(n)))

    const course: Course = { name, progress }
    const next = split.fields.get('next')
    if (next) course.next = next
    const domain = split.fields.get('domain')
    if (domain) course.domain = domain

    courses.push(course)
  }

  return courses
}
