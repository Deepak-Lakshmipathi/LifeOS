import type { ReactNode } from 'react'
import { Card } from '../glass/Card'
import { parseReport } from '../../vault/supervisor'

/**
 * SupervisorCard — the weekly supervisor report card (DESIGN_LANGUAGE §4.8,
 * mounted below the fleet table per §5 "Agents: fleet table card, then
 * supervisor report card").
 *
 * Purple-tinted like the §6 Day Review card, but its own literal per §4.8:
 * `border-color:rgba(167,139,250,.35)`, `background:rgba(167,139,250,.06)`.
 * Reuses the shared `Card` base (same className-override idiom as
 * `DayReview.tsx`) rather than inventing a second card shell.
 *
 * Takes the raw weekly-report markdown and parses it itself via the S52
 * `parseReport` — the Write-set names that parser directly (unlike the
 * already-parsed-prop convention of AgentsView/CareerView), and `parseReport`
 * is a pure, cheap, single-artifact parse, so there is no separate "parsed
 * shape" prop to thread through App.tsx yet.
 *
 * Scope is deliberately narrow (S53 Build-set): only the three named
 * sections render — Fleet week, Concerns, and a Proposals *count* — not
 * every H2 the parser preserves (an unrecognised section like "Notes" is
 * parsed but not shown here). Proposal links are a count/pointer only; the
 * approve/reject UI is S54 and does not belong in this diff.
 */

export interface SupervisorCardProps {
  /** Raw weekly report markdown (S52 file contract); null/undefined → empty state. */
  reportMd?: string | null
}

/** Matches a numeric "metric" token inside prose: `168`, `8.1`, `14/15`, `92%`. */
const METRIC_RE = /\d+(?:[.,/]\d+)*%?/g

/**
 * Split prose into text + highlighted-metric spans (§4.8: "metrics inline as
 * `#c4b5fd` 600"). `#c4b5fd` has no dedicated token — it's the same literal
 * already used verbatim elsewhere in this exact tree (AgentsView's GH ACTIONS
 * infra badge, CoursesCard's `#a5b4fc` next-lesson pointer), copied from the
 * design spec rather than invented here.
 */
function highlightMetrics(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let i = 0
  for (const match of text.matchAll(METRIC_RE)) {
    const index = match.index ?? 0
    if (index > lastIndex) parts.push(text.slice(lastIndex, index))
    parts.push(
      <span key={`${keyPrefix}-m${i++}`} data-testid="supervisor-metric" className="font-semibold text-[#c4b5fd]">
        {match[0]}
      </span>,
    )
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

/** A rendered section's bullet lines, each with inline metric highlighting. */
function SupervisorSection({ heading, body }: { heading: string; body: string }) {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)

  return (
    <div data-testid="supervisor-section" data-heading={heading}>
      <div className="mb-1.5 text-[11px] uppercase tracking-[.1em] text-faint">{heading}</div>
      <ul className="flex flex-col gap-1 text-[13.5px] leading-[1.55] text-txt">
        {lines.map((line, i) => (
          <li key={i}>{highlightMetrics(line.replace(/^-\s*/, ''), `${heading}-${i}`)}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Proposals render as a count/pointer only (DoD #3) — each `- [[...]]` list
 * item is one proposal; the approve/reject UI is S54, not this slice.
 */
function ProposalsSummary({ body }: { body?: string }) {
  if (body == null) return null
  const count = body.split('\n').filter((l) => /^\s*-\s+/.test(l)).length

  return (
    <div data-testid="supervisor-proposals" className="text-[13.5px] leading-[1.55] text-txt">
      <span data-testid="supervisor-metric" className="font-semibold text-[#c4b5fd]">
        {count}
      </span>{' '}
      proposal{count === 1 ? '' : 's'} awaiting review
    </div>
  )
}

export function SupervisorCard({ reportMd = null }: SupervisorCardProps) {
  const report = parseReport(reportMd)
  const hasReport = Object.keys(report.sections).length > 0

  return (
    <Card
      heading="Supervisor"
      data-testid="supervisor-card"
      className="[border-color:rgba(167,139,250,.35)] [background:rgba(167,139,250,.06)]"
    >
      {!hasReport ? (
        <p data-testid="supervisor-empty" className="text-[13.5px] leading-[1.55] text-dim">
          No supervisor report yet
        </p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {report.sections['Fleet week'] != null && (
            <SupervisorSection heading="Fleet week" body={report.sections['Fleet week']} />
          )}
          {report.sections['Concerns'] != null && (
            <SupervisorSection heading="Concerns" body={report.sections['Concerns']} />
          )}
          <ProposalsSummary body={report.sections['Proposals']} />
        </div>
      )}
    </Card>
  )
}
