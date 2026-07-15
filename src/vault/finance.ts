/**
 * finance — pure Finance vault contracts + parsers (S39).
 *
 * The Money tab (S40/S41) reads four vault files owned by the finance-sync
 * agent (S42). This module defines their shapes and the pure parsers that
 * turn raw markdown into those shapes. No I/O — the transport layer feeds
 * raw file content here. Every parser is pure and never throws: malformed
 * rows are silently skipped, exactly like parseVault (S14).
 *
 * Currency is INR. Values may be written raw (`1840000`), with a rupee sign
 * (`₹1840000`), or in Indian shorthand — lakh (`18.4L` = 18.4 × 100000) and
 * thousand (`96k` = 96 × 1000). `parseINR` accepts all of these; `formatINR`
 * is its display inverse for the common magnitudes.
 *
 * File shapes (see docs/slices/slice-S39-finance-contracts.md):
 *
 *   Finance/networth-history.md — append-only markdown table
 *     | date | networth |
 *     |------|----------|
 *     | 2026-07-01 | 1840000 |
 *
 *   Finance/portfolio.md
 *     - Equity (value:: 920000) (pct:: 50)
 *
 *   Finance/burn.md
 *     - income (month:: 2026-07) (amount:: 210000)
 *     - spend  (month:: 2026-07) (amount:: 96000)
 *
 *   Finance/bills.md
 *     - [ ] Electricity (amount:: 2340) (due:: 2026-07-20) (source:: gmail)
 *     - [x] Rent        (amount:: 32000) (due:: 2026-07-05) (source:: manual)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** One point on the net-worth series. `networth` is INR (plain number). */
export interface NetworthPoint {
  /** ISO date `YYYY-MM-DD`. */
  date: string
  /** Net worth in INR. */
  networth: number
}

/** One slice of the portfolio donut. */
export interface PortfolioSlice {
  /** Human label, e.g. "Equity". */
  label: string
  /** Slice value in INR. */
  value: number
  /** Percentage of the whole, 0–100. */
  pct: number
}

/** Income + spend for a single month. */
export interface BurnMonth {
  /** Month key `YYYY-MM`. */
  month: string
  /** Income in INR (0 when the month has no income line). */
  income: number
  /** Spend in INR (0 when the month has no spend line). */
  spend: number
}

/** One bill on the bills radar. */
export interface Bill {
  /** Bill name, e.g. "Electricity". */
  name: string
  /** Amount in INR. */
  amount: number
  /** ISO due date `YYYY-MM-DD`. */
  due: string
  /** Provenance, e.g. "gmail" or "manual". */
  source: string
  /** `[x]` in the vault → paid. */
  paid: boolean
}

// ─── Currency ──────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

/**
 * Parse an INR value that may carry a `₹` sign or Indian shorthand
 * (`L` = lakh ×100000, `k` = thousand ×1000). Case-insensitive on the suffix.
 *
 * @returns the numeric rupee value, or `null` when the input is empty or not
 *          a recognizable number (callers skip the row on null).
 *
 * Examples: `"1840000"` → 1840000 · `"₹18.4L"` → 1840000 · `"₹96k"` → 96000
 *           · `"₹5.52L"` → 552000 · `""` → null · `"abc"` → null.
 */
export function parseINR(raw: string | undefined | null): number | null {
  if (raw == null) return null
  const s = raw.replace(/₹/g, '').trim()
  if (!s) return null
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*([LlKk])?$/)
  if (!m) return null
  const n = parseFloat(m[1]!)
  if (!Number.isFinite(n)) return null
  const suffix = m[2]?.toLowerCase()
  if (suffix === 'l') return Math.round(n * 1e5)
  if (suffix === 'k') return Math.round(n * 1e3)
  return n
}

/**
 * Format an INR value for display, tabular-safe.
 *
 * Rule (magnitude-bucketed, deterministic — no locale grouping commas that
 * would vary digit width, so values line up under `font-variant-numeric:
 * tabular-nums`):
 *   - |n| ≥ 100000 → lakhs, one decimal, trailing `.0` trimmed  → `₹18.4L`
 *   - |n| ≥ 1000   → thousands, one decimal, trailing `.0` trimmed → `₹96k`
 *   - otherwise    → plain rupees  → `₹840`
 * Negative values (e.g. a net-worth delta) keep a leading `-`.
 *
 * Examples: 1840000 → `₹18.4L` · 96000 → `₹96k` · 840 → `₹840`
 *           · -60000 → `-₹60k`.
 */
export function formatINR(n: number): string {
  if (!Number.isFinite(n)) return '₹0'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, '')
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}k`
  return `${sign}₹${Math.round(abs)}`
}

// ─── Inline field helper ─────────────────────────────────────────────────────

/**
 * Extract `(key:: value)` inline fields from a line into a map. Later keys
 * win over earlier duplicates. Values are trimmed; missing keys are absent.
 */
function fields(line: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /\(([a-z_]+)::\s*([^)]*)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    out[m[1]!] = m[2]!.trim()
  }
  return out
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

/**
 * Parse `Finance/networth-history.md` — a markdown table — into a series
 * sorted ascending by date. Header, separator (`|---|`), non-ISO dates and
 * unparseable net-worth cells are skipped.
 */
export function parseNetworthHistory(content: string): NetworthPoint[] {
  const points: NetworthPoint[] = []
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('|')) continue
    const cells = t.split('|').map((c) => c.trim())
    // cells has empty leading/trailing entries from the outer pipes
    const inner = cells.filter((_, i) => i !== 0 && i !== cells.length - 1)
    if (inner.length < 2) continue
    const date = inner[0]!
    if (!DATE_RE.test(date)) continue // skips the "date" header + bad dates
    const networth = parseINR(inner[1])
    if (networth == null) continue
    points.push({ date, networth })
  }
  points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return points
}

/**
 * Delta between the last two points of a net-worth series (most recent minus
 * previous). Returns 0 when there are fewer than two points. Feed it the
 * output of `parseNetworthHistory` (already sorted).
 */
export function networthDelta(series: NetworthPoint[]): number {
  if (series.length < 2) return 0
  return series[series.length - 1]!.networth - series[series.length - 2]!.networth
}

/**
 * Parse `Finance/portfolio.md` list lines into slices. A line needs a label,
 * a parseable `value::` and a numeric `pct::`; otherwise it is skipped.
 * Order is preserved (donut draws slices in file order).
 */
export function parsePortfolio(content: string): PortfolioSlice[] {
  const slices: PortfolioSlice[] = []
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('- ')) continue
    // Label = text between "- " and the first field paren.
    const parenIdx = t.indexOf('(')
    const label = (parenIdx === -1 ? t.slice(2) : t.slice(2, parenIdx)).trim()
    if (!label) continue
    const f = fields(t)
    const value = parseINR(f.value)
    const pct = f.pct != null && /^-?\d+(?:\.\d+)?$/.test(f.pct) ? Number(f.pct) : null
    if (value == null || pct == null) continue
    slices.push({ label, value, pct })
  }
  return slices
}

/**
 * Parse `Finance/burn.md` income/spend lines into one `BurnMonth` per month,
 * sorted ascending by month. Only `income` and `spend` kinds count; any other
 * leading word, an invalid `month::`, or an unparseable `amount::` is skipped.
 * A month present on only one side gets 0 for the other.
 */
export function parseBurn(content: string): BurnMonth[] {
  const byMonth = new Map<string, BurnMonth>()
  for (const line of content.split('\n')) {
    const t = line.trim()
    const m = t.match(/^-\s+(income|spend)\b/)
    if (!m) continue
    const kind = m[1] as 'income' | 'spend'
    const f = fields(t)
    const month = f.month
    if (month == null || !MONTH_RE.test(month)) continue
    const amount = parseINR(f.amount)
    if (amount == null) continue
    const entry = byMonth.get(month) ?? { month, income: 0, spend: 0 }
    entry[kind] = amount
    byMonth.set(month, entry)
  }
  return [...byMonth.values()].sort((a, b) =>
    a.month < b.month ? -1 : a.month > b.month ? 1 : 0,
  )
}

/**
 * Parse `Finance/bills.md` checkbox lines into bills. `[x]` → paid. A bill
 * needs a name, a parseable `amount::` and an ISO `due::`; otherwise it is
 * skipped. `source::` defaults to "manual" when absent. File order preserved.
 */
export function parseBills(content: string): Bill[] {
  const bills: Bill[] = []
  for (const line of content.split('\n')) {
    const t = line.trim()
    const m = t.match(/^- \[([ xX])\]\s+(.*)$/)
    if (!m) continue
    const paid = m[1]!.toLowerCase() === 'x'
    const rest = m[2]!
    const parenIdx = rest.indexOf('(')
    const name = (parenIdx === -1 ? rest : rest.slice(0, parenIdx)).trim()
    if (!name) continue
    const f = fields(rest)
    const amount = parseINR(f.amount)
    if (amount == null) continue
    const due = f.due
    if (due == null || !DATE_RE.test(due)) continue
    const source = f.source || 'manual'
    bills.push({ name, amount, due, source, paid })
  }
  return bills
}

/**
 * Whole days from `today` until a bill's `due` date (negative = overdue).
 * Both are treated as calendar dates at UTC midnight, so the result is a
 * clean integer regardless of wall-clock time. A bill is "due soon" when
 * `dueInDays(...) <= 7` (and, typically, `>= 0`).
 *
 * @param due   ISO `YYYY-MM-DD`.
 * @param today ISO `YYYY-MM-DD` string or a Date.
 * @returns integer day difference, or `NaN` when `due` is not a valid date.
 */
export function dueInDays(due: string, today: string | Date): number {
  if (!DATE_RE.test(due)) return NaN
  const dueMs = Date.parse(due + 'T00:00:00Z')
  const todayStr =
    typeof today === 'string' ? today : today.toISOString().slice(0, 10)
  const todayMs = Date.parse(todayStr + 'T00:00:00Z')
  if (!Number.isFinite(dueMs) || !Number.isFinite(todayMs)) return NaN
  return Math.round((dueMs - todayMs) / 86_400_000)
}
