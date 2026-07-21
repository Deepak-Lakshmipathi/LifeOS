import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Card } from '../glass/Card'
import { Sparkline } from './Sparkline'
import { Donut } from './Donut'
import { BarMeter } from './BarMeter'
import { BillsList } from './BillsList'
import {
  formatINR,
  networthDelta,
  type NetworthPoint,
  type PortfolioSlice,
  type BurnMonth,
  type Bill,
} from '../../vault/finance'

/**
 * MoneyView — Money tab: Net worth · Burn, then Portfolio · Bills radar
 * (DESIGN_LANGUAGE §5 layout, §4.9 widgets).
 *
 * S24 mounted this as a stub Card and never edits this file again. S40
 * (this slice) fills it in. The view is purely presentational: it takes
 * already-parsed S39 shapes as props and does no fetching/parsing of its
 * own (App.tsx mounts `<MoneyView />` with no props today — every prop
 * defaults to an empty array so that honestly renders "no data yet" rather
 * than fetching or fabricating numbers, matching VitalsRow's S26 stub
 * precedent, until S42's finance-sync agent wires real props through).
 */

export interface MoneyViewProps {
  /** Net-worth series, ascending by date (`parseNetworthHistory` output). */
  networth?: NetworthPoint[]
  /** Portfolio slices, file order (`parsePortfolio` output). */
  portfolio?: PortfolioSlice[]
  /** Income/spend per month, ascending (`parseBurn` output). */
  burn?: BurnMonth[]
  /** Bills, file order (`parseBills` output). */
  bills?: Bill[]
  /** Injected "today" for deterministic bills due-soon math in tests. */
  now?: string | Date
}

const COUNT_UP_MS = 900

/**
 * §7 count-up: `1-(1-p)^3` ease over 900ms on load. Gated by framer-motion's
 * `useReducedMotion()` (the app's own pattern — TaskItem, App.tsx), which
 * jumps straight to the target instead of animating (constraint: any
 * count-up/animated draw must no-op under reduced motion).
 */
function useCountUp(target: number, skip: boolean, duration = COUNT_UP_MS): number {
  const [display, setDisplay] = useState(() => (skip ? target : 0))

  useEffect(() => {
    if (skip) {
      setDisplay(target)
      return
    }

    let timer: ReturnType<typeof setTimeout>
    const start = Date.now()

    const step = () => {
      const elapsed = Date.now() - start
      const p = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(target * eased)
      if (p < 1) {
        timer = setTimeout(step, 16)
      }
    }

    step()
    return () => clearTimeout(timer)
  }, [target, skip, duration])

  return display
}

export function MoneyView({
  networth = [],
  portfolio = [],
  burn = [],
  bills = [],
  now,
}: MoneyViewProps) {
  const prefersReducedMotion = useReducedMotion() ?? false

  const latest = networth[networth.length - 1]
  const prev = networth[networth.length - 2]
  const delta = networthDelta(networth)
  const deltaPct = prev && prev.networth !== 0 ? (delta / prev.networth) * 100 : 0
  const hasDelta = networth.length >= 2

  const displayValue = useCountUp(latest?.networth ?? 0, prefersReducedMotion || !latest)

  const latestBurn = burn[burn.length - 1]
  const burnMax = latestBurn ? Math.max(latestBurn.income, latestBurn.spend, 1) : 1

  return (
    <div className="flex flex-col gap-3.5">
      {/* Top row — §5: "1.2fr 1fr top row (Net worth · Burn)". */}
      <div className="grid grid-cols-1 gap-3.5 [@media(min-width:841px)]:grid-cols-[1.2fr_1fr]">
        <Card heading="Net worth" data-testid="money-networth-card">
          {latest ? (
            <>
              <div className="big text-[38px] font-extrabold tracking-[-.02em] tabular-nums text-txt">
                {formatINR(displayValue)}
              </div>
              <div
                className={`s mt-1 text-[13px] ${
                  hasDelta ? (delta >= 0 ? 'up text-good' : 'dn text-bad') : 'text-dim'
                }`}
              >
                {hasDelta
                  ? `${delta >= 0 ? '▲' : '▼'} ${Math.abs(deltaPct).toFixed(1)}% this month`
                  : '—'}
              </div>
              <div className="mt-3">
                <Sparkline values={networth.map((p) => p.networth)} />
              </div>
            </>
          ) : (
            <p className="text-sm text-dim">No net worth data yet.</p>
          )}
        </Card>

        <Card heading="Burn" data-testid="money-burn-card">
          {latestBurn ? (
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-baseline justify-between text-[11.5px] text-dim">
                  <span>Income</span>
                  <span className="tabular-nums text-txt">{formatINR(latestBurn.income)}</span>
                </div>
                <div className="mt-1.5">
                  <BarMeter
                    variant="income"
                    pct={(latestBurn.income / burnMax) * 100}
                    ariaLabel="Income this month"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between text-[11.5px] text-dim">
                  <span>Spend</span>
                  <span className="tabular-nums text-txt">{formatINR(latestBurn.spend)}</span>
                </div>
                <div className="mt-1.5">
                  <BarMeter
                    variant="spend"
                    pct={(latestBurn.spend / burnMax) * 100}
                    ariaLabel="Spend this month"
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-dim">No burn data yet.</p>
          )}
        </Card>
      </div>

      {/* Second row — §5: "1fr 1fr (Portfolio · Bills radar)". */}
      <div className="grid grid-cols-1 gap-3.5 [@media(min-width:841px)]:grid-cols-2">
        <Card heading="Portfolio" data-testid="money-portfolio-card">
          {portfolio.length > 0 ? (
            <Donut slices={portfolio} />
          ) : (
            <p className="text-sm text-dim">No portfolio data yet.</p>
          )}
        </Card>

        <Card heading="Bills" data-testid="money-bills-card">
          {bills.length > 0 ? (
            <BillsList bills={bills} now={now} />
          ) : (
            <p className="text-sm text-dim">No bills yet.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
