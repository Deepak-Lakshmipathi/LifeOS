/**
 * supervisor — pure parsers for the supervisor control-plane contracts (S52).
 *
 * The supervisor is the fleet's control plane: weekly it audits every agent's
 * `runs.jsonl`, writes a REPORT, and PROPOSES prompt/config patches. A proposal
 * never self-applies — the owner approves (or rejects) it in the PWA first, in
 * the confirm-destructive spirit of v1 S17. This module is the read/write seam
 * for those two file contracts. It is pure: no I/O, never throws on malformed
 * input — the transport layer feeds raw file content in and takes bytes back.
 *
 * Two file shapes (see __fixtures__/):
 *
 *   agents/supervisor/<date>.md   — weekly report
 *     # agents/supervisor/2026-07-13.md
 *     ## Fleet week
 *     - email-triage: 168 runs, 2 failures, avg 8.1s.
 *     ## Concerns
 *     - calendar-sync stale twice (>2h) on 07-11.
 *     ## Proposals
 *     - [[proposals/email-triage-2026-07-13]]
 *
 *   proposals/<agent>-<date>.md   — a single proposed patch, owner-gated
 *     ---
 *     agent: email-triage
 *     date: 2026-07-13
 *     status: pending          # pending | approved | rejected
 *     ---
 *     ## Change
 *     ...
 *     ## Diff
 *     ...
 *     ## Why
 *     ...
 */

/** Approval lifecycle of a proposal. `pending` is the safe default. */
export type ProposalStatus = 'pending' | 'approved' | 'rejected'

/** The three statuses a proposal may legitimately carry. */
const VALID_STATUSES: readonly ProposalStatus[] = ['pending', 'approved', 'rejected']

/** A parsed weekly supervisor report. */
export interface SupervisorReport {
  /** ISO date (YYYY-MM-DD) lifted from the report's H1, or '' if none present. */
  date: string
  /**
   * H2 sections keyed by heading text → raw body (trailing/leading blank lines
   * trimmed, inner content verbatim). EVERY H2 is preserved, known or not —
   * an unrecognised section is kept, never dropped (DoD #1).
   */
  sections: Record<string, string>
}

/** A parsed proposal: frontmatter + the three canonical body sections. */
export interface Proposal {
  agent: string
  /** ISO date (YYYY-MM-DD) from frontmatter, or '' if absent. */
  date: string
  /** Always one of the three valid statuses — an invalid/missing one → 'pending'. */
  status: ProposalStatus
  change: string
  diff: string
  why: string
}

/** Matches an ISO calendar date anywhere in a string. */
const ISO_DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/

/**
 * Parse a weekly supervisor report.
 *
 * Tolerant by design: the date is lifted from the first `# ` heading (falling
 * back to the first ISO date anywhere in the document); sections are split on
 * every `## ` heading and preserved verbatim regardless of heading name, so an
 * unknown section is carried through rather than lost (DoD #1). Content before
 * the first H2 (e.g. the H1 line) is not a section and is ignored.
 *
 * @param md - raw markdown (or null/undefined for a missing file).
 */
export function parseReport(md: string | null | undefined): SupervisorReport {
  const sections: Record<string, string> = {}
  if (!md) return { date: '', sections }

  // Split CRLF-tolerantly so section bodies never carry a stray '\r' (the repo
  // has no .gitattributes and autocrlf may rewrite fixtures to CRLF on checkout).
  const lines = md.split(/\r?\n/)

  // ── Date: prefer the H1 line, else the first ISO date anywhere ─────────────
  let date = ''
  const h1 = lines.find((l) => /^#\s+/.test(l))
  const dateSource = h1 && ISO_DATE_RE.test(h1) ? h1 : md
  const dateMatch = dateSource.match(ISO_DATE_RE)
  if (dateMatch) date = dateMatch[1]!

  // ── Sections: split on H2 headings, preserve every one verbatim ────────────
  let currentHeading: string | null = null
  let buffer: string[] = []

  const flush = () => {
    if (currentHeading !== null) {
      // Trim only surrounding blank lines; keep inner content byte-for-byte.
      sections[currentHeading] = buffer.join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
    }
  }

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.*\S)\s*$/)
    if (headingMatch) {
      flush()
      currentHeading = headingMatch[1]!
      buffer = []
    } else if (currentHeading !== null) {
      buffer.push(line)
    }
  }
  flush()

  return { date, sections }
}

/**
 * Strip a trailing ` # comment` from a frontmatter scalar value.
 * A `#` must be preceded by whitespace to count as a comment introducer, so a
 * value that itself contains `#` (with no leading space) is left intact.
 */
function stripInlineComment(value: string): string {
  return value.replace(/\s+#.*$/, '').trim()
}

/**
 * Locate the leading YAML frontmatter block.
 * Frontmatter must open with `---` on the very first line and close on a later
 * `---` line. Returns the byte offsets of the body (between the delimiters) plus
 * the body text, or null when there is no well-formed frontmatter.
 */
function findFrontmatter(
  md: string,
): { bodyStart: number; bodyEnd: number; body: string } | null {
  const open = md.match(/^---[ \t]*\r?\n/)
  if (!open) return null
  const bodyStart = open[0].length
  const close = md.slice(bodyStart).match(/\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!close) return null
  const bodyEnd = bodyStart + close.index!
  return { bodyStart, bodyEnd, body: md.slice(bodyStart, bodyEnd) }
}

/**
 * Parse a proposal file into its frontmatter + three body sections.
 *
 * Safe defaults everywhere (DoD #3): a missing or unrecognised `status` resolves
 * to `pending` — an agent patch is never treated as owner-approved unless the
 * file literally says `approved`. Missing frontmatter or sections yield empty
 * strings rather than throwing.
 *
 * @param md - raw markdown (or null/undefined for a missing file).
 */
export function parseProposal(md: string | null | undefined): Proposal {
  const proposal: Proposal = {
    agent: '',
    date: '',
    status: 'pending',
    change: '',
    diff: '',
    why: '',
  }
  if (!md) return proposal

  const fm = findFrontmatter(md)
  if (fm) {
    for (const line of fm.body.split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/)
      if (!kv) continue
      const key = kv[1]!
      const value = stripInlineComment(kv[2] ?? '')
      if (key === 'agent') proposal.agent = value
      else if (key === 'date') proposal.date = value
      else if (key === 'status') {
        // Invalid / unknown status → keep the safe 'pending' default (DoD #3).
        if ((VALID_STATUSES as readonly string[]).includes(value)) {
          proposal.status = value as ProposalStatus
        }
      }
    }
  }

  // Body sections live after the frontmatter (if any).
  const body = fm ? md.slice(fm.bodyEnd) : md
  const report = parseReport(body)
  proposal.change = report.sections['Change'] ?? ''
  proposal.diff = report.sections['Diff'] ?? ''
  proposal.why = report.sections['Why'] ?? ''

  return proposal
}

/**
 * Flip a proposal's status line, byte-preserving everything else (DoD #2).
 *
 * This is a surgical text transform, NOT a parse-and-re-serialize: it replaces
 * only the status *value* token inside the frontmatter and leaves every other
 * byte — including the status line's own leading whitespace and any trailing
 * ` # pending | approved | rejected` comment — exactly as it was. The result
 * therefore differs from the input on that single line and nowhere else.
 *
 * Defensive: no frontmatter, or no `status:` line within it, is a no-op that
 * returns the input unchanged.
 *
 * @param md     - raw proposal markdown.
 * @param status - the new status to write.
 */
export function setProposalStatus(md: string, status: ProposalStatus): string {
  const fm = findFrontmatter(md)
  if (!fm) return md

  // Replace ONLY the value: `(status:  )(pending)(<rest incl. comment>)`.
  const newBody = fm.body.replace(
    /^([ \t]*status:[ \t]*)(\S+)([^\r\n]*)$/m,
    (_full, pre: string, _val: string, post: string) => `${pre}${status}${post}`,
  )
  if (newBody === fm.body) return md // no status line → nothing to flip

  return md.slice(0, fm.bodyStart) + newBody + md.slice(fm.bodyEnd)
}
