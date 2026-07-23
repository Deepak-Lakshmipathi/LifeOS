import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { agentManifest, type AgentSpec } from '../../data/agentManifest'
import { healthOf, parseStatus, type AgentStatus, type Health } from '../../vault/agentStatus'
import { GitTransport, type VaultTransport } from '../../vault/transport'

/**
 * FleetStrip — the Home right-stack Fleet mini strip (DESIGN_LANGUAGE §4.7,
 * §5 "Right stack: Today (calendar), Habits, Fleet mini-strip", Slice S48).
 * One §4.7 mini pill per `agentManifest` agent: LED (ok/amber/red/idle via
 * S47's `healthOf`) + agent name + relative last-run ("12m ago"), in a
 * `999px` pill. Only a red LED blinks (§7) — health/staleness math is 100%
 * S47's; this file only renders it, never recomputes a threshold.
 *
 * Mirrors AttentionCard/TodayCard/HabitsCard's "head of chain" convention:
 * HomeView mounts this with no data props in the live app, so the component
 * self-loads via the transport seam; `statuses` exists purely to short-
 * circuit that fetch under test, so fixture rendering never touches
 * GitTransport (or its IndexedDB/network side effects). Reads
 * `agents/<name>/status.json` per manifest entry — the same file contract
 * S47's `parseStatus`/AgentsView's live wiring already reads. Note:
 * `GitTransport.readFiles()` does not yet walk an `agents/` folder (it only
 * walks the 7 domain folders + Inbox/Habits/Calendar), so the live self-load
 * always resolves to idle for now until a later slice extends the transport
 * — the same class of gap Calendar/ had before S34/#151. Out of this
 * slice's write-set to fix.
 *
 * AttentionCard's self-load has a fast honest-empty short-circuit for the
 * unconfigured-vault case (skip straight to empty rather than paying for
 * isomorphic-git's dynamic import just to land on the same empty result) —
 * mirrored verbatim here (open follow-up #155 tracks moving this check to
 * the seam itself) so this mount doesn't regress cockpitShell.test.tsx's
 * render budget.
 */

/** Default cadence used only for the missing-status idle case — no health math lives here. */
const NEVER_RAN = 'never ran'

export interface FleetStripProps {
  /** Live run status per agent name (S47 `parseStatus` output). Omit in-app (self-loads via `transport`); inject in tests. */
  statuses?: Record<string, AgentStatus | null>
  /** Read seam. Defaults to a fresh GitTransport. */
  transport?: VaultTransport
  /** Injected "now" (ms since epoch) for deterministic health + relative-time in tests. Defaults to Date.now(). */
  now?: number
}

export function FleetStrip({ statuses: statusesProp, transport, now }: FleetStripProps = {}) {
  const [loadedStatuses, setLoadedStatuses] = useState<Record<string, AgentStatus | null>>({})
  const prefersReducedMotion = useReducedMotion() ?? false
  const nowMs = now ?? Date.now()

  // Self-load from the vault when the caller didn't inject fixture data —
  // the AttentionCard/TodayCard/HabitsCard "head of chain" convention: tests
  // short-circuit this by passing `statuses` (skips the effect entirely, so
  // GitTransport is never constructed under test).
  useEffect(() => {
    if (statusesProp !== undefined) return
    // Fast honest-empty path (mirrors AttentionCard verbatim): with no
    // configured vault remote, a default GitTransport always rejects — but
    // only AFTER paying for isomorphic-git's dynamic import. Skip straight
    // to the idle state when unconfigured and no caller-supplied transport
    // is present.
    if (!transport && !import.meta.env.VITE_VAULT_REPO_URL) return
    let live = true
    ;(async () => {
      try {
        const t = transport ?? new GitTransport()
        const files = await t.readFiles()
        if (!live) return
        const next: Record<string, AgentStatus | null> = {}
        for (const agent of agentManifest) {
          const raw = files.find((f) => f.path === `agents/${agent.name}/status.json`)?.content ?? null
          next[agent.name] = parseStatus(raw)
        }
        setLoadedStatuses(next)
      } catch {
        // No vault configured / offline — render the honest idle state (§8: no fake-real data).
      }
    })()
    return () => {
      live = false
    }
  }, [statusesProp, transport])

  const statuses = statusesProp ?? loadedStatuses

  return (
    <div data-testid="fleet-strip" className="flex flex-wrap gap-2">
      {agentManifest.map((agent) => {
        const status = statuses[agent.name] ?? null
        const health = healthOf(status, nowMs)
        return (
          <FleetPill
            key={agent.name}
            agent={agent}
            status={status}
            health={health}
            now={nowMs}
            reducedMotion={prefersReducedMotion}
          />
        )
      })}
    </div>
  )
}

interface FleetPillProps {
  agent: AgentSpec
  status: AgentStatus | null
  health: Health
  now: number
  reducedMotion: boolean
}

/** A single §4.7 mini pill: LED + `agent-name last-run`, 999px, `rgba(255,255,255,.04)` fill, 12.5px `--dim`. */
function FleetPill({ agent, status, health, now, reducedMotion }: FleetPillProps) {
  const lastRun = status ? relativeLastRun(status.last_run, now) : NEVER_RAN

  return (
    <div
      data-testid="fleet-pill"
      data-agent={agent.name}
      data-health={health}
      className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,255,255,.04)] px-3 py-1.5"
    >
      <Led health={health} reducedMotion={reducedMotion} />
      <span className="text-[12.5px] tabular-nums text-dim">
        {agent.name} {lastRun}
      </span>
    </div>
  )
}

// §4.7 LED classes — copied verbatim from AgentsView's own LED_CLASS table
// (that file's own comment on this exact point: each write-set names its own
// literal table rather than sharing one — same precedent HabitsCard/VitalsRow's
// DOMAIN_VAR follows).
const LED_BASE = 'block h-2 w-2 flex-shrink-0 rounded-full'
const LED_CLASS: Record<Health, string> = {
  ok: 'bg-good shadow-[0_0_8px_theme(colors.good)]',
  amber: 'bg-warn shadow-[0_0_8px_theme(colors.warn)]',
  red: 'bg-bad shadow-[0_0_8px_theme(colors.bad)]',
  idle: 'bg-faint', // no glow (§4.7)
}

function Led({ health, reducedMotion }: { health: Health; reducedMotion: boolean }) {
  const cls = `${LED_BASE} ${LED_CLASS[health]}`

  // §4.7/§7: only a failed/badly-stale (red) LED animates — a 1.2s blink,
  // opacity dipping to .35. `useReducedMotion()` gates it: reduced motion →
  // a steady red dot, never the blink.
  if (health === 'red' && !reducedMotion) {
    return (
      <motion.span
        role="status"
        data-testid="fleet-led"
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
      data-testid="fleet-led"
      data-health={health}
      data-animate="none"
      className={cls}
    />
  )
}

/**
 * Relative last-run display at minute/hour/day granularity ("12m ago",
 * "3h ago", "5d ago") — deterministic given `now` so tests inject a fixed
 * value rather than depending on the wall clock. A future `last_run` (clock
 * skew) clamps to 0 rather than reading as a negative duration.
 */
function relativeLastRun(iso: string, now: number): string {
  const lastRun = Date.parse(iso)
  if (Number.isNaN(lastRun)) return NEVER_RAN

  const diffMs = Math.max(0, now - lastRun)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
