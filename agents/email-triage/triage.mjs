/**
 * triage.mjs — email-triage agent (S38): Gmail → Mail/attention.md + Mail/drafts/*.md.
 *
 * GH Actions cron agent (agent-email-triage.yml): reads recent unread/starred
 * Gmail messages via the Gmail API (refresh-token OAuth, scope
 * `gmail.readonly`), classifies each with Claude (structured output — same
 * request shape as `services/bot/nlu.ts`), then writes the S36 vault
 * contract (`src/vault/mail.ts`'s `parseAttention`) to `Mail/attention.md`
 * plus a canned-reply draft under `Mail/drafts/*.md` for anything the
 * classifier flags `needsDraft`. Owns `Mail/**` only (path-partition, see
 * docs/agents/vault-tokens.md).
 *
 * Mirrors agents/calendar-sync/sync.mjs's shape: pure mapping/render
 * functions are exported and exercised byte-exact in triage.test.mjs with
 * zero network access; the only impure pieces (OAuth exchange, Gmail fetch,
 * the Claude call, the file writes, and the final commit+push) all take an
 * injectable `fetchImpl`/`classify`/`push` so `run()` itself is testable
 * end-to-end without a live network or git remote.
 *
 * Deviation from the ticket text: the ticket's "temperature 0" is not sent
 * — Claude Sonnet 5 rejects any non-default `temperature`/`top_p`/`top_k`
 * with a 400 (see the model's current API surface). Determinism instead
 * comes from the JSON-schema-constrained structured output alone, same as
 * `services/bot/nlu.ts`.
 *
 * Secrets (GitHub Actions repo secrets — see agents/email-triage/README.md):
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN — Google
 *     OAuth, scope gmail.readonly.
 *   ANTHROPIC_API_KEY — Claude classification call.
 *   AGENT_VAULT_PAT_MAIL — vault push token, Contents R/W on
 *     LiveOS-VaultRepo only (see docs/agents/vault-tokens.md).
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { commitAndPush } from '../lib/push.mjs'

/** Commit author for every push this agent makes (S38 DoD #3). */
export const COMMIT_AUTHOR = 'lifeos-email-triage <lifeos-email-triage@users.noreply.github.com>'

/** Model pinned for the classify call — same pattern as services/bot/nlu.ts. */
export const CLAUDE_MODEL = 'claude-sonnet-5'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

/** Canonical attention labels — matches the S36 contract (src/vault/mail.ts). */
const KNOWN_LABELS = new Set(['client-money', 'bill', 'job', 'agent-failure', 'other'])

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string', enum: [...KNOWN_LABELS] },
    urgent: { type: 'boolean' },
    needsDraft: { type: 'boolean' },
    draftBody: { type: 'string' },
  },
  required: ['label', 'urgent', 'needsDraft'],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `You triage a single Gmail message flagged for attention (unread or starred) for a personal task-tracking system.

Classify "label" as exactly one of:
- "client-money": a client or contractor discussing payment, invoices, quotes, or scope.
- "bill": a bill, subscription charge, or payment-due notice.
- "job": recruiter or job-application correspondence.
- "agent-failure": an automated system/agent reporting a failure (e.g. a sync or cron error email).
- "other": anything that doesn't confidently match the above.

Set "urgent" to true only when the message reads as time-sensitive or high-stakes (e.g. a due date,
an angry client, a production failure) — most messages are not urgent.

Set "needsDraft" to true only when a short canned reply would plausibly resolve the message (e.g.
acknowledging a quote request, confirming receipt). When true, also provide "draftBody": the full
text of a short, ready-to-send reply. When needsDraft is false, omit draftBody.`

/** Strip newlines and trim — header values arrive single-line but never trust that blindly. */
function sanitizeField(value) {
  return (value ?? '').replace(/[\r\n]+/g, ' ').trim()
}

/**
 * Exchange a long-lived Gmail OAuth refresh token for a short-lived access
 * token. Impure (network); `fetchImpl` is injectable for tests. Same token
 * endpoint/grant shape as agents/calendar-sync/sync.mjs's Calendar exchange
 * — duplicated here rather than shared, so each agent's OAuth flow stays
 * self-contained and independently testable (matches the existing fleet
 * convention: no cross-agent imports beyond agents/lib).
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
  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
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
 * Fetch recent unread/starred Gmail messages and their From/Subject headers
 * + snippet. Impure (network); `fetchImpl` is injectable. Two calls per
 * message (list, then metadata get) — a malformed/failed detail fetch for
 * one message is skipped defensively rather than failing the whole run
 * (matches calendar-sync's never-throw-on-a-single-bad-item convention).
 */
export async function fetchAttentionMessages({ accessToken, fetchImpl = fetch, maxResults = 20 } = {}) {
  if (!accessToken) throw new Error('fetchAttentionMessages: accessToken is required')

  const listParams = new URLSearchParams({ q: 'is:unread OR is:starred', maxResults: String(maxResults) })
  const listRes = await fetchImpl(`${GMAIL_API_BASE}/messages?${listParams.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!listRes.ok) {
    const text = await listRes.text().catch(() => '')
    throw new Error(`fetchAttentionMessages: Gmail list returned ${listRes.status}: ${text}`)
  }
  const listJson = await listRes.json()
  const refs = listJson.messages ?? []

  const threads = []
  for (const ref of refs) {
    if (!ref?.id) continue

    const detailParams = new URLSearchParams({ format: 'metadata' })
    detailParams.append('metadataHeaders', 'From')
    detailParams.append('metadataHeaders', 'Subject')
    const detailRes = await fetchImpl(`${GMAIL_API_BASE}/messages/${ref.id}?${detailParams.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!detailRes.ok) continue // one bad message must not fail the whole run

    const detail = await detailRes.json()
    const headers = detail?.payload?.headers ?? []
    const from = headers.find((h) => h?.name === 'From')?.value ?? ''
    const subject = headers.find((h) => h?.name === 'Subject')?.value ?? ''
    const labelIds = detail.labelIds ?? []

    threads.push({
      id: detail.id ?? ref.id,
      from,
      subject,
      snippet: detail.snippet ?? '',
      internalDate: Number(detail.internalDate) || 0,
      isUnread: labelIds.includes('UNREAD'),
      isStarred: labelIds.includes('STARRED'),
    })
  }
  return threads
}

/**
 * Normalize a raw Claude structured-output payload into the classification
 * shape the rest of this module relies on. Never throws on malformed model
 * output — falls back to `{label: 'other', urgent: false, needsDraft: false}`,
 * same never-throw contract as services/bot/nlu.ts's normalize().
 */
function normalizeClassification(raw) {
  const label = KNOWN_LABELS.has(raw?.label) ? raw.label : 'other'
  const urgent = raw?.urgent === true
  const needsDraft =
    raw?.needsDraft === true && typeof raw.draftBody === 'string' && raw.draftBody.trim().length > 0
  const result = { label, urgent, needsDraft }
  if (needsDraft) result.draftBody = raw.draftBody.trim()
  return result
}

/**
 * Classify one Gmail message with Claude (structured output, JSON-schema
 * constrained) — the mockable seam required by S38 DoD #2. Impure
 * (network); `fetchImpl` is injectable so tests never hit the network.
 * Mirrors services/bot/nlu.ts's classifyAndExtract: throws on a genuine API
 * failure (non-2xx), never throws on malformed/unparseable model output.
 */
export async function classifyThread({ apiKey, thread, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('classifyThread: apiKey is required')

  const userContent =
    `From: ${thread?.from || '(unknown)'}\n` +
    `Subject: ${thread?.subject || '(no subject)'}\n` +
    `Snippet: ${thread?.snippet || ''}`

  const res = await fetchImpl(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
      output_config: { format: { type: 'json_schema', schema: CLASSIFY_SCHEMA } },
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`classifyThread: Claude API returned ${res.status}: ${text}`)
  }

  const json = await res.json()
  const textBlock = (json.content ?? []).find((b) => b.type === 'text')
  if (!textBlock?.text) return { label: 'other', urgent: false, needsDraft: false }

  let raw
  try {
    raw = JSON.parse(textBlock.text)
  } catch {
    return { label: 'other', urgent: false, needsDraft: false }
  }
  return normalizeClassification(raw)
}

/** Slug for a draft filename: lowercase, non-alnum collapsed to '-', capped, never empty. */
function slugify(text) {
  const slug = (text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'thread'
}

/** Hours between a Gmail `internalDate` (ms epoch) and `now`. Never negative. */
function computeWaitingHours(internalDateMs, now) {
  if (!internalDateMs || Number.isNaN(internalDateMs)) return 0
  const ms = now.getTime() - internalDateMs
  if (ms <= 0) return 0
  return Math.round(ms / 3_600_000)
}

/**
 * Map one Gmail message summary + its classification into the S36
 * AttentionItem-shaped object this module renders and drafts from. Pure.
 * Re-validates `needsDraft`/`draftBody` independently of classifyThread's
 * own normalization, since `classify` is an injectable seam a caller (or a
 * test) could supply un-normalized output through (S38 DoD #4).
 */
export function buildAttentionItem(thread, classification, now) {
  const title = sanitizeField(thread?.subject) || '(no subject)'
  const from = sanitizeField(thread?.from)
  const waitingHours = computeWaitingHours(thread?.internalDate, now)
  const label = KNOWN_LABELS.has(classification?.label) ? classification.label : 'other'
  const urgent = classification?.urgent === true
  const needsDraft =
    classification?.needsDraft === true &&
    typeof classification.draftBody === 'string' &&
    classification.draftBody.trim().length > 0

  const item = { title, label, from, waitingHours, urgent, handled: false }
  if (needsDraft) {
    const dateStr = now.toISOString().slice(0, 10)
    item.draftPath = `Mail/drafts/${dateStr}-${slugify(title)}.md`
    item.draftBody = classification.draftBody.trim()
  }
  return item
}

/**
 * Render items into the S36 `Mail/attention.md` contract markdown, sorted
 * urgent-first (then longest-waiting first). Pure. Every line round-trips
 * losslessly through src/vault/mail.ts's parseAttention (S38 DoD #1).
 */
export function renderAttentionMarkdown(items) {
  const sorted = [...items].sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1
    return b.waitingHours - a.waitingHours
  })

  const lines = ['# attention — written by email-triage']
  for (const item of sorted) {
    let line = `- [ ] ${item.title} (label:: ${item.label}) (from:: ${item.from}) (waiting:: ${item.waitingHours}h)`
    if (item.draftPath) line += ` (draft:: ${item.draftPath})`
    lines.push(line)
  }
  return lines.join('\n') + '\n'
}

/** Render a draft reply file's body. Pure. */
function renderDraftMarkdown(item) {
  return `# Draft reply — ${item.title}\n\n${item.draftBody}\n`
}

/**
 * Write `<vaultDir>/Mail/attention.md`. Impure (filesystem). Creates the
 * `Mail/` dir if needed.
 */
async function writeAttentionFile(vaultDir, markdown) {
  const dir = join(vaultDir, 'Mail')
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, 'attention.md')
  await writeFile(filePath, markdown, 'utf8')
  return filePath
}

/**
 * Write one draft reply to `<vaultDir>/<item.draftPath>`. Impure
 * (filesystem). Only called for items with a non-empty draftBody (S38 DoD
 * #4) — the caller (`run`) gates on `item.draftPath` being set.
 */
async function writeDraftFile(vaultDir, item) {
  const filePath = join(vaultDir, item.draftPath)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, renderDraftMarkdown(item), 'utf8')
  return filePath
}

/**
 * Full run: refresh token -> fetch attention-worthy Gmail messages ->
 * classify each with Claude -> map -> render -> write -> push. `vaultDir`
 * is a working-copy clone of LiveOS-VaultRepo. `classify` and `push` are
 * both overridable for tests/dry-runs (S38 DoD #2). Commits + pushes ONLY
 * `Mail/attention.md` and any `Mail/drafts/*.md` files this run wrote (S38
 * DoD #3).
 *
 * A single message's classify call failing (network/API error) is logged
 * and that message is skipped, rather than failing the whole run — one bad
 * message must not block the rest of the mailbox's attention items.
 */
export async function run({
  vaultDir,
  fetchImpl = fetch,
  clientId = process.env.GMAIL_CLIENT_ID,
  clientSecret = process.env.GMAIL_CLIENT_SECRET,
  refreshToken = process.env.GMAIL_REFRESH_TOKEN,
  apiKey = process.env.ANTHROPIC_API_KEY,
  classify = classifyThread,
  push = commitAndPush,
  now = new Date(),
  maxResults = 20,
} = {}) {
  if (!vaultDir) throw new Error('run: vaultDir is required')

  const accessToken = await exchangeRefreshToken({ clientId, clientSecret, refreshToken, fetchImpl })
  const threads = await fetchAttentionMessages({ accessToken, fetchImpl, maxResults })

  const items = []
  for (const thread of threads) {
    let classification
    try {
      classification = await classify({ apiKey, thread, fetchImpl })
    } catch (err) {
      console.error(`triage: classify failed for message ${thread.id} (skipped):`, err)
      continue
    }
    items.push(buildAttentionItem(thread, classification, now))
  }

  const markdown = renderAttentionMarkdown(items)
  await writeAttentionFile(vaultDir, markdown)

  const draftFiles = []
  for (const item of items) {
    if (item.draftPath) {
      await writeDraftFile(vaultDir, item)
      draftFiles.push(item.draftPath)
    }
  }

  const files = ['Mail/attention.md', ...draftFiles]
  await push(vaultDir, {
    files,
    message: `email-triage: ${items.length} item${items.length === 1 ? '' : 's'} (${draftFiles.length} draft${draftFiles.length === 1 ? '' : 's'})`,
    author: COMMIT_AUTHOR,
  })

  return { ok: true, items, draftFiles }
}

// Run directly when invoked as a script (`node agents/email-triage/triage.mjs`),
// not when imported (e.g. by triage.test.mjs).
if (import.meta.url === `file://${process.argv[1]}`) {
  const vaultDir = process.env.VAULT_DIR
  if (!vaultDir) {
    console.error('triage.mjs: VAULT_DIR env var is required (path to a LiveOS-VaultRepo clone)')
    process.exit(1)
  }
  run({ vaultDir })
    .then((result) => {
      console.log(`email-triage: wrote ${result.items.length} items, ${result.draftFiles.length} drafts`)
    })
    .catch((err) => {
      console.error('email-triage: run failed:', err)
      process.exit(1)
    })
}
