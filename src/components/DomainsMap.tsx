/**
 * DomainsMap — Domains tab content for Slice S9.
 *
 * Renders a 2-column grid of tiles, one per canonical domain.
 * Each tile shows:
 *   - the domain name
 *   - a one-word warmth state label (hot / warm / ok / stale / cold)
 *   - a glow derived from DOMAIN_COLORS at an intensity matching warmth
 *
 * Cold tiles are visibly frosted (desaturated + muted) so neglect is felt
 * at a glance. Tile drill-down is deferred to a later slice.
 *
 * UI contract: receives tasks from the already-loaded SyncProvider list.
 * Never imports Dexie or LocalOnly — only ../types and src/data/domains.
 */
import { motion } from 'framer-motion'
import type { Task } from '../types'
import { DOMAINS, DOMAIN_COLORS } from '../data/domains'
import type { Domain } from '../data/domains'
import { computeWarmth } from '../warmth/computeWarmth'
import type { WarmthState } from '../warmth/computeWarmth'

interface DomainsMapProps {
  tasks: Task[]
}

// ---------------------------------------------------------------------------
// Warmth → visual config
// ---------------------------------------------------------------------------

interface WarmthVisual {
  /** CSS box-shadow glow for the tile */
  glow: (color: string) => string
  /** Opacity applied to the whole tile (frosted effect for cold) */
  opacity: number
  /** CSS filter for cold/stale muting */
  filter: string
  /** Badge background color */
  badgeBg: string
  /** Badge text color */
  badgeText: string
}

const WARMTH_VISUAL: Record<WarmthState, WarmthVisual> = {
  hot: {
    glow: (c) => `0 0 20px 6px ${c}88, 0 2px 8px ${c}44`,
    opacity: 1,
    filter: 'none',
    badgeBg: 'rgba(255,55,95,0.15)',
    badgeText: '#FF375F',
  },
  warm: {
    glow: (c) => `0 0 14px 3px ${c}66`,
    opacity: 1,
    filter: 'none',
    badgeBg: 'rgba(255,159,10,0.15)',
    badgeText: '#FF9F0A',
  },
  ok: {
    glow: (c) => `0 0 8px 1px ${c}44`,
    opacity: 0.95,
    filter: 'none',
    badgeBg: 'rgba(48,209,88,0.12)',
    badgeText: '#30D158',
  },
  stale: {
    glow: (_c) => '0 1px 4px rgba(0,0,0,0.08)',
    opacity: 0.75,
    filter: 'saturate(0.5)',
    badgeBg: 'rgba(142,142,147,0.12)',
    badgeText: '#8E8E93',
  },
  cold: {
    glow: (_c) => '0 1px 4px rgba(0,0,0,0.08)',
    opacity: 0.45,
    filter: 'saturate(0.15) brightness(0.9)',
    badgeBg: 'rgba(142,142,147,0.10)',
    badgeText: '#8E8E93',
  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DomainsMap({ tasks }: DomainsMapProps) {
  const warmth = computeWarmth(tasks, Date.now())

  return (
    <motion.div
      key="domains-map"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="px-4 pt-4 pb-6"
    >
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
      >
        {DOMAINS.map((domain: Domain) => {
          const state = warmth[domain]
          const color = DOMAIN_COLORS[domain]
          const visual = WARMTH_VISUAL[state]

          return (
            <motion.div
              key={domain}
              data-testid="domain-tile"
              data-domain={domain}
              data-warmth={state}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: visual.opacity, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="relative rounded-2xl p-4 bg-white border"
              style={{
                borderColor: 'rgba(60,60,67,0.10)',
                boxShadow: visual.glow(color),
                filter: visual.filter,
              }}
            >
              {/* Color accent bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                style={{ backgroundColor: color }}
              />

              {/* Domain name */}
              <p
                className="mt-2 text-sm font-semibold leading-tight"
                style={{ color: '#1C1C1E' }}
              >
                {domain}
              </p>

              {/* Warmth state badge */}
              <span
                className="mt-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                style={{
                  backgroundColor: visual.badgeBg,
                  color: visual.badgeText,
                }}
              >
                {state}
              </span>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
