import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Card } from '../glass/Card'
import { parseAttention, type AttentionItem, type AttentionLabel } from '../../vault/mail'
import { GitTransport, type VaultTransport } from '../../vault/transport'

/**
 * AttentionCard — the Home left-stack "Needs you" attention stack
 * (DESIGN_LANGUAGE §4.4, §8, Slice S37). Renders S36's parsed
 * `Mail/attention.md` (src/vault/mail.ts's `parseAttention`) as one row per
 * *unhandled* AttentionItem — handled ([x]) items are kept in the file for
 * history but never shown here. Nothing about the item shape is invented:
 * this file only consumes AttentionItem, it does not re-parse anything.
 *
 * Mirrors TodayCard/HabitsCard's "head of chain" convention: HomeView mounts
 * this with no data props in the live app, so the component self-loads via
 * the transport seam; `items` exists purely to short-circuit that fetch
 * under test, so fixture rendering never touches GitTransport (or its
 * IndexedDB/network side effects).
 */

// §4.4: icon well tinted by source — literal rgba values copied verbatim
// from the design contract, nothing invented. The four named sources (mail,
// bill, agent-failure, job) map onto AttentionLabel: `client-money` items
// are the "mail" source (§4.4's own worked example uses label:: client-money
// with the mail icon/tint). `other` has no assigned §4.4 color, so it falls
// back to the same neutral panel tint TodayCard's 'other' chip already uses
// (bg-[rgba(255,255,255,.06)]) rather than inventing a new hex.
const ICON_TINT: Record<AttentionLabel, string> = {
  'client-money': 'bg-[rgba(56,189,248,.15)]',
  bill: 'bg-[rgba(251,191,36,.15)]',
  job: 'bg-[rgba(167,139,250,.16)]',
  'agent-failure': 'bg-[rgba(248,113,113,.15)]',
  other: 'bg-[rgba(255,255,255,.06)]',
}

const ICON_GLYPH: Record<AttentionLabel, string> = {
  'client-money': '✉️',
  bill: '🧾',
  job: '💼',
  'agent-failure': '⚠️',
  other: '•',
}

// `Mail/attention.md` is written entirely by the email-triage agent (S38 —
// see src/vault/mail.ts's own docblock), regardless of which label a given
// line carries, so every provenance sub-line names the same flagging agent.
const FLAGGED_BY = 'email-triage'

/** "client-money" → "client / money" (§4.4's own worked example: "flagged as client / money"). */
function labelDisplay(label: AttentionLabel): string {
  return label.replace(/-/g, ' / ')
}

export interface AttentionCardProps {
  /** Parsed attention items (open + handled). Omit in-app (self-loads via `transport`); inject in tests. */
  items?: AttentionItem[]
  /** Read seam. Defaults to a fresh GitTransport. */
  transport?: VaultTransport
}

export function AttentionCard({ items: itemsProp, transport }: AttentionCardProps = {}) {
  const [loadedItems, setLoadedItems] = useState<AttentionItem[]>([])
  const prefersReducedMotion = useReducedMotion() ?? false

  // Self-load from the vault when the caller didn't inject fixture data —
  // the TodayCard/HabitsCard "head of chain" convention: tests short-circuit
  // this by passing `items` (skips the effect entirely, so GitTransport is
  // never constructed under test).
  useEffect(() => {
    if (itemsProp !== undefined) return
    // Fast honest-empty path: with no configured vault remote, a default
    // GitTransport always rejects (transport.ts's own `VITE_VAULT_REPO_URL
    // is not configured` guard) — but only AFTER paying for isomorphic-git's
    // dynamic import. Skip straight to the empty state when unconfigured and
    // no caller-supplied transport is present, rather than paying that cost
    // just to land on the exact same empty result.
    if (!transport && !import.meta.env.VITE_VAULT_REPO_URL) return
    let live = true
    ;(async () => {
      try {
        const t = transport ?? new GitTransport()
        const files = await t.readFiles()
        if (!live) return
        const md = files.find((f) => f.path === 'Mail/attention.md')?.content ?? ''
        setLoadedItems(parseAttention(md))
      } catch {
        // No vault configured / offline — render the honest empty state (§8: no fake-real data).
      }
    })()
    return () => {
      live = false
    }
  }, [itemsProp, transport])

  const items = itemsProp ?? loadedItems

  // Handled items are hidden (kept in the file for history only); the
  // remaining unhandled ones are sorted by waitingHours desc — the item
  // that's waited longest surfaces first.
  const unhandled = items.filter((i) => !i.handled).sort((a, b) => b.waitingHours - a.waitingHours)

  return (
    <Card heading="Needs you" count={unhandled.length} data-testid="attention-card">
      {unhandled.length === 0 ? (
        <p className="text-[13px] text-dim">Nothing needs you right now.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {unhandled.map((item, i) => (
            <AttentionRow key={`${item.label}-${item.title}-${i}`} item={item} reduceMotion={prefersReducedMotion} />
          ))}
        </div>
      )}
    </Card>
  )
}

interface AttentionRowProps {
  item: AttentionItem
  reduceMotion: boolean
}

/** A single attention row per §4.4 anatomy: icon well + message/provenance + action button. */
function AttentionRow({ item, reduceMotion }: AttentionRowProps) {
  const draftReady = item.draftPath !== undefined

  return (
    <div
      data-testid="attention-row"
      data-label={item.label}
      className="flex items-start gap-2.5 rounded-[12px] bg-[rgba(255,255,255,.035)] px-3 py-2.5 text-[13.5px]"
    >
      <span
        data-testid="attention-icon"
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[9px] text-[13px] ${ICON_TINT[item.label]}`}
      >
        {ICON_GLYPH[item.label]}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-txt">{item.title}</span>
        <small data-testid="attention-provenance" className="mt-0.5 block text-[12px] text-dim">
          waiting {item.waitingHours}h · {FLAGGED_BY} flagged as {labelDisplay(item.label)}
        </small>
      </span>

      <button
        type="button"
        data-testid="attention-action"
        data-kind={draftReady ? 'draft' : 'open'}
        // No-op placeholder — wiring an actual draft-open/generic-open flow
        // is out of this slice's write-set (per the ticket's Subtasks/DoD).
        onClick={() => {}}
        className={[
          'flex-shrink-0 self-start rounded-[999px] border border-[rgba(165,180,252,.25)] bg-[rgba(165,180,252,.12)]',
          'px-2.5 py-1 text-[11.5px] font-semibold text-[#a5b4fc]',
          !reduceMotion && 'transition-colors duration-200',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {draftReady ? 'Draft ready →' : 'Open →'}
      </button>
    </div>
  )
}
