import { formatINR, networthDelta } from '../vault/finance'
import type { NetworthPoint, BurnMonth } from '../vault/finance'
import type { JobEntry } from '../vault/career'

/**
 * vitalsData — pure selectors (S41) that turn S39 finance-parser output into
 * the two VitalsRow money tiles: Net worth (last value + monthly delta) and
 * Burn / income (spend vs income for the latest month).
 *
 * Both selectors are pure and never throw. `value: null` signals "nothing to
 * show" — VitalsRow reads that as the honest `—` stub fallback (§8: no
 * fake-real numbers), exactly like the S26 placeholder tiles did before real
 * data existed. Mirrors MoneyView's (S40) precedent of props defaulting to
 * `[]` rather than fetching/parsing — S42's finance-sync agent wires the
 * live vault reads later.
 *
 * S45 extends this file with `pipelineVital`, same idiom, over S43's
 * `parsePipeline` (`Career/pipeline.md`) output.
 */

/** One vital tile's derived value/sub/direction. */
export interface VitalDatum {
  /** Count-up target in INR, or `null` when there's nothing to show (stub). */
  value: number | null
  /** `.s` sub line text. */
  sub: string
  /** `.up` (good) / `.dn` (bad); omitted for neutral or no-data. */
  dir?: 'up' | 'dn'
}

const NO_DATA: VitalDatum = { value: null, sub: 'no data' }

/**
 * Net-worth tile: last series point's value, with a signed % delta vs the
 * previous point driving `.up` (gain, delta ≥ 0) / `.dn` (loss, delta < 0).
 *
 * - Empty series → `NO_DATA` stub.
 * - Single-point series → value shown, neutral sub (no prior point to diff).
 * - `prev.networth === 0` → percent treated as 0 (avoids ÷0 / Infinity).
 */
export function netWorthVital(series: NetworthPoint[]): VitalDatum {
  if (!series || series.length === 0) return NO_DATA

  const last = series[series.length - 1]!
  if (series.length < 2) {
    return { value: last.networth, sub: 'no prior data' }
  }

  const prev = series[series.length - 2]!
  const delta = networthDelta(series)
  const pct = prev.networth !== 0 ? (delta / prev.networth) * 100 : 0
  const dir: 'up' | 'dn' = delta >= 0 ? 'up' : 'dn'
  const arrow = dir === 'up' ? '▲' : '▼'

  return {
    value: last.networth,
    sub: `${arrow} ${Math.abs(pct).toFixed(1)}% this month`,
    dir,
  }
}

/**
 * Burn / income tile: current month's spend (count-up target) vs income,
 * both named in the sub line. `.up` (good) when spend ≤ income (saving),
 * `.dn` (bad) when overspending.
 *
 * `burn` is `parseBurn`'s output (ascending by month) — the latest month is
 * the last entry. Empty → `NO_DATA` stub.
 */
export function burnVital(burn: BurnMonth[]): VitalDatum {
  if (!burn || burn.length === 0) return NO_DATA

  const latest = burn[burn.length - 1]!
  const dir: 'up' | 'dn' = latest.spend <= latest.income ? 'up' : 'dn'

  return {
    value: latest.spend,
    sub: `${formatINR(latest.spend)} spend / ${formatINR(latest.income)} income`,
    dir,
  }
}

/**
 * Best "next" line to surface on the Pipeline tile when there's no interview
 * to lead with: the hottest (`hot:: true`) active entry's `next::` step, or
 * failing that the first active entry that has one at all.
 */
function hottestNext(active: JobEntry[]): string | null {
  const hot = active.find((e) => e.hot && e.next)
  if (hot) return hot.next!
  const withNext = active.find((e) => e.next)
  return withNext ? withNext.next! : null
}

/**
 * Pipeline tile: count of active roles (found + applied + interview — closed
 * excluded) as the count-up target, with the sub line leading with the
 * interview count when there's one in flight, else the hottest `next::` step.
 *
 * `entries` empty (no file / nothing parsed) → `NO_DATA` stub. A non-empty
 * file with zero active roles (everything closed) is real data, not a stub —
 * it renders `0` with an honest "no active roles" sub.
 */
export function pipelineVital(entries: JobEntry[]): VitalDatum {
  if (!entries || entries.length === 0) return NO_DATA

  const active = entries.filter((e) => e.stage !== 'closed')
  if (active.length === 0) {
    return { value: 0, sub: 'no active roles' }
  }

  const interviewCount = active.filter((e) => e.stage === 'interview').length
  const sub =
    interviewCount > 0
      ? `${interviewCount} interview${interviewCount === 1 ? '' : 's'}`
      : (hottestNext(active) ?? 'no interviews yet')

  return { value: active.length, sub }
}
