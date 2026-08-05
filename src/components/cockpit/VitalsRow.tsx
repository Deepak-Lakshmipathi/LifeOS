import type { Task } from '../../types'
import { Vital } from '../glass/Vital'
import { formatINR } from '../../vault/finance'
import type { NetworthPoint, BurnMonth } from '../../vault/finance'
import type { JobEntry } from '../../vault/career'
import { netWorthVital, burnVital, pipelineVital, completionVital } from '../../lib/vitalsData'

/**
 * VitalsRow — the Glass Cockpit Life Vitals strip (DESIGN_LANGUAGE §4.2 / §5):
 * an auto-fit grid of 5 tiles in the fixed order
 *   Completion · Net worth · Burn/income · Pipeline · Streak.
 *
 * S26 originally filled the S24 stub with Warmth as the first vital. S60
 * (owner feedback items 3+4) retires that tile: warmth doesn't disappear, it
 * moves to the Aurora background tint (`src/lib/warmthTint.ts` +
 * `src/components/glass/Aurora.tsx`), and Completion — a pure percent/count
 * selector — takes the vacated first slot. Net worth, Burn/income, and
 * Pipeline are unchanged by this move.
 *
 * #186: VitalsRow used to self-load its own task list through the memoized
 * `selfLoadTasks` module. That module had no production invalidation path,
 * so Completion froze at the first read for the life of the page — a write
 * through `useTasks` could never reach a cache it did not own. The list now
 * has ONE owner (`useTasks` in `App.tsx`) and arrives as a required prop, so
 * a completed task re-renders this tile like any other consumer. Same shape
 * ADR-0016 applied to the vault transport.
 *
 * S41 fills the Net worth + Burn/income tiles from S39 finance-parser
 * output, passed in as the `networth`/`burn` props. VitalsRow does no
 * fetching/parsing of its own for money data (mirrors MoneyView's S40
 * precedent) — both default to `[]`, which the `vitalsData` selectors read
 * as "no data" and render as the same honest `—` stub S26 shipped. S42's
 * finance-sync agent wires the live vault reads through later.
 *
 * S45 fills the Pipeline tile the same way, from S43's `parsePipeline`
 * (`Career/pipeline.md`) output passed in as the `pipeline` prop — default
 * `[]`, read by `pipelineVital` as "no data" → the same `—` stub.
 */

export interface VitalsRowProps {
  /** Loaded task list — owned by `useTasks` in App.tsx (#186). */
  tasks: Task[]
  /** Net-worth series, ascending by date (`parseNetworthHistory` output). */
  networth?: NetworthPoint[]
  /** Income/spend per month, ascending (`parseBurn` output). */
  burn?: BurnMonth[]
  /** Job-pipeline entries (`parsePipeline` output). */
  pipeline?: JobEntry[]
}

export function VitalsRow({ tasks, networth = [], burn = [], pipeline = [] }: VitalsRowProps) {
  const completion = completionVital(tasks)
  const netWorth = netWorthVital(networth)
  const burnTile = burnVital(burn)
  const pipelineTile = pipelineVital(pipeline)

  return (
    <div
      aria-label="Life vitals"
      className="vitals mb-[14px] grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]"
    >
      {/* Completion (S60, first vital — replaces Warmth): % of tasks done +
          raw counts. `value === null` (empty vault) falls back to the same
          honest `—` placeholder every other stub tile uses (§8: no
          fake-real data — 0/0 is not 100%). */}
      {completion.value != null ? (
        <Vital
          k="Completion"
          value={completion.value}
          format={(v) => `${Math.round(v)}%`}
          sub={completion.sub}
        />
      ) : (
        <Vital k="Completion" value={0} format={() => '—'} sub={completion.sub} />
      )}
      {/* Net worth / Burn (S41): real values once `networth`/`burn` fixtures
          are injected; `value === null` (no data) falls back to the same
          honest `—` placeholder S26 shipped (§8: no fake-real data). */}
      {netWorth.value != null ? (
        <Vital
          k="Net worth"
          value={netWorth.value}
          format={formatINR}
          sub={netWorth.sub}
          subDirection={netWorth.dir}
        />
      ) : (
        <Vital k="Net worth" value={0} format={() => '—'} sub={netWorth.sub} />
      )}
      {burnTile.value != null ? (
        <Vital
          k="Burn / income"
          value={burnTile.value}
          format={formatINR}
          sub={burnTile.sub}
          subDirection={burnTile.dir}
        />
      ) : (
        <Vital k="Burn / income" value={0} format={() => '—'} sub={burnTile.sub} />
      )}
      {/* Pipeline (S45): real value once `pipeline` fixture is injected;
          `value === null` (no data) falls back to the same honest `—`
          placeholder S26 shipped (§8: no fake-real data). */}
      {pipelineTile.value != null ? (
        <Vital
          k="Pipeline"
          value={pipelineTile.value}
          format={(v) => String(Math.round(v))}
          sub={pipelineTile.sub}
        />
      ) : (
        <Vital k="Pipeline" value={0} format={() => '—'} sub={pipelineTile.sub} />
      )}
      {/* Stub tile — honest placeholder (§8: no fake-real data). value `—`
          via the glass Vital so the count-up + reduced-motion path stays live;
          sub names the slice that will wire it. */}
      <Vital k="Streak" value={0} format={() => '—'} sub="wires in S30" />
    </div>
  )
}
