/**
 * brief.mjs — daily-brief agent (S50): whole-vault read → Claude compose →
 * `Briefs/<date>.md` (the FINAL v2 card).
 *
 * GH Actions cron agent (agent-daily-brief.yml, 05:30 IST): reads every
 * markdown file in the vault clone (tasks, habits, calendar, attention,
 * finance, career — everything except its own agent status and other
 * agents'/proposals' bookkeeping), compacts it into a token-capped context
 * pack, asks Claude for a structured 5-line morning brief (mission preview,
 * first calendar block, top attention item, streak note, one money fact),
 * and writes it to `Briefs/<date>.md`. Owns `Briefs/**` + its own
 * `agents/daily-brief/**` status (path-partition, see
 * docs/agents/vault-tokens.md).
 *
 * Mirrors agents/email-triage/triage.mjs's shape: pure functions (context
 * pack building, brief validation, markdown rendering) are exported and
 * exercised byte-exact in brief.test.mjs with zero network/filesystem
 * access; the impure pieces (reading the vault clone, the Claude compose
 * call, the S47 run-log write, the file write, and the final commit+push)
 * all take an injectable seam so `run()` itself is testable end-to-end
 * without touching a live network or git remote.
 *
 * Failure contract (S50 DoD #1): a malformed/unparseable model response is
 * retried exactly ONCE (`composeBrief`'s own loop, not `run`'s). If the
 * retry is also malformed, `run()` logs the failure loudly via the S47
 * runLog helper (`ok: false`, pushed on its own so the fleet-health board
 * sees it immediately) and rethrows — nothing is written under `Briefs/**`
 * for that day. A malformed brief is worse than a missing one (the Home
 * surface already renders nothing when `Briefs/<date>.md` is absent — see
 * src/vault/briefs.ts + HomeView.tsx), so this agent never writes a
 * half-formed brief file.
 *
 * Secrets (GitHub Actions repo secrets — see agents/daily-brief/README.md):
 *   ANTHROPIC_API_KEY — required, the compose call.
 *   AGENT_VAULT_PAT_BRIEFS — vault push token, Contents R/W on
 *     LiveOS-VaultRepo only, writing only `Briefs/**` + `agents/daily-brief/**`
 *     (see docs/agents/vault-tokens.md).
 */

import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { logRun } from '../lib/runLog.mjs'
import { commitAndPush } from '../lib/push.mjs'

/** Commit author for every push this agent makes. */
export const COMMIT_AUTHOR = 'lifeos-daily-brief <lifeos-daily-brief@users.noreply.github.com>'

/** Vault repo this agent owns Briefs/** in (path-partition). */
export const VAULT_REPO = 'Deepak-Lakshmipathi/LiveOS-VaultRepo'
export const VAULT_BRANCH = 'main'

/** Model pinned for the compose call — verified against the claude-api skill's current model table. */
export const CLAUDE_MODEL = 'claude-sonnet-5'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

/** Expected cadence, in minutes, recorded on status.json for the health board. */
export const EXPECTED_CADENCE_MIN = 24 * 60

// ─────────────────────────────────────────────────────────────────────────
// Vault read (impure — filesystem)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Top-level directory names never walked when reading the vault: agent
 * bookkeeping and supervisor proposals aren't source material for a human
 * morning brief, and `Briefs/` is this agent's own OUTPUT — reading it back
 * into the next day's context pack would let yesterday's brief snowball
 * into today's, which is never what a "morning brief" should be.
 */
const EXCLUDED_TOP_DIRS = new Set(['agents', 'proposals', 'Briefs', '.git', 'node_modules'])

/**
 * Recursively collect every `.md` file in the vault clone (whole-vault read
 * per S50's context — tasks, habits, calendar, attention, finance, career
 * all live as markdown across different top-level folders, and the brief
 * needs a cross-domain view none of the other agents need). Impure (fs);
 * a directory that can't be read (permissions, race) is skipped rather than
 * failing the whole walk, matching the fleet's never-throw-on-one-bad-item
 * convention. Returns `{path, content}[]` with `path` relative to
 * `vaultDir`, forward-slashed.
 */
export async function readVaultFiles(vaultDir) {
  const results = []

  async function walk(dir, isTop) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (isTop && EXCLUDED_TOP_DIRS.has(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full, false)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        let content
        try {
          content = await readFile(full, 'utf8')
        } catch {
          continue
        }
        results.push({ path: relative(vaultDir, full).split('\\').join('/'), content })
      }
    }
  }

  await walk(vaultDir, true)
  return results
}

// ─────────────────────────────────────────────────────────────────────────
// Context pack (pure, token-capped)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Per-file digest cap and total context-pack cap, in characters. There is no
 * real tokenizer available to a plain-`node` script (the SDK's
 * `count_tokens` endpoint would mean a second network round trip just to
 * size the first one), so both caps use the standard ~4-chars-per-token
 * approximation — generous enough that the compose call's actual input
 * stays a small fraction of Sonnet 5's 1M context window even on a large
 * vault, while keeping the request small and cheap.
 */
export const DIGEST_CHARS_PER_FILE = 800
export const CONTEXT_CHAR_CAP = 20_000

/**
 * Compact one file's content to at most `maxChars`. Pure. Trims surrounding
 * whitespace first (most vault files have a trailing newline that shouldn't
 * count against the cap) and appends a truncation marker when cut, so
 * Claude knows the digest is partial rather than reading a hard-truncated
 * sentence as the whole file.
 */
export function digestFile(content, maxChars = DIGEST_CHARS_PER_FILE) {
  const trimmed = (content ?? '').trim()
  if (trimmed.length <= maxChars) return trimmed
  const marker = '\n…(truncated)'
  const keep = Math.max(0, maxChars - marker.length)
  return trimmed.slice(0, keep) + marker
}

/**
 * Build the token-capped context pack from the whole-vault file list. Pure.
 * Files are sorted by path (deterministic output — no dependency on
 * filesystem readdir ordering) and digested one at a time; once adding the
 * next file's section would exceed `maxTotalChars` the pack stops there
 * (remaining files are dropped, `truncated: true`) rather than truncating
 * mid-file, so every included file's digest is always readable in full up
 * to its own per-file cap.
 *
 * @param {{path: string, content: string}[]} files
 * @param {{maxTotalChars?: number, maxCharsPerFile?: number}} [opts]
 * @returns {{text: string, fileCount: number, totalFiles: number, truncated: boolean, charCount: number}}
 */
export function buildContextPack(files, { maxTotalChars = CONTEXT_CHAR_CAP, maxCharsPerFile = DIGEST_CHARS_PER_FILE } = {}) {
  const sorted = [...(files ?? [])]
    .filter((f) => f && typeof f.path === 'string' && typeof f.content === 'string')
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

  const sections = []
  let charCount = 0
  let truncated = false

  for (const f of sorted) {
    const digest = digestFile(f.content, maxCharsPerFile)
    const section = `### ${f.path}\n${digest}`
    // +2 accounts for the '\n\n' join separator this section would add.
    const addedLength = section.length + (sections.length > 0 ? 2 : 0)
    if (charCount + addedLength > maxTotalChars) {
      truncated = true
      break
    }
    sections.push(section)
    charCount += addedLength
  }

  return {
    text: sections.join('\n\n'),
    fileCount: sections.length,
    totalFiles: sorted.length,
    truncated: truncated || sections.length < sorted.length,
    charCount,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Claude compose — MOCKABLE, structured output, retry-once-then-fail
// ─────────────────────────────────────────────────────────────────────────

/**
 * Structured-output schema for the compose call. Deliberately loose (no
 * `minItems`/`maxItems` — array-length constraints aren't in the supported
 * structured-outputs subset): the exact-5-non-empty-lines invariant is
 * enforced by `validateBriefLines` below, not by the schema.
 */
const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['lines'],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `You write a 5-line morning brief for a personal task-tracking system, from a
digest of that person's whole vault (tasks, habits, calendar, attention items,
finance, career pipeline).

Return exactly 5 lines, in this order:
1. Mission preview — the single most important thing to win today.
2. First calendar block — the first scheduled event today, or "No events on the calendar today" if none appear in the digest.
3. Top attention item — the most pressing unhandled "needs you" item, or "Nothing urgent needs you" if none appear.
4. Streak note — a habit streak worth protecting or restarting, or "No active streaks to report" if the digest has no habit data.
5. One money fact — a single concrete number from the finance digest (net worth, burn, a bill due), or "No finance data available" if none appears.

Each line is ONE short plain-text sentence — no markdown, no leading dashes or
numbers (the caller renders the bullets), no line ever empty. If the digest
doesn't have enough information for a line, use the exact fallback text given
above for that line rather than inventing a fact.`

/**
 * One raw compose call. Impure (network); `fetchImpl` is injectable so tests
 * never hit the network. Throws on a genuine API failure (non-2xx, matching
 * every other agent's `classify`/`sample` convention); returns `null` — not
 * a throw — when the response has no parseable JSON text block, since that
 * is "malformed model output", not an API error, and `composeBrief` decides
 * what to do with malformed output (retry once, then fail loudly).
 */
export async function callClaudeForBrief({ apiKey, contextPack, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('callClaudeForBrief: apiKey is required')

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
      messages: [{ role: 'user', content: contextPack || '(vault is empty)' }],
      output_config: { format: { type: 'json_schema', schema: BRIEF_SCHEMA } },
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`callClaudeForBrief: Claude API returned ${res.status}: ${text}`)
  }

  const json = await res.json()
  const textBlock = (json.content ?? []).find((b) => b.type === 'text')
  if (!textBlock?.text) return null

  try {
    return JSON.parse(textBlock.text)
  } catch {
    return null
  }
}

/**
 * Validate a raw compose payload into exactly 5 non-empty, trimmed lines.
 * Pure. Returns `null` for anything that doesn't satisfy the invariant —
 * missing `lines`, wrong length, or any blank/whitespace-only entry — so
 * `composeBrief` can decide to retry rather than ever writing a short or
 * empty brief.
 */
export function validateBriefLines(raw) {
  if (!raw || !Array.isArray(raw.lines)) return null
  if (raw.lines.length !== 5) return null
  const lines = raw.lines.map((l) => (typeof l === 'string' ? l.trim() : ''))
  if (lines.some((l) => l.length === 0)) return null
  return lines
}

/**
 * Compose the brief: call Claude, validate, and retry EXACTLY ONCE on
 * malformed output before throwing (S50 DoD #1). The mockable seam:
 * `callClaude` defaults to the real network call but every test in
 * brief.test.mjs supplies its own mock, so `callClaudeForBrief` is never
 * invoked under `npx vitest run`.
 *
 * @returns {Promise<{lines: string[], attempts: number}>}
 * @throws when the model output is still malformed after one retry, or when
 *   `callClaude` itself throws (a real API failure is not retried here —
 *   that's `run()`'s concern, matching the rest of the fleet's convention of
 *   not swallowing genuine API errors as if they were "just try again").
 */
export async function composeBrief({ apiKey, contextPack, fetchImpl = fetch, callClaude = callClaudeForBrief } = {}) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await callClaude({ apiKey, contextPack, fetchImpl })
    const lines = validateBriefLines(raw)
    if (lines) return { lines, attempts: attempt }
  }
  throw new Error(
    'composeBrief: model output malformed after retry (expected {lines: string[5]} with 5 non-empty lines)',
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Rendering (pure) — roundtrips through src/vault/briefs.ts's parseBrief
// ─────────────────────────────────────────────────────────────────────────

/** Repo-relative path for a given day's brief, forward-slashed. Pure. */
export function briefFilePath(dateISO) {
  return `Briefs/${dateISO}.md`
}

/**
 * Render `Briefs/<date>.md`. Pure. Every line is a `- ` bullet — the exact
 * shape src/vault/briefs.ts's `parseBrief` reads back (S50 DoD #1: "exactly
 * 5 non-empty lines").
 */
export function renderBriefMarkdown(dateISO, lines) {
  const body = lines.map((l) => `- ${l}`).join('\n')
  return `# Briefs/${dateISO}.md\n\n${body}\n`
}

// ─────────────────────────────────────────────────────────────────────────
// Full run
// ─────────────────────────────────────────────────────────────────────────

/**
 * Full run: read the whole vault → build the context pack → compose the
 * brief (retry-once-then-fail) → write `Briefs/<date>.md` → log the run
 * (S47) → commit+push (own PAT). `vaultDir` is a working-copy clone of
 * LiveOS-VaultRepo.
 *
 * On a compose failure (malformed-after-retry, or the underlying API call
 * itself throwing), the run is still logged — loudly, `ok: false` — and
 * that failure record is pushed on its own (S50 DoD #1's "fail loudly via
 * runLog ok:false"), then the original error is rethrown so the GH Actions
 * job itself shows red. Nothing is written under `Briefs/**` in this path.
 *
 * Writes ONLY `Briefs/<date>.md` + its own `agents/daily-brief/{runs.jsonl,
 * status.json}` (S50 DoD #4) — never any other agent's or vault path.
 */
export async function run({
  vaultDir,
  apiKey = process.env.ANTHROPIC_API_KEY,
  fetchImpl = fetch,
  callClaude = callClaudeForBrief,
  push = commitAndPush,
  now = new Date(),
} = {}) {
  if (!vaultDir) throw new Error('run: vaultDir is required')

  const wallClockStart = Date.now()
  const dateISO = now.toISOString().slice(0, 10)

  const files = await readVaultFiles(vaultDir)
  const contextPack = buildContextPack(files)

  let lines
  try {
    ;({ lines } = await composeBrief({ apiKey, contextPack: contextPack.text, fetchImpl, callClaude }))
  } catch (err) {
    const durationMs = Date.now() - wallClockStart
    const message = err && err.message ? err.message : String(err)
    const { statusPath, runsPath } = logRun(vaultDir, 'daily-brief', {
      ok: false,
      note: `compose failed: ${message}`.slice(0, 300),
      duration_ms: durationMs,
      cadence: EXPECTED_CADENCE_MIN,
      ts: now.toISOString(),
    })
    await push(vaultDir, {
      files: [
        relative(vaultDir, statusPath).split('\\').join('/'),
        relative(vaultDir, runsPath).split('\\').join('/'),
      ],
      message: `daily-brief: FAILED ${dateISO} (${message})`.slice(0, 200),
      author: COMMIT_AUTHOR,
    })
    throw err
  }

  const briefRelPath = briefFilePath(dateISO)
  const briefMd = renderBriefMarkdown(dateISO, lines)
  await mkdir(join(vaultDir, 'Briefs'), { recursive: true })
  await writeFile(join(vaultDir, briefRelPath), briefMd, 'utf8')

  const durationMs = Date.now() - wallClockStart
  const { statusPath, runsPath } = logRun(vaultDir, 'daily-brief', {
    ok: true,
    note: `wrote ${briefRelPath} (${contextPack.fileCount}/${contextPack.totalFiles} vault files digested${contextPack.truncated ? ', capped' : ''})`,
    duration_ms: durationMs,
    cadence: EXPECTED_CADENCE_MIN,
    ts: now.toISOString(),
  })

  const pushFiles = [
    briefRelPath,
    relative(vaultDir, statusPath).split('\\').join('/'),
    relative(vaultDir, runsPath).split('\\').join('/'),
  ]

  await push(vaultDir, {
    files: pushFiles,
    message: `daily-brief: ${dateISO}`,
    author: COMMIT_AUTHOR,
  })

  return { ok: true, dateISO, briefPath: briefRelPath, lines, contextPack }
}

// Run directly when invoked as a script (`node agents/daily-brief/brief.mjs`),
// not when imported (e.g. by brief.test.mjs).
if (import.meta.url === `file://${process.argv[1]}`) {
  const vaultDir = process.env.VAULT_DIR
  if (!vaultDir) {
    console.error('brief.mjs: VAULT_DIR env var is required (path to a LiveOS-VaultRepo clone)')
    process.exit(1)
  }
  run({ vaultDir })
    .then((result) => {
      console.log(`daily-brief: wrote ${result.briefPath}`)
    })
    .catch((err) => {
      console.error('daily-brief: run failed:', err)
      process.exit(1)
    })
}
