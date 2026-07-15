/**
 * mail — vault contract + parser for the "Needs you" attention stack (S36).
 *
 * The PWA never reads Gmail directly. The email-triage agent (S38) writes a
 * flat vault file, `Mail/attention.md`, and this module is the read-side
 * parser for it. No I/O here — the transport layer feeds raw file content
 * in, same convention as `parseVault.ts` (S14).
 *
 * Vault markdown shape:
 *   # attention — written by email-triage
 *   - [ ] <title> (label:: <label>) (from:: <email>) (waiting:: <Nh|Nd>) (draft:: <path>)
 *   - [x] <title> (label:: <label>) (from:: <email>) (waiting:: <Nh|Nd>)
 *
 * Field syntax:
 *   label::   client-money | bill | job | agent-failure | other
 *             (unknown/missing value → `other`, per contract)
 *   from::    free-text sender (email or system name); "" when absent
 *   waiting:: duration since flagged, `<N>h` or `<N>d` suffix, converted to
 *             hours (`26h` → 26, `3d` → 72); absent/unparseable → 0
 *   draft::   optional pointer to a ready draft file (Mail/drafts/*.md)
 *
 * Fields are parenthesised — `(key:: value)` — and always trail the title,
 * in any order relative to each other. `[x]` = handled; kept for history,
 * the UI hides handled rows. Malformed lines (no checkbox, empty title)
 * are skipped, never thrown.
 */

/** Canonical attention labels. Anything else on the line maps to `other`. */
export type AttentionLabel = 'client-money' | 'bill' | 'job' | 'agent-failure' | 'other'

const KNOWN_LABELS: ReadonlySet<AttentionLabel> = new Set([
  'client-money',
  'bill',
  'job',
  'agent-failure',
  'other',
])

export interface AttentionItem {
  title: string
  label: AttentionLabel
  from: string
  waitingHours: number
  draftPath?: string
  handled: boolean
}

/**
 * Parse a `waiting::` value into hours.
 * `26h` → 26, `3d` → 72. Anything that doesn't match `<N>h`/`<N>d` → 0.
 */
function parseWaitingHours(value: string): number {
  const m = value.trim().match(/^(\d+)\s*(h|d)$/i)
  if (!m) return 0
  const n = Number(m[1])
  return m[2]!.toLowerCase() === 'd' ? n * 24 : n
}

/**
 * Parse a single markdown attention line into an AttentionItem.
 *
 * @param line - Raw markdown line (may be trimmed or not).
 * @returns AttentionItem on success, null on non-task or malformed line.
 */
export function parseAttentionLine(line: string): AttentionItem | null {
  const trimmed = line.trim()

  // Must start with a checkbox prefix — unchecked `- [ ]` or checked `- [x]`
  const checkboxMatch = trimmed.match(/^- \[([ xX])\]\s+(.*)$/)
  if (!checkboxMatch) return null

  const handled = checkboxMatch[1]!.toLowerCase() === 'x'
  const rest = checkboxMatch[2] ?? ''

  // Fields are parenthesised: (key:: value), value is anything but `)`.
  const FIELD_RE = /\s*\((label|from|waiting|draft)::\s*([^)]*)\)/g
  const markers: Array<{ index: number; key: string; value: string }> = []

  let m: RegExpExecArray | null
  while ((m = FIELD_RE.exec(rest)) !== null) {
    markers.push({ index: m.index, key: m[1]!, value: m[2]!.trim() })
  }

  // Title = everything before the first field marker (fields always trail).
  const title = (markers.length === 0 ? rest : rest.slice(0, markers[0]!.index)).trim()
  if (!title) return null

  let rawLabel: string | undefined
  let from = ''
  let waitingHours = 0
  let draftPath: string | undefined

  for (const { key, value } of markers) {
    if (!value) continue
    if (key === 'label') rawLabel = value
    else if (key === 'from') from = value
    else if (key === 'waiting') waitingHours = parseWaitingHours(value)
    else if (key === 'draft') draftPath = value
  }

  const label: AttentionLabel = KNOWN_LABELS.has(rawLabel as AttentionLabel)
    ? (rawLabel as AttentionLabel)
    : 'other'

  const item: AttentionItem = { title, label, from, waitingHours, handled }
  if (draftPath) item.draftPath = draftPath
  return item
}

/**
 * Parse the full contents of `Mail/attention.md` into AttentionItem[].
 * Lines that don't match the checkbox pattern (headings, prose, blank
 * lines, malformed checkboxes) are silently skipped — never throws.
 */
export function parseAttention(md: string): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const line of md.split('\n')) {
    const item = parseAttentionLine(line)
    if (item !== null) items.push(item)
  }
  return items
}
