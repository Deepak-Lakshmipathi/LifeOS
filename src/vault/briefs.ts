/**
 * briefs — pure vault contract + parser for the daily-brief agent (S50).
 *
 * The daily-brief agent (`agents/daily-brief/brief.mjs`) reads the whole
 * vault every morning and writes a 5-line brief to `Briefs/<date>.md`. This
 * module is the read-side parser for that file, plus the pure path helper
 * both sides use to agree on which file is "today's". No I/O here — the
 * transport layer feeds raw file content in, same convention as
 * `parseVault.ts`, `mail.ts`, `finance.ts` (S14/S36/S39).
 *
 * Vault markdown shape (agents/daily-brief/brief.mjs's renderBriefMarkdown):
 *   # Briefs/2026-07-23.md
 *
 *   - Win: ship the S50 daily brief agent.
 *   - 10:00 Client call — NorthStar handoff.
 *   - Meera (NorthStar) is waiting 26h on a quote.
 *   - Course study block is on a 6-day streak — keep it alive.
 *   - Net worth is ₹18.4L, up 2.1% this month.
 *
 * Exactly 5 bullet lines when the agent's own compose/validate step
 * succeeded (`validateBriefLines` in brief.mjs) — but this parser makes no
 * such assumption on read: it collects whatever `- ` bullet lines are
 * present (0 to N), non-empty after trimming, and leaves "is this a
 * complete brief" to the caller (HomeView.tsx renders nothing when the
 * result is empty — a missing or malformed brief is never surfaced as an
 * error, per §8 "no fake-real data").
 */

/**
 * Repo-relative path to a given day's brief file, forward-slashed. Pure —
 * both the agent (`briefFilePath` in brief.mjs) and the PWA (this function)
 * compute the identical path for the identical date, so the two sides never
 * drift.
 *
 * @param today - a Date (uses its UTC calendar date) or an already-ISO
 *   `YYYY-MM-DD` string. Defaults to `new Date()` — callers that need a
 *   deterministic path (tests, the agent's own `now` injection) always pass
 *   an explicit value instead.
 */
export function latestBriefPath(today: Date | string = new Date()): string {
  const iso = typeof today === 'string' ? today.slice(0, 10) : today.toISOString().slice(0, 10)
  return `Briefs/${iso}.md`
}

/**
 * Parse `Briefs/<date>.md` into its bullet lines. Tolerant, never throws:
 * a missing file (`null`/`undefined`), a file with no `- ` bullets, or any
 * blank/whitespace-only bullet content all fold into an empty result rather
 * than a partial/garbled one — the caller treats "no lines" as "no brief to
 * show today", not an error state.
 *
 * @param md - raw markdown (or null/undefined for a missing file).
 */
export function parseBrief(md: string | null | undefined): string[] {
  if (!md) return []
  const lines: string[] = []
  for (const raw of md.split(/\r?\n/)) {
    const match = raw.match(/^-\s+(.+)$/)
    if (!match) continue
    const text = match[1]!.trim()
    if (text.length > 0) lines.push(text)
  }
  return lines
}
