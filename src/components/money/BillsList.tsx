import type { Bill } from '../../vault/finance'
import { formatINR, dueInDays } from '../../vault/finance'

/**
 * BillsList — bills radar rows (S40, DESIGN_LANGUAGE §4.9 + §8):
 *
 *   "Bills row: .row flex space-between, hairline dividers, name + small
 *   provenance sub (--faint, e.g. 'auto-detected from Gmail'), right-aligned
 *   tabular value + due sub (.dn when ≤ 7 days, --dim otherwise, --faint + ✓
 *   when paid)."
 *
 * Dividers use the existing `--panel-brd` hairline token (§2.1) rather than
 * inventing a new alpha — §4.9 names "hairline dividers" without pinning a
 * literal for this row type (unlike the calendar-slot divider in §4.5).
 */

export interface BillsListProps {
  bills: Bill[]
  /** Injected "today" for deterministic due-soon math in tests; defaults to now. */
  now?: string | Date
}

/** §8: "Show provenance on machine-produced rows" — never present agent/sync
 * output as an anonymous fact. */
function provenanceLabel(source: string): string {
  const s = source.trim().toLowerCase()
  if (s === 'gmail') return 'auto-detected from Gmail'
  if (s === 'manual') return 'added manually'
  return `via ${source}`
}

export function BillsList({ bills, now }: BillsListProps) {
  const today = now ?? new Date()

  return (
    <ul aria-label="Bills" className="flex flex-col">
      {bills.map((bill, i) => {
        const days = dueInDays(bill.due, today)
        const dueSoon = !bill.paid && Number.isFinite(days) && days <= 7

        return (
          <li
            key={`${bill.name}-${bill.due}`}
            data-testid="bill-row"
            data-paid={bill.paid}
            data-due-soon={dueSoon}
            className={[
              'row flex items-center justify-between gap-3 py-[10px]',
              i < bills.length - 1 ? 'border-b border-panel-brd' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="min-w-0">
              <div className="text-[13.5px] text-txt">{bill.name}</div>
              <div className="small text-[11.5px] text-faint">{provenanceLabel(bill.source)}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <div className="text-right text-[13.5px] tabular-nums text-txt">{formatINR(bill.amount)}</div>
              {bill.paid ? (
                <div className="text-[11.5px] text-faint">✓ paid</div>
              ) : (
                <div className={`text-[11.5px] ${dueSoon ? 'dn text-bad' : 'text-dim'}`}>
                  {!Number.isFinite(days)
                    ? 'due date unknown'
                    : days < 0
                      ? `overdue ${Math.abs(days)}d`
                      : `due in ${days}d`}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
