/**
 * scout.mjs — job-scout agent (S46): job boards -> Career/pipeline.md.
 *
 * Fetches listings from two keyless sources (RemoteOK API JSON, HN
 * whoishiring RSS), normalizes each to {company, role, url, tags}, scores
 * against the owner-editable agents/job-scout/profile.md keyword/weight
 * list, and APPENDS entries scoring >= threshold to Career/pipeline.md in
 * the exact S43 contract shape (src/vault/career.ts):
 *
 *   - <company> — <role> (stage:: found) (match:: NN%) (source:: job-scout) (url:: …)
 *
 * Never rewrites or reorders existing lines — owner-managed applied/
 * interview/closed entries are read-only to this agent. Dedup is by
 * case-insensitive company+role against every existing pipeline line
 * (any stage), not just prior job-scout finds.
 *
 * All network fetchers take an injectable `fetchImpl` so scout.test.mjs runs
 * against fixture JSON/RSS text with zero live network (docs/agents/afk-pipeline.md
 * test policy). The scorer and parsers are pure, exported, and unit-tested
 * directly.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePipeline } from '../../src/vault/career.ts'
import { commitAndPush } from '../lib/push.mjs'

export const VAULT_REPO = 'Deepak-Lakshmipathi/LiveOS-VaultRepo'
export const VAULT_BRANCH = 'main'
export const COMMIT_AUTHOR = 'lifeos-job-scout <lifeos-job-scout@users.noreply.github.com>'

const REMOTEOK_URL = 'https://remoteok.com/api'
const HN_WHOISHIRING_RSS_URL = 'https://hnrss.org/whoishiring/newest?q=hiring'

// ── Profile (keywords/weights/threshold) ────────────────────────────────────

/**
 * Parse agents/job-scout/profile.md into { threshold, keywords }. Pure.
 * `keywords` is a Map<lowercase keyword, weight>. Malformed lines (not
 * `key: number`) are skipped, never thrown — an owner typo shouldn't crash
 * the run, it just won't score.
 */
export function parseProfile(md) {
  const keywords = new Map()
  let threshold = 60 // sane default if profile.md is missing the field
  for (const rawLine of md.split('\n')) {
    const line = rawLine.trim()
    const m = /^([a-zA-Z0-9_-]+)\s*:\s*(-?\d+(?:\.\d+)?)\s*$/.exec(line)
    if (!m) continue
    const key = m[1].toLowerCase()
    const value = Number(m[2])
    if (key === 'threshold') threshold = value
    else keywords.set(key, value)
  }
  return { threshold, keywords }
}

/**
 * Score one normalized listing against the profile (pure, 0-100 integer).
 * Every keyword present as a whole word (case-insensitive) in
 * `title + tags + description` contributes its weight; score is the summed
 * weight as a fraction of the max possible weight, capped at 100.
 */
export function scoreListing(listing, profile) {
  const { keywords } = profile
  if (keywords.size === 0) return 0
  const haystack = [listing.role, ...(listing.tags ?? []), listing.description ?? '']
    .join(' ')
    .toLowerCase()

  let hit = 0
  let max = 0
  for (const [keyword, weight] of keywords) {
    max += weight
    const re = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (re.test(haystack)) hit += weight
  }
  if (max <= 0) return 0
  return Math.round(Math.min(100, Math.max(0, (hit / max) * 100)))
}

// ── Source fetch + normalize (RemoteOK) ──────────────────────────────────────

/**
 * Fetch RemoteOK's public JSON API. Impure (network); `fetchImpl` injectable.
 * Returns the raw parsed array (first element is a legend object, filtered
 * out by normalizeRemoteOk).
 */
export async function fetchRemoteOk({ fetchImpl = fetch } = {}) {
  const res = await fetchImpl(REMOTEOK_URL)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`fetchRemoteOk: RemoteOK API returned ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * Normalize RemoteOK's raw JSON array into {company, role, url, tags}[].
 * Pure. Skips the legend object (no `id`) and any entry missing
 * company/position/url — never throws on malformed input.
 */
export function normalizeRemoteOk(items) {
  const out = []
  for (const item of items ?? []) {
    if (!item || !item.id) continue // legend row or malformed
    const company = (item.company ?? '').trim()
    const role = (item.position ?? '').trim()
    const url = (item.url ?? item.apply_url ?? '').trim()
    if (!company || !role || !url) continue
    out.push({
      company,
      role,
      url,
      tags: Array.isArray(item.tags) ? item.tags : [],
      description: item.description ?? '',
      source: 'remoteok',
    })
  }
  return out
}

// ── Source fetch + normalize (HN whoishiring RSS) ────────────────────────────

/**
 * Fetch the HN "Who is hiring" RSS feed as raw XML text. Impure (network);
 * `fetchImpl` injectable.
 */
export async function fetchHnRss({ fetchImpl = fetch } = {}) {
  const res = await fetchImpl(HN_WHOISHIRING_RSS_URL)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`fetchHnRss: hnrss.org returned ${res.status}: ${text}`)
  }
  return res.text()
}

/** Decode the handful of XML entities RSS feeds actually use. */
function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/**
 * Normalize HN whoishiring RSS XML text into {company, role, url, tags}[].
 * Pure, regex-based (no XML parser dependency needed for this narrow shape).
 *
 * HN "Ask HN: Who is hiring?" comment titles follow the convention
 * `Company | Role | Location | Remote/Onsite` (pipe-delimited, company/role
 * always first two fields); anything not matching that shape is skipped —
 * this feed carries top-level meta-comments too, not just job postings.
 */
export function normalizeHnRss(xml) {
  const out = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1]
    const title = decodeXmlEntities(
      (/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block)?.[1] ?? '').trim(),
    )
    const link = decodeXmlEntities(
      (/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/.exec(block)?.[1] ?? '').trim(),
    )
    const description = decodeXmlEntities(
      (
        /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/.exec(block)?.[1] ?? ''
      ).trim(),
    )
    if (!title || !link) continue

    const parts = title.split('|').map((p) => p.trim())
    if (parts.length < 2) continue // not a "Company | Role | ..." posting
    const [company, role] = parts
    if (!company || !role) continue

    out.push({
      company,
      role,
      url: link,
      tags: parts.slice(2),
      description,
      source: 'hn-whoishiring',
    })
  }
  return out
}

// ── Append-with-dedup ─────────────────────────────────────────────────────────

/** Normalize company+role into a dedup key (case-insensitive). */
function dedupKey(company, role) {
  return `${company.trim().toLowerCase()}|${role.trim().toLowerCase()}`
}

/**
 * Render one matched listing as a Career/pipeline.md line, in the exact S43
 * contract shape. Pure. `match` is the 0-100 integer score.
 */
export function listingToPipelineLine(listing, match) {
  return `- ${listing.company} — ${listing.role} (stage:: found) (match:: ${match}%) (source:: job-scout) (url:: ${listing.url})`
}

/**
 * Score + filter + dedup a batch of normalized listings against the current
 * pipeline.md content, returning only the NEW lines to append. Pure — takes
 * the existing file content as a string, never touches disk itself.
 *
 * Dedup checks BOTH the existing file's entries (any stage — an owner may
 * have already applied to something job-scout would otherwise re-find) and
 * within the incoming batch itself (two sources returning the same posting).
 */
export function buildAppendLines(listings, existingPipelineMd, profile) {
  const existing = new Set(
    parsePipeline(existingPipelineMd).map((e) => dedupKey(e.company, e.role)),
  )
  const lines = []
  for (const listing of listings) {
    const key = dedupKey(listing.company, listing.role)
    if (existing.has(key)) continue

    const match = scoreListing(listing, profile)
    if (match < profile.threshold) continue

    lines.push(listingToPipelineLine(listing, match))
    existing.add(key) // dedup within this batch too
  }
  return lines
}

// ── I/O + full run ────────────────────────────────────────────────────────────

const PIPELINE_PATH = 'Career/pipeline.md'

/**
 * Read the current Career/pipeline.md (empty string if it doesn't exist
 * yet), append the new lines (each on its own line, file ending in a
 * trailing newline), and write it back. Impure (filesystem). Writes ONLY
 * this one file (S46 DoD).
 */
async function appendToPipelineFile(vaultDir, newLines) {
  const filePath = join(vaultDir, PIPELINE_PATH)
  let existing = ''
  try {
    existing = await readFile(filePath, 'utf8')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const sep = existing.length > 0 && !existing.endsWith('\n') ? '\n' : ''
  const updated = existing + sep + newLines.map((l) => l + '\n').join('')
  await writeFile(filePath, updated, 'utf8')
  return filePath
}

/**
 * Full run: read profile -> fetch both sources -> normalize -> score/dedup
 * against the live pipeline.md -> append -> commit+push. `push` defaults to
 * the shared commitAndPush wrapper; overridable for tests/dry-runs. Commits
 * + pushes ONLY Career/pipeline.md (S46 DoD).
 */
export async function run({
  vaultDir,
  profilePath = join(dirname(fileURLToPath(import.meta.url)), 'profile.md'),
  fetchImpl = fetch,
  push = commitAndPush,
  readFileImpl = readFile,
} = {}) {
  if (!vaultDir) throw new Error('run: vaultDir is required')

  const profileMd = await readFileImpl(profilePath, 'utf8')
  const profile = parseProfile(profileMd)

  const [remoteOkRaw, hnRssRaw] = await Promise.all([
    fetchRemoteOk({ fetchImpl }),
    fetchHnRss({ fetchImpl }),
  ])
  const listings = [...normalizeRemoteOk(remoteOkRaw), ...normalizeHnRss(hnRssRaw)]

  const existingPath = join(vaultDir, PIPELINE_PATH)
  let existingMd = ''
  try {
    existingMd = await readFile(existingPath, 'utf8')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }

  const newLines = buildAppendLines(listings, existingMd, profile)

  if (newLines.length > 0) {
    await appendToPipelineFile(vaultDir, newLines)
    await push(vaultDir, {
      files: [PIPELINE_PATH],
      message: `job-scout: ${newLines.length} new find${newLines.length === 1 ? '' : 's'}`,
      author: COMMIT_AUTHOR,
    })
  }

  return { ok: true, found: listings.length, appended: newLines.length, lines: newLines }
}

// Run directly when invoked as a script (`node agents/job-scout/scout.mjs`),
// not when imported (e.g. by scout.test.mjs).
if (import.meta.url === `file://${process.argv[1]}`) {
  const vaultDir = process.env.VAULT_DIR
  if (!vaultDir) {
    console.error('scout.mjs: VAULT_DIR env var is required (path to a LiveOS-VaultRepo clone)')
    process.exit(1)
  }
  run({ vaultDir })
    .then((result) => {
      console.log(`job-scout: ${result.appended}/${result.found} listings appended`)
    })
    .catch((err) => {
      console.error('job-scout: run failed:', err)
      process.exit(1)
    })
}
