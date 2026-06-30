/**
 * PulseView — Pulse tab content (Slice S13).
 *
 * Read-only, fully derived from the task list. Shows:
 *   1. Done-this-week count
 *   2. Per-domain warmth standings (reuses computeWarmth from S9)
 *   3. 7-day completions sparkline (plain divs — no chart dependency)
 *
 * Glass-styled via GlassPanel + .glass-panel CSS utility (S11).
 * Never imports Dexie or SyncProvider — reads only via the task prop.
 * Never calls Date.now() here; calls it once at render time and passes
 * the injected timestamp to pure helpers.
 */
import { motion } from 'framer-motion'
import type { Task } from '../types'
import { GlassPanel } from './GlassPanel'
import { computeWarmth, type WarmthState } from '../warmth/computeWarmth'
import { DOMAINS, DOMAIN_COLORS } from '../data/domains'
import { doneThisWeek, completionsByDay } from '../pulse/metrics'

// ---------------------------------------------------------------------------
// Warmth state → visual config (badge color, text)
// Mirrors the warmth palette established in DomainsMap (S9/S11).
// ---------------------------------------------------------------------------

const WARMTH_BADGE: Record<WarmthState, { bg: string; text: string }> = {
  hot:   { bg: 'rgba(255,55,95,0.12)',  text: '#FF375F' },
  warm:  { bg: 'rgba(255,159,10,0.12)', text: '#FF9F0A' },
  ok:    { bg: 'rgba(48,209,88,0.12)',  text: '#30D158' },
  stale: { bg: 'rgba(142,142,147,0.12)', text: '#8E8E93' },
  cold:  { bg: 'rgba(142,142,147,0.08)', text: '#8E8E93' },
}

/** Warm → cold ordering weight; lower = hotter. */
const WARMTH_ORDER: Record<WarmthState, number> = {
  hot: 0, warm: 1, ok: 2, stale: 3, cold: 4,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PulseViewProps {
  tasks: Task[]
}

export function PulseView({ tasks }: PulseViewProps) {
  // Capture `now` once per render — passed to pure helpers, not called inside them.
  const now = Date.now()

  const count = doneThisWeek(tasks, now)
  const sparkline = completionsByDay(tasks, now, 7)
  const warmth = computeWarmth(tasks, now)

  // Avoid division by zero in bar heights.
  const maxBar = Math.max(...sparkline, 1)

  // Sort domains warm → cold for the standings list.
  const sortedDomains = [...DOMAINS].sort(
    (a, b) => WARMTH_ORDER[warmth[a]] - WARMTH_ORDER[warmth[b]],
  )

  return (
    <motion.div
      key="pulse"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-4 px-4 pt-4"
    >
      {/* ── Done this week ─────────────────────────────────────────────── */}
      <GlassPanel className="rounded-ios-lg p-5" elevation="raised">
        <p className="text-xs font-semibold uppercase tracking-widest text-apple-gray-1 mb-1">
          Done this week
        </p>
        <p className="text-5xl font-bold text-apple-label leading-none">{count}</p>
        <p className="text-sm text-apple-gray-1 mt-1.5">
          tasks completed in the last 7 days
        </p>
      </GlassPanel>

      {/* ── 7-day sparkline ────────────────────────────────────────────── */}
      <GlassPanel className="rounded-ios-lg p-5" elevation="base">
        <p className="text-xs font-semibold uppercase tracking-widest text-apple-gray-1 mb-3">
          Completions — last 7 days
        </p>
        {/* Bar chart: oldest (index 0) → newest (index 6) */}
        <div className="flex items-end gap-1.5" style={{ height: 48 }}>
          {sparkline.map((val, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all"
              style={{
                height: `${Math.max(6, (val / maxBar) * 100)}%`,
                background: val > 0 ? '#007AFF' : 'rgba(60,60,67,0.10)',
              }}
            />
          ))}
        </div>
        <div
          className="flex justify-between mt-1.5 text-apple-gray-1"
          style={{ fontSize: 10 }}
        >
          <span>7d ago</span>
          <span>Today</span>
        </div>
      </GlassPanel>

      {/* ── Domain warmth standings ─────────────────────────────────────── */}
      <GlassPanel className="rounded-ios-lg p-5" elevation="base">
        <p className="text-xs font-semibold uppercase tracking-widest text-apple-gray-1 mb-3">
          Domain warmth
        </p>
        <ul className="flex flex-col gap-2.5">
          {sortedDomains.map((domain) => {
            const state = warmth[domain]
            const badge = WARMTH_BADGE[state]
            return (
              <li key={domain} className="flex items-center gap-3">
                {/* Domain colour dot */}
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: DOMAIN_COLORS[domain] }}
                />
                {/* Domain name */}
                <span className="flex-1 text-sm font-medium text-apple-label">
                  {domain}
                </span>
                {/* Warmth badge */}
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: badge.bg, color: badge.text }}
                >
                  {state}
                </span>
              </li>
            )
          })}
        </ul>
      </GlassPanel>
    </motion.div>
  )
}
