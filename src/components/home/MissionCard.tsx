import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { Task } from '../../types'
import { isDomain } from '../../data/domains'
import type { Domain } from '../../data/domains'
import { computeWarmth } from '../../warmth/computeWarmth'
import { missionPicks } from '../../lib/missionPicks'
import type { MissionPick } from '../../lib/missionPicks'
import { Card } from '../glass/Card'
import { Chip } from '../glass/Chip'

/**
 * MissionCard — "Today's Mission" (DESIGN_LANGUAGE §4.3, §8, Slice S27).
 *
 * Composes the shipped ranking seams (rankNow + computeWarmth, via the pure
 * `missionPicks` selector) into 1–3 mission-task rows with why + done_when
 * always visible — never behind a hover or expander (§8). A veto affordance
 * lets the user dismiss a pick for the session; the next-ranked task
 * backfills. The dot toggle is visual-only here — S28 wires it to the
 * existing complete mutation.
 */

// Canonical domain → design token CSS var (§2.1), mirrored from VitalsRow's
// own DOMAIN_VAR (that file is a hotspot this slice must not touch — the
// mapping is a small literal table, copied verbatim rather than shared).
const DOMAIN_VAR: Record<Domain, string> = {
  'Building Things': 'var(--d-build)',
  Career: 'var(--d-career)',
  Growth: 'var(--d-growth)',
  'Life Admin': 'var(--d-admin)',
  'Body & Mind': 'var(--d-body)',
  Finance: 'var(--d-fin)',
  Relationship: 'var(--d-rel)',
}

/** Honest placeholder for a mission task with no done_when set (§8: no fake-real data). */
const NO_DONE_WHEN = 'Not set'

export interface MissionCardProps {
  /** Full task list (open + done); passed straight through to missionPicks/rankNow. */
  tasks: Task[]
  /** Current time in ms — inject for deterministic tests (defaults to Date.now()). */
  now?: number
}

export function MissionCard({ tasks, now }: MissionCardProps) {
  const [vetoed, setVetoed] = useState<Set<string>>(new Set())

  const warmth = computeWarmth(tasks, now ?? Date.now())
  const { picks } = missionPicks(tasks, warmth, vetoed)

  const handleVeto = (id: string) => {
    setVetoed((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  return (
    <Card heading="Today's Mission">
      {picks.length === 0 ? (
        <p className="text-[13px] text-dim">Nothing needs you right now.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {picks.map((pick) => (
            <MissionTaskRow key={pick.task.id} pick={pick} onVeto={handleVeto} />
          ))}
        </div>
      )}
    </Card>
  )
}

interface MissionTaskRowProps {
  pick: MissionPick
  onVeto: (id: string) => void
}

/**
 * A single mission task row per §4.3 anatomy: dot → title → chips, then
 * `why`, then `done_when`. Domain color arrives via `--dc` set inline; the
 * 3px domain stripe is a `before:` pseudo-element (same arbitrary-value
 * technique Card.tsx uses for its cursor spotlight — no new stylesheet rule).
 */
function MissionTaskRow({ pick, onVeto }: MissionTaskRowProps) {
  const { task, rescue, why } = pick
  const domain = task.domain && isDomain(task.domain) ? (task.domain as Domain) : null
  const dc = domain ? DOMAIN_VAR[domain] : undefined
  const style = dc ? ({ '--dc': dc } as CSSProperties) : undefined

  return (
    <div
      data-testid="mission-task"
      data-rescue={rescue}
      style={style}
      className={[
        'relative rounded-[14px] py-[13px] pr-[15px] pl-[18px] transition',
        'bg-[rgba(255,255,255,.04)] border border-[rgba(255,255,255,.07)]',
        dc &&
          "before:content-[''] before:absolute before:left-0 before:top-[10px] before:bottom-[10px] before:w-[3px] before:rounded-[2px] before:bg-[var(--dc)]",
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="dot mt-[3px] h-[18px] w-[18px] flex-shrink-0 rounded-full border-2"
          style={{ borderColor: dc ?? 'var(--faint)' }}
        />
        <div className="min-w-0 flex-1">
          <span className="text-[15px] leading-snug text-txt">{task.title}</span>{' '}
          {domain && (
            <Chip variant="dom" dc={dc}>
              {domain}
            </Chip>
          )}{' '}
          {task.priority === 3 && <Chip variant="p3">High</Chip>}
          {task.priority === 2 && <Chip variant="p2">Med</Chip>}{' '}
          {rescue && <Chip variant="rescue">coldest-domain rescue</Chip>}
        </div>
        <button
          type="button"
          onClick={() => onVeto(task.id)}
          aria-label={`Dismiss ${task.title}`}
          className="flex-shrink-0 rounded p-0.5 text-faint transition hover:text-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-txt"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* why + done_when — always visible, never behind a hover/expander (§8). */}
      <div className="why ml-[26px] mt-[5px] text-[12.5px] text-dim">{why}</div>
      <div className="dw ml-[26px] mt-[3px] text-[12.5px] text-txt">
        <b className="mr-[5px] text-[11px] font-semibold uppercase tracking-[.08em] text-faint">
          Done when
        </b>
        {task.done_when || NO_DONE_WHEN}
      </div>
    </div>
  )
}
