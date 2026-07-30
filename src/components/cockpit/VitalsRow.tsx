import { useEffect, useState } from 'react'
import { LocalOnly } from '../../sync/LocalOnly'
import { VaultSync } from '../../sync/VaultSync'
import type { SyncProvider } from '../../sync/SyncProvider'
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
 * App.tsx mounts `<VitalsRow />` with no props (it never edits this mount
 * point again), so the component sources its own task list through the same
 * provider seam App uses — Completion needs the same loaded task list
 * Warmth used to. Tests inject `tasks` directly, which short-circuits the
 * load — the provider is never touched under test.
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

// Mirrors App.tsx's provider selection (ADR-0002 seam). LocalOnly and VaultSync
// both read the same store App does, so Completion here matches the rest of
// the app.
const provider: SyncProvider =
  import.meta.env.VITE_VAULT === '1' ? new VaultSync() : new LocalOnly()

export interface VitalsRowProps {
  /** Loaded task list. Omit in-app (component self-loads); inject in tests. */
  tasks?: Task[]
  /** Net-worth series, ascending by date (`parseNetworthHistory` output). */
  networth?: NetworthPoint[]
  /** Income/spend per month, ascending (`parseBurn` output). */
  burn?: BurnMonth[]
  /** Job-pipeline entries (`parsePipeline` output). */
  pipeline?: JobEntry[]
}

export function VitalsRow({
  tasks: tasksProp,
  networth = [],
  burn = [],
  pipeline = [],
}: VitalsRowProps = {}) {
  const [loaded, setLoaded] = useState<Task[]>([])
  const tasks = tasksProp ?? loaded

  useEffect(() => {
    // Tests inject tasks; skip the async load entirely so the provider (and
    // its Dexie/vault I/O) is never reached under test.
    if (tasksProp) return
    let live = true
    provider
      .list()
      .then((all) => {
        if (live) setLoaded(all)
      })
      .catch(() => {
        // Completion is non-critical chrome — a failed read just leaves the
        // tile at the honest no-data stub rather than surfacing an error.
      })
    return () => {
      live = false
    }
  }, [tasksProp])

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
