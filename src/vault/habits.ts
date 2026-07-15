/**
 * habits — pure Habits vault contract + parser (S30).
 *
 * Habits live in the vault as two append-only markdown files (the vault is
 * the bus — docs/slices/README.md):
 *
 *   Habits/habits.md — one line per habit DEFINITION:
 *     - Course study block (domain:: Growth) (min:: 45m)
 *     - Gym session (domain:: Body & Mind)
 *
 *   Habits/log.md — append-only checked HIT lines:
 *     - [x] Course study block (date:: 2026-07-14) (source:: pwa)
 *     - [x] Gym session (date:: 2026-07-13) (source:: telegram)
 *
 * Inline-field style mirrors the task-line precedent (parseTaskLine,
 * src/vault/parseVault.ts) but wraps each field in parens: `(key:: value)`.
 * Unknown fields are ignored; malformed lines are skipped, never thrown —
 * the parser is a pure function with no I/O (ADR-0003: transport never
 * throws, and neither does the parser behind it).
 */

import type { Domain } from '../data/domains'
import { isDomain } from '../data/domains'

// ─── Types ──────────────────────────────────────────────────────────────────

/** A habit definition from Habits/habits.md. */
export interface Habit {
  /** Display name — the durable key that hit lines reference. */
  name: string
  /** Canonical domain this habit heats; undefined when unset or invalid. */
  domain?: Domain
  /** Optional target duration, kept verbatim (e.g. "45m"). */
  min?: string
}

/** A single habit hit from Habits/log.md. */
export interface HabitHit {
  /** Name of the habit this hit belongs to (matches Habit.name). */
  habit: string
  /** ISO date the hit landed on, `YYYY-MM-DD`. */
  date: string
  /** Where the hit came from, e.g. "pwa" | "telegram". */
  source: string
}

// ─── Inline-field parsing ───────────────────────────────────────────────────

/**
 * Match every `(key:: value)` inline field on a line. Keys are ascii word
 * chars; values run to the closing paren (no nested parens in the contract).
 */
const FIELD_RE = /\(([a-zA-Z_]+)::\s*([^)]*)\)/g

/**
 * Split a raw line body into a leading name and its inline fields.
 * The name is everything before the first `(key::` marker; fields are the
 * captured key/value pairs (values trimmed). No fields → whole body is name.
 */
function splitFields(body: string): { name: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {}
  let firstMarker = -1

  let m: RegExpExecArray | null
  FIELD_RE.lastIndex = 0
  while ((m = FIELD_RE.exec(body)) !== null) {
    if (firstMarker === -1) firstMarker = m.index
    const key = m[1]!
    const value = (m[2] ?? '').trim()
    // First occurrence of a key wins; later dupes ignored.
    if (!(key in fields)) fields[key] = value
  }

  const name = (firstMarker === -1 ? body : body.slice(0, firstMarker)).trim()
  return { name, fields }
}

// ─── Parsers ────────────────────────────────────────────────────────────────

/**
 * Parse Habits/habits.md into Habit[] (definitions).
 *
 * Each definition is a bullet line `- <name> (domain:: X) (min:: Y)`.
 * Lines without a name are skipped. An invalid `domain::` value (not one of
 * the 7 canonical domains) leaves `domain` undefined — the habit is still
 * kept (DoD 4). Unknown fields are ignored. Never throws.
 */
export function parseHabits(md: string): Habit[] {
  const habits: Habit[] = []

  for (const raw of md.split('\n')) {
    const trimmed = raw.trim()
    // Definitions are plain bullets, not checkboxes; skip headings/prose/blank.
    const match = trimmed.match(/^-\s+(.*)$/)
    if (!match) continue
    // A checkbox line (`- [ ]` / `- [x]`) is a hit, not a definition — skip.
    if (/^\[[ xX]\]/.test(match[1]!.trim())) continue

    const { name, fields } = splitFields(match[1]!)
    if (!name) continue

    const habit: Habit = { name }
    if (fields.domain && isDomain(fields.domain)) habit.domain = fields.domain
    if (fields.min) habit.min = fields.min
    habits.push(habit)
  }

  return habits
}

/**
 * Parse Habits/log.md into HabitHit[] (append-only hits).
 *
 * Each hit is a checked bullet `- [x] <name> (date:: YYYY-MM-DD) (source:: s)`.
 * A line is kept only when it is a checked checkbox AND carries a non-empty
 * name AND a non-empty `date::`. Everything else (prose, unchecked boxes,
 * wrong bullets, missing date/name) is skipped silently. `source::` defaults
 * to "" when absent. Never throws.
 */
export function parseHabitLog(md: string): HabitHit[] {
  const hits: HabitHit[] = []

  for (const raw of md.split('\n')) {
    const trimmed = raw.trim()
    // Only checked checkbox lines are hits.
    const match = trimmed.match(/^-\s+\[[xX]\]\s+(.*)$/)
    if (!match) continue

    const { name, fields } = splitFields(match[1]!)
    if (!name) continue
    const date = fields.date
    if (!date) continue

    hits.push({ habit: name, date, source: fields.source ?? '' })
  }

  return hits
}

// ─── Serializer ─────────────────────────────────────────────────────────────

/**
 * Serialize a single HabitHit into a Habits/log.md line (no trailing newline).
 * Exact inverse of parseHabitLog over the modeled fields — round-trip identity
 * (DoD 1): parseHabitLog(serializeHabitHit(h))[0] deep-equals h.
 */
export function serializeHabitHit(hit: HabitHit): string {
  return `- [x] ${hit.habit} (date:: ${hit.date}) (source:: ${hit.source})`
}

// ─── Date helpers ───────────────────────────────────────────────────────────

/** Parse a `YYYY-MM-DD` string into a UTC-midnight epoch-day count. */
function toDayNumber(iso: string): number | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(t)) return null
  return Math.floor(t / 86_400_000)
}

/** Set of hit day-numbers for a single habit (invalid dates dropped). */
function hitDaySet(hits: HabitHit[], habit: string): Set<number> {
  const days = new Set<number>()
  for (const h of hits) {
    if (h.habit !== habit) continue
    const d = toDayNumber(h.date)
    if (d !== null) days.add(d)
  }
  return days
}

// ─── Grid + streak ──────────────────────────────────────────────────────────

/**
 * 7 booleans for a habit's last week, aligned so index 6 is `today` and
 * index 0 is 6 days before today. Each slot is true when the habit has a hit
 * on that calendar day. `today` is a `YYYY-MM-DD` string.
 */
export function weekGrid(hits: HabitHit[], habit: string, today: string): boolean[] {
  const t = toDayNumber(today)
  if (t === null) return [false, false, false, false, false, false, false]
  const days = hitDaySet(hits, habit)
  const grid: boolean[] = []
  for (let i = 6; i >= 0; i--) grid.push(days.has(t - i))
  return grid
}

/**
 * Streak for a habit as of `today` (a `YYYY-MM-DD` string):
 *   - `n`      — length of the most recent consecutive run of hit days.
 *   - `broken` — true when that run does not reach today or yesterday (the
 *                one-day grace window), i.e. the streak is no longer alive.
 *
 * Alive cases (broken=false): a hit today (count back from today), or no hit
 * today but a hit yesterday (count back from yesterday). Anything older is
 * broken=true, with `n` reporting the last run's length (0 when never hit).
 */
export function streak(
  hits: HabitHit[],
  habit: string,
  today: string,
): { n: number; broken: boolean } {
  const t = toDayNumber(today)
  if (t === null) return { n: 0, broken: true }
  const days = hitDaySet(hits, habit)

  // Where does the most-recent live run start counting from?
  let anchor: number
  let broken: boolean
  if (days.has(t)) {
    anchor = t
    broken = false
  } else if (days.has(t - 1)) {
    anchor = t - 1
    broken = false
  } else {
    // No hit today or yesterday — find the latest hit day, if any.
    let latest = -Infinity
    for (const d of days) if (d > latest) latest = d
    if (latest === -Infinity) return { n: 0, broken: true }
    anchor = latest
    broken = true
  }

  let n = 0
  let cursor = anchor
  while (days.has(cursor)) {
    n++
    cursor--
  }
  return { n, broken }
}
