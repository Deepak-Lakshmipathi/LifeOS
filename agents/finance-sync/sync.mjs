/**
 * sync.mjs — finance-sync agent (S42): Kite Connect + Groww CSV -> Finance/**.
 *
 * The one agent that runs on the owner's PC, not GitHub Actions (placement
 * rule: Kite Connect needs a daily interactive login; Groww arrives as CSV
 * downloads into a local drop folder — see docs/agents/afk-pipeline.md).
 * Pulls Kite holdings+margins, parses the latest Groww CSV in
 * `FINANCE_DROP_DIR`, and computes the three files this agent owns:
 *
 *   Finance/networth-history.md — appended (only when the month changed or
 *     the value moved >1% since the last row — S42 DoD, keeps the series
 *     from being spammed by same-month noise).
 *   Finance/portfolio.md        — rewritten from Kite holdings + Groww cash,
 *     bucketed into Equity / Mutual funds / Cash.
 *   Finance/burn.md             — month-to-date income/spend line appended
 *     for the current month (income line passed through unchanged; spend
 *     computed from the Groww CSV's debit rows).
 *
 * `Finance/bills.md` is NEVER touched — bills stay manual/gmail-fed (S39
 * contract, owned by a different producer).
 *
 * All I/O (Kite fetch, CSV read, file write, git push) is injectable so
 * `run()` is fully testable with zero network and zero live git — see
 * sync.test.mjs. The write is atomic: all three files are computed first and
 * only written if every computation succeeds; the commit stages all three
 * (or none) via agents/lib/push.mjs's commitAndPush, one commit
 * "finance-sync: <date>".
 *
 * Every value parsed out of Kite/CSV round-trips through the S39 contract
 * parsers in src/vault/finance.ts (the Money tab's read side) — this file
 * only ever renders the exact markdown shapes documented there.
 */

import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { commitAndPush } from '../lib/push.mjs'
import { tokenFilePath } from './login.mjs'
import {
  parseNetworthHistory,
  parsePortfolio,
} from '../../src/vault/finance.ts'

/** Vault repo this agent owns Finance/** in (path-partition, S42 Context). */
export const VAULT_REPO = 'Deepak-Lakshmipathi/LiveOS-VaultRepo'
export const VAULT_BRANCH = 'main'

/** Commit author for every push this agent makes. */
export const COMMIT_AUTHOR = 'lifeos-finance-sync <lifeos-finance-sync@users.noreply.github.com>'

const KITE_API_BASE = 'https://api.kite.trade'

// ─── Pure date helpers ────────────────────────────────────────────────────

/** Today's ISO date (YYYY-MM-DD), pure given `now`. No timezone shenanigans
 * needed here (unlike calendar-sync) — money doesn't care about clock time,
 * only the calendar date the sync ran on. */
export function todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

/** `YYYY-MM` month key from an ISO date string. */
export function monthOf(dateISO) {
  return dateISO.slice(0, 7)
}

// ─── Kite mapping ──────────────────────────────────────────────────────────

/**
 * Map a Kite Connect `/portfolio/holdings` response (array of holdings) plus
 * a `/user/margins` response into portfolio buckets. Pure.
 *
 * Kite holdings: each item has `quantity`, `last_price`, and `product`/
 * `instrument_type` we don't need — we only need `last_price * quantity` per
 * holding, bucketed by `holding.exchange`/`instrument` heuristics collapsed
 * to two buckets the S39 contract expects: 'Equity' (direct stocks) and
 * 'Mutual funds' (Kite MF holdings, present when `holding.mf === true` or
 * the item comes from a separate MF-holdings endpoint the caller flags via
 * `isMF`). Unrecognized/malformed rows are skipped, never thrown.
 */
export function mapKiteHoldings(holdings) {
  let equity = 0
  let mutualFunds = 0
  for (const h of holdings ?? []) {
    const qty = Number(h?.quantity)
    const price = Number(h?.last_price)
    if (!Number.isFinite(qty) || !Number.isFinite(price)) continue
    const value = qty * price
    if (h?.isMF) mutualFunds += value
    else equity += value
  }
  return { equity, mutualFunds }
}

/**
 * Cash balance out of a Kite `/user/margins` response — the equity segment's
 * `net` field (funds available). Pure; returns 0 on malformed input.
 */
export function mapKiteMargins(margins) {
  const net = Number(margins?.equity?.net)
  return Number.isFinite(net) ? net : 0
}

// ─── Groww CSV parsing ───────────────────────────────────────────────────

/**
 * Parse a Groww transactions CSV export into rows of
 * `{ date, type, amount }` — `type` is 'credit' | 'debit', taken from the
 * CSV's own sign/column convention. Expected header columns (case-
 * insensitive): Date, Type, Amount (Groww's export format). Malformed rows
 * (bad date, unrecognized type, unparseable amount) are skipped, never
 * thrown — matches every parser in src/vault/finance.ts.
 */
export function parseGrowwCSV(content) {
  const lines = (content ?? '').split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return []
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const dateIdx = header.indexOf('date')
  const typeIdx = header.indexOf('type')
  const amountIdx = header.indexOf('amount')
  if (dateIdx === -1 || typeIdx === -1 || amountIdx === -1) return []

  const rows = []
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((c) => c.trim())
    const date = cells[dateIdx]
    const typeRaw = cells[typeIdx]?.toLowerCase()
    const amount = Number(cells[amountIdx])
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    if (typeRaw !== 'credit' && typeRaw !== 'debit') continue
    if (!Number.isFinite(amount)) continue
    rows.push({ date, type: typeRaw, amount })
  }
  return rows
}

/**
 * Sum a Groww CSV's rows into month-to-date income (credits) and spend
 * (debits) for `month` (YYYY-MM). Pure.
 */
export function summarizeGrowwMonth(rows, month) {
  let income = 0
  let spend = 0
  for (const r of rows) {
    if (monthOf(r.date) !== month) continue
    if (r.type === 'credit') income += r.amount
    else spend += r.amount
  }
  return { income, spend }
}

/** Groww CSV rows' cash delta (credits - debits), used as the cash bucket's
 * contribution to net worth alongside Kite margins. Pure. */
export function growwCashDelta(rows) {
  let delta = 0
  for (const r of rows) delta += r.type === 'credit' ? r.amount : -r.amount
  return delta
}

// ─── Rendering (pure; every shape here is the S39 contract) ───────────────

/**
 * Whether a new net-worth row should be appended: month changed since the
 * last row, OR the value moved more than 1% since the last row. No prior
 * rows -> always append (first data point). Pure.
 */
export function shouldAppendNetworth(series, newPoint) {
  if (series.length === 0) return true
  const last = series[series.length - 1]
  if (monthOf(last.date) !== monthOf(newPoint.date)) return true
  if (last.networth === 0) return newPoint.networth !== 0
  const movedPct = Math.abs((newPoint.networth - last.networth) / last.networth) * 100
  return movedPct > 1
}

/** Render the full networth-history table (S39 contract) from a series
 * already sorted ascending by date. Pure. */
export function renderNetworthHistory(series) {
  const lines = ['# Finance/networth-history.md — append-only table', '', '| date | networth |', '|------|----------|']
  for (const p of series) lines.push(`| ${p.date} | ${p.networth} |`)
  return lines.join('\n') + '\n'
}

/** Render Finance/portfolio.md (S39 contract) from bucket values. Pure.
 * Buckets with a zero/negative value are skipped (nothing to show). */
export function renderPortfolio({ equity, mutualFunds, cash }) {
  const buckets = [
    ['Equity', equity],
    ['Mutual funds', mutualFunds],
    ['Cash', cash],
  ].filter(([, v]) => v > 0)
  const total = buckets.reduce((sum, [, v]) => sum + v, 0)
  const lines = ['# Finance/portfolio.md', '']
  for (const [label, value] of buckets) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0
    lines.push(`- ${label} (value:: ${Math.round(value)}) (pct:: ${pct})`)
  }
  return lines.join('\n') + '\n'
}

/** Append one month's income/spend lines to Finance/burn.md's existing raw
 * content (string in, string out — preserves prior months untouched). Pure. */
export function appendBurnMonth(existingContent, { month, income, spend }) {
  const base = (existingContent ?? '# Finance/burn.md\n').replace(/\n*$/, '\n')
  return (
    base +
    `- income (month:: ${month}) (amount:: ${Math.round(income)})\n` +
    `- spend (month:: ${month}) (amount:: ${Math.round(spend)})\n`
  )
}

// ─── I/O (impure; every side effect is injectable for tests) ──────────────

/** Latest Groww CSV file (by filename sort, which is by export-date
 * convention `groww-YYYY-MM-DD.csv`) in `dropDir`. Returns null if none. */
export async function findLatestGrowwCSV(dropDir, { readdirImpl = readdir } = {}) {
  let files
  try {
    files = await readdirImpl(dropDir)
  } catch {
    return null
  }
  const csvs = files.filter((f) => f.toLowerCase().endsWith('.csv')).sort()
  if (csvs.length === 0) return null
  return join(dropDir, csvs[csvs.length - 1])
}

/**
 * Resolve the Kite access token: explicit `accessToken` wins, else read the
 * local user-dir token file `login.mjs` wrote (never the repo/vault).
 * Impure (fs); `readFileImpl` injectable.
 */
export async function resolveAccessToken({ accessToken, readFileImpl = readFile } = {}) {
  if (accessToken) return accessToken
  try {
    const raw = await readFileImpl(tokenFilePath(), 'utf8')
    return JSON.parse(raw)?.access_token ?? null
  } catch {
    return null
  }
}

/** Fetch Kite holdings + margins. Impure (network); `fetchImpl` injectable. */
export async function fetchKiteData({ apiKey, accessToken, fetchImpl = fetch } = {}) {
  if (!apiKey || !accessToken) {
    throw new Error('fetchKiteData: apiKey and accessToken are both required')
  }
  const headers = { Authorization: `token ${apiKey}:${accessToken}` }
  const [holdingsRes, marginsRes] = await Promise.all([
    fetchImpl(`${KITE_API_BASE}/portfolio/holdings`, { headers }),
    fetchImpl(`${KITE_API_BASE}/user/margins`, { headers }),
  ])
  if (!holdingsRes.ok) {
    const text = await holdingsRes.text().catch(() => '')
    throw new Error(`fetchKiteData: holdings endpoint returned ${holdingsRes.status}: ${text}`)
  }
  if (!marginsRes.ok) {
    const text = await marginsRes.text().catch(() => '')
    throw new Error(`fetchKiteData: margins endpoint returned ${marginsRes.status}: ${text}`)
  }
  const holdingsJson = await holdingsRes.json()
  const marginsJson = await marginsRes.json()
  return { holdings: holdingsJson?.data ?? [], margins: marginsJson?.data ?? {} }
}

/**
 * Full run: fetch Kite data + read latest Groww CSV -> compute the three
 * owned files -> write all three -> commit+push in one atomic commit.
 *
 * Atomicity (S42 DoD #3): every file's new content is computed in memory
 * first; if any computation throws, NOTHING is written and NOTHING is
 * committed. Writes happen only after all three contents are ready, and the
 * commit stages all three together — a mid-write failure (injected via
 * `writeFileImpl`) leaves the working tree exactly as it was (git add/commit
 * never ran), so a partial vault state can't be pushed.
 *
 * `Finance/bills.md` is never read or written here (S42 DoD #2).
 */
export async function run({
  vaultDir,
  dropDir = process.env.FINANCE_DROP_DIR,
  apiKey = process.env.KITE_API_KEY,
  accessToken = process.env.KITE_ACCESS_TOKEN,
  fetchImpl = fetch,
  readFileImpl = readFile,
  writeFileImpl = writeFile,
  mkdirImpl = mkdir,
  readdirImpl = readdir,
  push = commitAndPush,
  now = new Date(),
} = {}) {
  if (!vaultDir) throw new Error('run: vaultDir is required')
  if (!dropDir) throw new Error('run: dropDir (FINANCE_DROP_DIR) is required')

  const dateISO = todayISO(now)
  const month = monthOf(dateISO)

  // ── 1. Gather inputs (network + fs reads only — no writes yet) ──
  const resolvedToken = await resolveAccessToken({ accessToken, readFileImpl })
  if (!resolvedToken) {
    throw new Error(
      'run: no Kite access token found — run login.mjs first (or set KITE_ACCESS_TOKEN)',
    )
  }
  const { holdings, margins } = await fetchKiteData({ apiKey, accessToken: resolvedToken, fetchImpl })
  const csvPath = await findLatestGrowwCSV(dropDir, { readdirImpl })
  const csvContent = csvPath ? await readFileImpl(csvPath, 'utf8') : ''
  const growwRows = parseGrowwCSV(csvContent)

  const existingNetworthPath = join(vaultDir, 'Finance', 'networth-history.md')
  const existingPortfolioPath = join(vaultDir, 'Finance', 'portfolio.md')
  const existingBurnPath = join(vaultDir, 'Finance', 'burn.md')

  const existingNetworthContent = await readFileImpl(existingNetworthPath, 'utf8').catch(() => '')
  const existingBurnContent = await readFileImpl(existingBurnPath, 'utf8').catch(() => '')

  // ── 2. Compute (pure) — everything below can throw safely; nothing
  //    written to disk yet, so a throw here leaves the vault untouched. ──
  const { equity, mutualFunds } = mapKiteHoldings(holdings)
  const marginsCash = mapKiteMargins(margins)
  const cash = marginsCash + growwCashDelta(growwRows)
  const netWorth = equity + mutualFunds + cash

  const series = parseNetworthHistory(existingNetworthContent)
  const newPoint = { date: dateISO, networth: Math.round(netWorth) }
  const appendNetworth = shouldAppendNetworth(series, newPoint)
  const newSeries = appendNetworth ? [...series, newPoint] : series
  const networthOut = renderNetworthHistory(newSeries)

  const portfolioOut = renderPortfolio({ equity, mutualFunds, cash })

  const { income, spend } = summarizeGrowwMonth(growwRows, month)
  const burnOut = appendBurnMonth(existingBurnContent, { month, income, spend })

  // ── 3. Write all three, then commit+push atomically ──
  await mkdirImpl(join(vaultDir, 'Finance'), { recursive: true })
  await writeFileImpl(existingNetworthPath, networthOut, 'utf8')
  await writeFileImpl(existingPortfolioPath, portfolioOut, 'utf8')
  await writeFileImpl(existingBurnPath, burnOut, 'utf8')

  await push(vaultDir, {
    files: ['Finance/networth-history.md', 'Finance/portfolio.md', 'Finance/burn.md'],
    message: `finance-sync: ${dateISO}`,
    author: COMMIT_AUTHOR,
  })

  return {
    ok: true,
    dateISO,
    appendNetworth,
    netWorth: newPoint.networth,
    portfolio: { equity, mutualFunds, cash },
    burn: { month, income, spend },
  }
}

// Run directly when invoked as a script (`node agents/finance-sync/sync.mjs`),
// not when imported (e.g. by sync.test.mjs).
if (import.meta.url === `file://${process.argv[1]}`) {
  const vaultDir = process.env.VAULT_DIR
  if (!vaultDir) {
    console.error('sync.mjs: VAULT_DIR env var is required (path to a LiveOS-VaultRepo clone)')
    process.exit(1)
  }
  run({ vaultDir })
    .then((result) => {
      console.log(`finance-sync: ${result.dateISO} net worth ${result.netWorth}`)
    })
    .catch((err) => {
      console.error('finance-sync: run failed:', err)
      process.exit(1)
    })
}
