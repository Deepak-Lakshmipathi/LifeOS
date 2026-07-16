/**
 * sync.mjs — calendar-sync agent (S35): Google Calendar → Calendar/today.md.
 *
 * First producer agent for the vault's Calendar/** path-partition (own
 * secret, own directory — see docs/agents/vault-tokens.md). Runs on GitHub
 * Actions (agent-calendar-sync.yml): cron every 30 min, 05:00-23:00 IST,
 * plus workflow_dispatch.
 *
 * Pure mapping (GCal API v3 event list -> the S33 vault contract markdown)
 * lives in this file as exported, side-effect-free functions — this is what
 * sync.test.mjs exercises byte-exact against a fixture with zero network
 * access (S35 DoD #1/#4). The only impure pieces are the OAuth
 * refresh-token exchange, the Calendar API fetch, the file write, and the
 * final commit+push; all take an injectable `fetchImpl`/`push` so `run()`
 * itself is testable end-to-end without touching a live network or git
 * remote, even though the committed test suite only exercises the pure
 * mapper per the S35 Tests section ("mocked-API mapper roundtrip; no e2e").
 *
 * Secrets (GitHub Actions repo secrets — see agents/calendar-sync/README.md):
 *   GCAL_CLIENT_ID, GCAL_CLIENT_SECRET, GCAL_REFRESH_TOKEN  — Google OAuth,
 *     scope calendar.readonly.
 *   AGENT_VAULT_PAT_CALENDAR — vault push token, Contents R/W on
 *     LiveOS-VaultRepo only (see docs/agents/vault-tokens.md).
 *
 * NOTE: this agent does not (yet) write agents/calendar-sync/runs.jsonl or
 * status.json via agents/lib/runLog.mjs (S47) — wiring it would add a
 * second write-set to the vault commit, which would violate this slice's
 * DoD #2 ("writes ONLY Calendar/today.md"). Left as a TODO; see
 * .github/workflows/agent-calendar-sync.yml.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { commitAndPush } from '../lib/push.mjs'

/** Vault repo this agent owns Calendar/** in (path-partition, S35 Context). */
export const VAULT_REPO = 'Deepak-Lakshmipathi/LiveOS-VaultRepo'
export const VAULT_BRANCH = 'main'

/** Commit author for every push this agent makes (S35 DoD #2). */
export const COMMIT_AUTHOR = 'lifeos-calendar-sync <lifeos-calendar-sync@users.noreply.github.com>'

/** IANA zone the agent renders event clock times in (cron window is IST). */
export const DEFAULT_TIME_ZONE = 'Asia/Kolkata'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

/**
 * Keyword -> S33 CalEventType, checked case-insensitively as a whole-word
 * match against the event summary. First match wins; no match -> 'other'
 * (the S33 parser's own default for an unknown/missing type).
 */
const TYPE_KEYWORDS = [
  [/\b(call|sync|standup|meeting|1:1|1-on-1)\b/i, 'call'],
  [/\b(gym|workout|run|yoga)\b/i, 'gym'],
  [/\b(deep work|focus|deep-work)\b/i, 'deep'],
]

/** Classify a GCal event summary into the S33 CalEventType (pure). */
export function classifyType(summary) {
  const text = summary ?? ''
  for (const [re, type] of TYPE_KEYWORDS) {
    if (re.test(text)) return type
  }
  return 'other'
}

/**
 * Format an ISO datetime string into zero-padded 24h "HH:MM" in the given
 * IANA time zone (pure — no reliance on the process's local zone).
 */
export function formatTimeInZone(isoString, timeZone = DEFAULT_TIME_ZONE) {
  const date = new Date(isoString)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
}

/**
 * Today's ISO date (YYYY-MM-DD) in the given zone (pure given `now`).
 */
export function todayInZone(timeZone = DEFAULT_TIME_ZONE, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const d = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${y}-${m}-${d}`
}

/**
 * Map raw Google Calendar API v3 `items[]` into S33 CalEvent-shaped objects
 * ({start, end, title, type}, HH:MM 24h). Pure.
 *
 * All-day events (no `start.dateTime`/`end.dateTime`, only a `date`) are
 * skipped — the S33 contract has no representation for them. Events missing
 * a usable summary/start/end, or with a zero/negative-length range, are
 * skipped defensively, never thrown (matches src/vault/calendar.ts's own
 * never-throw contract). Output is sorted by start time so the written file
 * reads chronologically even if the API returns events out of order.
 */
export function mapGcalItemsToEvents(items, timeZone = DEFAULT_TIME_ZONE) {
  const events = []
  for (const item of items ?? []) {
    const startIso = item?.start?.dateTime
    const endIso = item?.end?.dateTime
    if (!startIso || !endIso) continue // all-day or malformed — skip

    const title = (item.summary ?? '').trim()
    if (!title) continue

    const start = formatTimeInZone(startIso, timeZone)
    const end = formatTimeInZone(endIso, timeZone)
    if (start >= end) continue // zero/negative-length range — skip

    events.push({ start, end, title, type: classifyType(title) })
  }
  events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
  return events
}

/**
 * Render events into the exact S33 `Calendar/today.md` contract markdown.
 * Pure. `dateStr` is the ISO date (`YYYY-MM-DD`) for the `# ` header.
 */
export function eventsToMarkdown(dateStr, events) {
  const lines = [`# ${dateStr}`]
  for (const e of events) {
    lines.push(`- ${e.start}-${e.end} ${e.title} (type:: ${e.type})`)
  }
  return lines.join('\n') + '\n'
}

/**
 * Exchange a long-lived OAuth refresh token for a short-lived access token.
 * Impure (network); `fetchImpl` is injectable for tests.
 */
export async function exchangeRefreshToken({
  clientId,
  clientSecret,
  refreshToken,
  fetchImpl = fetch,
} = {}) {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('exchangeRefreshToken: clientId, clientSecret, and refreshToken are all required')
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`exchangeRefreshToken: token endpoint returned ${res.status}: ${text}`)
  }
  const json = await res.json()
  if (!json.access_token) {
    throw new Error('exchangeRefreshToken: response missing access_token')
  }
  return json.access_token
}

/**
 * Fetch today's events (single-day window, expanded recurring instances)
 * from the primary calendar. Impure (network); `fetchImpl` is injectable.
 * Returns the raw `items[]` array (mapped to CalEvents by
 * `mapGcalItemsToEvents`).
 */
export async function fetchTodayItems({
  accessToken,
  timeZone = DEFAULT_TIME_ZONE,
  dateStr,
  fetchImpl = fetch,
} = {}) {
  if (!accessToken) throw new Error('fetchTodayItems: accessToken is required')
  if (!dateStr) throw new Error('fetchTodayItems: dateStr is required')

  const params = new URLSearchParams({
    timeMin: `${dateStr}T00:00:00`,
    timeMax: `${dateStr}T23:59:59`,
    timeZone,
    singleEvents: 'true',
    orderBy: 'startTime',
  })
  const url = `${CALENDAR_API_BASE}/calendars/primary/events?${params.toString()}`
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`fetchTodayItems: Calendar API returned ${res.status}: ${text}`)
  }
  const json = await res.json()
  return json.items ?? []
}

/**
 * Write the rendered markdown to `<vaultDir>/Calendar/today.md`. Impure
 * (filesystem). Creates the `Calendar/` dir if it doesn't exist yet.
 */
export async function writeCalendarFile(vaultDir, markdown) {
  const dir = join(vaultDir, 'Calendar')
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, 'today.md')
  await writeFile(filePath, markdown, 'utf8')
  return filePath
}

/**
 * Full run: refresh token -> fetch today's events -> map -> write -> push.
 * `vaultDir` is a working-copy clone of LiveOS-VaultRepo. `push` defaults to
 * the shared `commitAndPush` wrapper (S57); overridable for tests/dry-runs.
 * Commits + pushes ONLY `Calendar/today.md` (S35 DoD #2).
 */
export async function run({
  vaultDir,
  fetchImpl = fetch,
  clientId = process.env.GCAL_CLIENT_ID,
  clientSecret = process.env.GCAL_CLIENT_SECRET,
  refreshToken = process.env.GCAL_REFRESH_TOKEN,
  timeZone = DEFAULT_TIME_ZONE,
  push = commitAndPush,
  now = new Date(),
} = {}) {
  if (!vaultDir) throw new Error('run: vaultDir is required')

  const accessToken = await exchangeRefreshToken({ clientId, clientSecret, refreshToken, fetchImpl })
  const dateStr = todayInZone(timeZone, now)
  const items = await fetchTodayItems({ accessToken, timeZone, dateStr, fetchImpl })
  const events = mapGcalItemsToEvents(items, timeZone)
  const markdown = eventsToMarkdown(dateStr, events)

  await writeCalendarFile(vaultDir, markdown)
  await push(vaultDir, {
    files: ['Calendar/today.md'],
    message: `calendar-sync: ${dateStr} (${events.length} event${events.length === 1 ? '' : 's'})`,
    author: COMMIT_AUTHOR,
  })

  return { ok: true, dateStr, events }
}

// Run directly when invoked as a script (`node agents/calendar-sync/sync.mjs`),
// not when imported (e.g. by sync.test.mjs).
if (import.meta.url === `file://${process.argv[1]}`) {
  const vaultDir = process.env.VAULT_DIR
  if (!vaultDir) {
    console.error('sync.mjs: VAULT_DIR env var is required (path to a LiveOS-VaultRepo clone)')
    process.exit(1)
  }
  run({ vaultDir })
    .then((result) => {
      console.log(`calendar-sync: wrote ${result.events.length} events for ${result.dateStr}`)
    })
    .catch((err) => {
      console.error('calendar-sync: run failed:', err)
      process.exit(1)
    })
}
