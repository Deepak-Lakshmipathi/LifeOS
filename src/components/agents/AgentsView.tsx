import { motion, useReducedMotion } from 'framer-motion'
import { Card } from '../glass/Card'
import { agentManifest, type AgentSpec, type Infra } from '../../data/agentManifest'
import { healthOf, type AgentStatus, type Health } from '../../vault/agentStatus'

/**
 * AgentsView — Agents tab: the fleet table (DESIGN_LANGUAGE §4.8, LED §4.7).
 *
 * Head of the AgentsView chain (S49 → S53/S54). S49 fills the stub with the
 * fleet table only; the supervisor report card (§4.8 bottom) lands downstream.
 *
 * Purely presentational, like MoneyView (S40): it takes already-parsed S47
 * `AgentStatus` shapes keyed by agent name and does no fetching/parsing itself.
 * App.tsx mounts `<AgentsView />` with no props, so `statuses` defaults to `{}`
 * → every agent renders idle (honest "never run" rather than fabricated green)
 * until a later slice wires live status through.
 */

export interface AgentsViewProps {
  /** Live run status per agent name (S47 `parseStatus` output); missing → idle. */
  statuses?: Record<string, AgentStatus | null>
  /** Injected "now" (ms since epoch) for deterministic health in tests. */
  now?: number
}

/** §4.8 row grid — verbatim from the design: `14px 1.4fr 1fr 1fr 1.6fr`. */
const ROW_GRID =
  'grid grid-cols-[14px_1.4fr_1fr_1fr_1.6fr] items-center gap-3 px-1.5 py-3 ' +
  'border-b border-white/5 last:border-b-0'

export function AgentsView({ statuses = {}, now = Date.now() }: AgentsViewProps) {
  const prefersReducedMotion = useReducedMotion() ?? false

  return (
    <Card heading="Fleet" count={agentManifest.length}>
      <div data-testid="fleet-table" role="table">
        {agentManifest.map((agent) => {
          const status = statuses[agent.name] ?? null
          const health = healthOf(status, now)
          return (
            <AgentRow
              key={agent.name}
              agent={agent}
              status={status}
              health={health}
              reducedMotion={prefersReducedMotion}
            />
          )
        })}
      </div>
    </Card>
  )
}

interface AgentRowProps {
  agent: AgentSpec
  status: AgentStatus | null
  health: Health
  reducedMotion: boolean
}

function AgentRow({ agent, status, health, reducedMotion }: AgentRowProps) {
  // §4.8: error notes render red — an *error* note is a failed run's note,
  // not merely a stale-but-ok row (whose note is a successful summary).
  const noteError = status != null && !status.ok
  const noteText = status ? (status.note ?? '—') : 'idle · never run'
  const lastRun = status ? formatLastRun(status.last_run) : '—'

  return (
    <div className={ROW_GRID} role="row" data-testid="agent-row" data-agent={agent.name}>
      <Led health={health} reducedMotion={reducedMotion} />

      <div className="min-w-0" role="cell">
        <div className="truncate text-[13px] font-semibold text-txt">{agent.name}</div>
        <div className="truncate text-[12.5px] text-dim">{agent.purpose}</div>
      </div>

      <div role="cell">
        <InfraBadge infra={agent.infra} cadence={agent.cadence} />
      </div>

      <div className="text-[12.5px] tabular-nums text-dim" role="cell">
        {lastRun}
      </div>

      <div
        role="cell"
        data-testid="agent-note"
        className={`truncate text-[12.5px] ${noteError ? 'text-[#fca5a5]' : 'text-dim'}`}
      >
        {noteText}
      </div>
    </div>
  )
}

/** §4.7 LED classes — token colors + the design's verbatim 8px glow. */
const LED_BASE = 'block h-2 w-2 rounded-full'
const LED_CLASS: Record<Health, string> = {
  ok: 'bg-good shadow-[0_0_8px_theme(colors.good)]',
  amber: 'bg-warn shadow-[0_0_8px_theme(colors.warn)]',
  red: 'bg-bad shadow-[0_0_8px_theme(colors.bad)]',
  idle: 'bg-faint', // no glow (§4.7)
}

function Led({ health, reducedMotion }: { health: Health; reducedMotion: boolean }) {
  const cls = `${LED_BASE} ${LED_CLASS[health]}`

  // §4.7: only failures animate — a red LED blinks (opacity dips to .35 over
  // 1.2s). `useReducedMotion()` gates it: reduced motion → a steady red dot.
  if (health === 'red' && !reducedMotion) {
    return (
      <motion.span
        role="status"
        data-testid="agent-led"
        data-health={health}
        data-animate="blink"
        className={cls}
        animate={{ opacity: [1, 0.35, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      />
    )
  }

  return (
    <span
      role="status"
      data-testid="agent-led"
      data-health={health}
      data-animate="none"
      className={cls}
    />
  )
}

/** §4.8 infra badge tints — verbatim rgba/hex from the design spec. */
const INFRA_BADGE: Record<Infra, { label: string; className: string }> = {
  gha: { label: 'GH ACTIONS', className: 'bg-[rgba(167,139,250,.15)] text-[#c4b5fd]' },
  pc: { label: 'THIS PC', className: 'bg-[rgba(251,191,36,.13)] text-[#fcd34d]' },
  vps: { label: 'VPS', className: 'bg-[rgba(74,222,128,.13)] text-[#86efac]' },
}

function InfraBadge({ infra, cadence }: { infra: Infra; cadence: string }) {
  const { label, className } = INFRA_BADGE[infra]
  return (
    <span
      data-testid="infra-badge"
      data-infra={infra}
      className={`inline-block rounded-full px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[.05em] ${className}`}
    >
      {label} · {cadence}
    </span>
  )
}

/**
 * Format an ISO timestamp for the "last run" column — deterministic and
 * timezone-free (string-sliced, never `Date`-formatted): `2026-07-14 09:30`.
 * Falls back to the raw string if it isn't the expected ISO shape.
 */
function formatLastRun(iso: string): string {
  const t = iso.indexOf('T')
  if (t === -1) return iso
  return `${iso.slice(0, t)} ${iso.slice(t + 1, t + 6)}`
}
