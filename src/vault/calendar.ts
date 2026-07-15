/**
 * calendar — pure Obsidian vault calendar markdown parser (S33).
 *
 * Calendar data lands in the vault as markdown written by the calendar-sync
 * agent (S35); the PWA only ever reads the file. This module: contract +
 * parser + gap derivation. No I/O — the transport layer feeds raw file
 * content here. Pure functions — no side effects, never throw on malformed
 * input.
 *
 * Vault markdown shape (`Calendar/today.md`):
 *   # 2026-07-14
 *   - 08:00-09:00 Gym — legs (type:: gym)
 *   - 10:00-11:00 Client call — NorthStar handoff (type:: call)
 *   - 14:00-16:00 Deep work — Module 4 (type:: deep)
 *
 * Types: call | deep | gym | other (unknown/missing → other).
 * Day header = ISO date (`# YYYY-MM-DD`), exposed on the parsed result so
 * the UI can detect staleness (file may carry yesterday's date).
 * Malformed lines are skipped, never thrown.
 */

export type CalEventType = 'call' | 'deep' | 'gym' | 'other'

export interface CalEvent {
  /** "HH:MM" 24h, zero-padded. */
  start: string
  /** "HH:MM" 24h, zero-padded. */
  end: string
  title: string
  type: CalEventType
}

export interface Gap {
  /** "HH:MM" 24h, zero-padded. */
  start: string
  /** "HH:MM" 24h, zero-padded. */
  end: string
  minutes: number
}

export interface ParsedCalendar {
  /** ISO date from the `# YYYY-MM-DD` header; undefined when absent/malformed. */
  date: string | undefined
  events: CalEvent[]
}

const KNOWN_TYPES: ReadonlySet<string> = new Set(['call', 'deep', 'gym'])

const DATE_HEADER_RE = /^#\s+(\d{4}-\d{2}-\d{2})\s*$/
const EVENT_LINE_RE = /^-\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s+(.+)$/
const TYPE_FIELD_RE = /\s*\(type::\s*([^)]*)\)\s*$/i

/** Parses "HH:MM" into minutes-since-midnight; null when out of range/malformed. */
function toMinutesStrict(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  // Regex guarantees digit strings, so both are non-negative integers here.
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Formats minutes-since-midnight back into zero-padded "HH:MM". */
function fromMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Parse a single calendar event line into a CalEvent.
 * Returns null on malformed/non-event lines (never throws).
 */
export function parseEventLine(line: string): CalEvent | null {
  const trimmed = line.trim()
  const m = trimmed.match(EVENT_LINE_RE)
  if (!m) return null

  const rawStart = m[1]!
  const rawEnd = m[2]!
  const rest = m[3]!

  const startMin = toMinutesStrict(rawStart)
  const endMin = toMinutesStrict(rawEnd)
  if (startMin === null || endMin === null) return null
  if (startMin >= endMin) return null // zero/negative-length range → malformed

  let title = rest.trim()
  let type: CalEventType = 'other'

  const typeMatch = rest.match(TYPE_FIELD_RE)
  if (typeMatch) {
    title = rest.slice(0, typeMatch.index).trim()
    const rawType = (typeMatch[1] ?? '').trim().toLowerCase()
    type = KNOWN_TYPES.has(rawType) ? (rawType as CalEventType) : 'other'
  }

  if (!title) return null

  return {
    start: fromMinutes(startMin),
    end: fromMinutes(endMin),
    title,
    type,
  }
}

/**
 * Parse a full `Calendar/today.md`-shaped file into { date, events }.
 * Non-matching lines (headings other than the date header, blanks, prose,
 * malformed event lines) are silently skipped — never thrown.
 */
export function parseCalendar(md: string): ParsedCalendar {
  let date: string | undefined
  const events: CalEvent[] = []

  for (const line of md.split('\n')) {
    const trimmed = line.trim()

    if (date === undefined) {
      const dateMatch = trimmed.match(DATE_HEADER_RE)
      if (dateMatch) {
        date = dateMatch[1]
        continue
      }
    }

    const event = parseEventLine(line)
    if (event !== null) events.push(event)
  }

  return { date, events }
}

/**
 * Derive free-time gaps for a day from a list of events.
 *
 * Events are NOT assumed sorted/non-overlapping on input — they are sorted
 * by start time and overlapping intervals are merged defensively before gap
 * derivation. Events (after clamping) fully outside [dayStart, dayEnd) are
 * dropped. An event-free day (or a day whose events fall entirely outside
 * bounds) returns a single gap spanning the whole day.
 */
export function freeGaps(
  events: CalEvent[],
  dayStart = '08:00',
  dayEnd = '22:00',
): Gap[] {
  const dayStartMin = toMinutesStrict(dayStart)
  const dayEndMin = toMinutesStrict(dayEnd)
  if (dayStartMin === null || dayEndMin === null || dayStartMin >= dayEndMin) {
    return []
  }

  // Convert + clamp to day bounds; drop invalid or fully-outside intervals.
  const intervals: Array<{ start: number; end: number }> = []
  for (const e of events) {
    const s = toMinutesStrict(e.start)
    const en = toMinutesStrict(e.end)
    if (s === null || en === null || s >= en) continue

    const clampedStart = Math.max(s, dayStartMin)
    const clampedEnd = Math.min(en, dayEndMin)
    if (clampedStart >= clampedEnd) continue

    intervals.push({ start: clampedStart, end: clampedEnd })
  }

  intervals.sort((a, b) => a.start - b.start)

  // Merge overlapping intervals defensively (touching, non-overlapping
  // intervals are left distinct — they produce a zero-length gap, which
  // the walk below naturally omits).
  const merged: Array<{ start: number; end: number }> = []
  for (const iv of intervals) {
    const last = merged[merged.length - 1]
    if (last && iv.start < last.end) {
      last.end = Math.max(last.end, iv.end)
    } else {
      merged.push({ start: iv.start, end: iv.end })
    }
  }

  const gaps: Gap[] = []
  let cursor = dayStartMin
  for (const iv of merged) {
    if (iv.start > cursor) {
      gaps.push({ start: fromMinutes(cursor), end: fromMinutes(iv.start), minutes: iv.start - cursor })
    }
    cursor = Math.max(cursor, iv.end)
  }
  if (cursor < dayEndMin) {
    gaps.push({ start: fromMinutes(cursor), end: fromMinutes(dayEndMin), minutes: dayEndMin - cursor })
  }

  return gaps
}
