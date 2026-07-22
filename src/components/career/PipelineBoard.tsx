import { STAGES, groupByStage, type JobEntry, type Stage } from '../../vault/career'

/**
 * PipelineBoard — the Career job-pipeline kanban (DESIGN_LANGUAGE §4.10).
 *
 * Four columns in fixed canonical order (Found · Applied · Interview · Closed),
 * collapsing to 2 columns ≤840px (§4.10 / §5). Every stage column is always
 * rendered — an empty stage shows an empty column, never a missing one
 * (DoD #1) — because `groupByStage` always carries all four keys.
 *
 * Every visual literal below is copied verbatim from §4.10 / §2.1, not
 * invented: column fill `rgba(255,255,255,.03)` + border `rgba(255,255,255,.06)`
 * radius 14px (`rounded-tile`) pad 12px; job card `rgba(255,255,255,.05)`
 * radius 10px pad `9px 11px`; hot border `rgba(56,189,248,.4)` (the §2.1
 * `--d-career` hue `#38bdf8` at .4 alpha — same verbatim-literal precedent as
 * BarMeter's `#22d3ee`); closed cards `opacity:.55`. No fetching, purely
 * presentational over already-parsed S43 shapes.
 */

/** Column header labels, keyed by stage (uppercased via CSS per §4.10). */
const STAGE_LABEL: Record<Stage, string> = {
  found: 'Found',
  applied: 'Applied',
  interview: 'Interview',
  closed: 'Closed',
}

export interface PipelineBoardProps {
  /** Parsed pipeline entries (`parsePipeline` output); empty renders 4 empty columns. */
  jobs?: JobEntry[]
}

/**
 * Build the §4.10 sub-line: source (provenance, §8) · match % · age · next step,
 * with a ⚡ lead for urgent cards. Only present fields appear.
 */
function subParts(job: JobEntry): string[] {
  const parts: string[] = []
  if (job.hot) parts.push('⚡')
  if (job.match) parts.push(job.match)
  if (job.age) parts.push(job.age)
  // §8: machine-produced rows show provenance — never anonymous facts.
  if (job.source) parts.push(`via ${job.source}`)
  if (job.next) parts.push(job.next)
  if (job.outcome) parts.push(job.outcome)
  return parts
}

function JobCard({ job }: { job: JobEntry }) {
  const closed = job.stage === 'closed'

  return (
    <div
      data-testid="job-card"
      data-stage={job.stage}
      data-hot={job.hot ? 'true' : 'false'}
      data-closed={closed ? 'true' : 'false'}
      data-source={job.source ?? ''}
      className={[
        'rounded-[10px] bg-[rgba(255,255,255,.05)] px-[11px] py-[9px]',
        'border',
        job.hot ? 'border-[rgba(56,189,248,.4)]' : 'border-transparent',
        closed ? 'opacity-[.55]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="text-[13px] text-txt">
        {job.company}
        {job.role ? <span className="text-dim"> — {job.role}</span> : null}
      </div>
      {(() => {
        const parts = subParts(job)
        return parts.length > 0 ? (
          <div data-testid="job-card-sub" className="mt-0.5 text-[11.5px] text-dim">
            {parts.join(' · ')}
          </div>
        ) : null
      })()}
    </div>
  )
}

export function PipelineBoard({ jobs = [] }: PipelineBoardProps) {
  const groups = groupByStage(jobs)

  return (
    <div
      data-testid="pipeline-board"
      className="grid grid-cols-2 gap-2.5 [@media(min-width:841px)]:grid-cols-4"
    >
      {STAGES.map((stage) => {
        const column = groups[stage]
        return (
          <div
            key={stage}
            data-testid="pipeline-col"
            data-stage={stage}
            className="rounded-tile border border-[rgba(255,255,255,.06)] bg-[rgba(255,255,255,.03)] p-3"
          >
            <div className="mb-2.5 flex items-center justify-between text-[11px] uppercase tracking-[.1em] text-faint">
              <span>{STAGE_LABEL[stage]}</span>
              <span data-testid="pipeline-col-count" className="tabular-nums">
                {column.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {column.map((job, i) => (
                <JobCard key={`${job.company}-${job.role}-${i}`} job={job} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
