import { useEffect, useState } from 'react'
import { LocalOnly } from '../../sync/LocalOnly'
import { VaultSync } from '../../sync/VaultSync'
import type { SyncProvider } from '../../sync/SyncProvider'
import type { Task } from '../../types'
import { DOMAINS } from '../../data/domains'
import type { Domain } from '../../data/domains'
import { computeWarmth } from '../../warmth/computeWarmth'
import type { WarmthState } from '../../warmth/computeWarmth'
import { Vital } from '../glass/Vital'
import { formatINR } from '../../vault/finance'
import type { NetworthPoint, BurnMonth } from '../../vault/finance'
import type { JobEntry } from '../../vault/career'
import { netWorthVital, burnVital, pipelineVital } from '../../lib/vitalsData'

/**
 * VitalsRow — the Glass Cockpit Life Vitals strip (DESIGN_LANGUAGE §4.2 / §5):
 * an auto-fit grid of 5 tiles in the fixed order
 *   Warmth · Net worth · Burn/income · Pipeline · Streak.
 *
 * S26 (this slice) fills the S24 stub. Only Warmth is real — its 7-bar strip
 * variant is derived live from `computeWarmth` over the loaded task list. The
 * other four are honest placeholders (value `—`, no fake-real numbers); S41
 * (money → Net worth, Burn) and S45 (pipeline → Pipeline) wire them to vault
 * data later, and S30 (habits) feeds Streak. This file is the head of the
 * VitalsRow chain — those slices extend THIS file, not App.tsx.
 *
 * App.tsx mounts `<VitalsRow />` with no props (it never edits this mount
 * point again), so the component sources its own task list through the same
 * provider seam App uses. Tests inject `tasks` + `now` directly, which short-
 * circuits the load — the provider is never touched under test.
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
// both read the same store App does, so warmth here matches the rest of the app.
const provider: SyncProvider =
  import.meta.env.VITE_VAULT === '1' ? new VaultSync() : new LocalOnly()

/**
 * WarmthState → bar opacity. §4.2: "opacity = warmth (hot ≈ .9 → cold ≈ .2)".
 * Evenly spread across the 5 states so hotter domains read brighter and cold
 * domains genuinely look cold (§8 Do: "let cold domains look cold").
 */
export const WARMTH_OPACITY: Record<WarmthState, number> = {
  hot: 0.9,
  warm: 0.725,
  ok: 0.55,
  stale: 0.375,
  cold: 0.2,
}

/**
 * Canonical domain → design token CSS var (§2.1). Uses the LOCKED --d-* tokens
 * from tokens.css, NOT the legacy DOMAIN_COLORS palette (which predates the
 * Glass Cockpit contract).
 */
const DOMAIN_VAR: Record<Domain, string> = {
  'Building Things': 'var(--d-build)',
  Career: 'var(--d-career)',
  Growth: 'var(--d-growth)',
  'Life Admin': 'var(--d-admin)',
  'Body & Mind': 'var(--d-body)',
  Finance: 'var(--d-fin)',
  Relationship: 'var(--d-rel)',
}

export interface VitalsRowProps {
  /** Loaded task list. Omit in-app (component self-loads); inject in tests. */
  tasks?: Task[]
  /** Current time in ms — inject for deterministic tests. */
  now?: number
  /** Net-worth series, ascending by date (`parseNetworthHistory` output). */
  networth?: NetworthPoint[]
  /** Income/spend per month, ascending (`parseBurn` output). */
  burn?: BurnMonth[]
  /** Job-pipeline entries (`parsePipeline` output). */
  pipeline?: JobEntry[]
}

/**
 * Warmth strip variant (§4.2): the `.k` label over 7 flex bars, one per domain
 * in canonical order, each tinted its domain token at an opacity derived from
 * warmth. Bars carry a `title` so warmth is legible without relying on color
 * alone (§8 Do: "encode state in form + color"). The tile chrome matches the
 * glass `Vital` panel exactly.
 */
function WarmthTile({ warmth }: { warmth: Record<Domain, WarmthState> }) {
  return (
    <div
      className="bg-panel border border-panel-brd rounded-tile backdrop-blur-tile px-[14px] py-3"
      data-testid="vital-tile"
      data-vital="warmth"
    >
      <div className="k text-[11px] uppercase tracking-[.09em] text-faint">Warmth</div>
      <div className="mt-2 flex gap-1" role="img" aria-label="Domain warmth">
        {DOMAINS.map((domain) => {
          const state = warmth[domain]
          return (
            <i
              key={domain}
              data-testid="warmth-bar"
              data-domain={domain}
              data-warmth={state}
              title={`${domain}: ${state}`}
              className="h-1.5 flex-1 rounded-[3px]"
              style={{ backgroundColor: DOMAIN_VAR[domain], opacity: WARMTH_OPACITY[state] }}
            />
          )
        })}
      </div>
    </div>
  )
}

export function VitalsRow({
  tasks: tasksProp,
  now,
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
        // Warmth is non-critical chrome — a failed read just leaves every
        // domain cold rather than surfacing an error in the vitals strip.
      })
    return () => {
      live = false
    }
  }, [tasksProp])

  const warmth = computeWarmth(tasks, now ?? Date.now())
  const netWorth = netWorthVital(networth)
  const burnTile = burnVital(burn)
  const pipelineTile = pipelineVital(pipeline)

  return (
    <div
      aria-label="Life vitals"
      className="vitals mb-[14px] grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]"
    >
      <WarmthTile warmth={warmth} />
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
