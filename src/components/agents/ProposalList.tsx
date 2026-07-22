import { useEffect, useRef, useState } from 'react'
import { Card } from '../glass/Card'
import type { VaultTransport } from '../../vault/transport'
import { parseProposal, type Proposal, type ProposalStatus } from '../../vault/supervisor'
import { flipProposal } from '../../vault/proposalWrite'

/**
 * ProposalList — the owner's approve/reject queue for supervisor proposals
 * (S54, tail of the AgentsView chain: S49 fleet table → S53 SupervisorCard →
 * S54 here). Mounted below SupervisorCard per the ticket.
 *
 * This is the human gate on agent self-modification: only `status: pending`
 * proposals list here; a tap on Approve/Reject is a TWO-STEP confirm (arm →
 * confirm within CONFIRM_MS, else reset) in the confirm-destructive spirit of
 * ADR-0013/v1-S17, and the commit goes through `flipProposal` — the S52
 * byte-surgical `setProposalStatus` transform, written back via the SAME
 * VaultTransport write seam every other vault mutation uses (no direct
 * fs/git in this component).
 *
 * Purely presentational at the fetch boundary, like SupervisorCard: it takes
 * the raw `proposals/*` files (path+content, the exact shape
 * `transport.readFiles()` returns) and parses them itself via the S52
 * `parseProposal` rather than requiring an already-parsed prop — App.tsx
 * hasn't wired live data yet (mirrors AgentsView's `reportMd` convention), so
 * `proposals` defaults to `[]` → the honest "No proposals" empty state.
 *
 * A flipped proposal leaves the list immediately via local optimistic state
 * (no parent refetch loop exists yet) — the same pattern MissionCard uses for
 * its veto set.
 */

/** Two-step confirm window — a same-screen tap-tap, so a short window is fine
 * (shorter than the bot's 2-minute multi-turn TTL, ADR-0013 Decision 3). */
const CONFIRM_MS = 5000

export interface ProposalListProps {
  /** Raw proposal files (path + content) under `proposals/*`; same shape as `transport.readFiles()`. */
  proposals?: { path: string; content: string }[]
  /** Write transport for `flipProposal` (S52/S15 seam); omitted → buttons render but are inert. */
  transport?: VaultTransport
}

interface Armed {
  path: string
  action: 'approve' | 'reject'
}

export function ProposalList({ proposals = [], transport }: ProposalListProps) {
  // Optimistic local override: once a proposal is flipped it disappears from
  // the pending list immediately, without waiting on a parent refetch.
  const [flipped, setFlipped] = useState<Record<string, ProposalStatus>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [armed, setArmed] = useState<Armed | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const timerRef = useRef<number>()

  // Clear any pending arm-timeout on unmount — mirrors TaskItem/UndoToast's
  // own timer-cleanup discipline so setState never fires post-teardown.
  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const rows = proposals
    .map((f) => ({ path: f.path, proposal: parseProposal(f.content) }))
    .filter((f) => (flipped[f.path] ?? f.proposal.status) === 'pending')

  const toggleExpanded = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const arm = (path: string, action: 'approve' | 'reject') => {
    window.clearTimeout(timerRef.current)
    setArmed({ path, action })
    timerRef.current = window.setTimeout(() => setArmed(null), CONFIRM_MS)
  }

  const commit = async (path: string, action: 'approve' | 'reject') => {
    window.clearTimeout(timerRef.current)
    setArmed(null)
    if (!transport) return

    const status: ProposalStatus = action === 'approve' ? 'approved' : 'rejected'
    setBusy(path)
    try {
      await flipProposal(transport, path, status)
      setFlipped((prev) => ({ ...prev, [path]: status }))
    } finally {
      setBusy(null)
    }
  }

  const handleTap = (path: string, action: 'approve' | 'reject') => {
    if (armed && armed.path === path && armed.action === action) {
      void commit(path, action)
    } else {
      arm(path, action)
    }
  }

  return (
    <Card heading="Proposals" data-testid="proposal-list" count={rows.length}>
      {rows.length === 0 ? (
        <p data-testid="proposal-empty" className="text-[13.5px] leading-[1.55] text-dim">
          No proposals awaiting review
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map(({ path, proposal }) => (
            <ProposalRow
              key={path}
              path={path}
              proposal={proposal}
              expanded={expanded.has(path)}
              onToggle={() => toggleExpanded(path)}
              armedAction={armed?.path === path ? armed.action : null}
              busy={busy === path}
              onApprove={() => handleTap(path, 'approve')}
              onReject={() => handleTap(path, 'reject')}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface ProposalRowProps {
  path: string
  proposal: Proposal
  expanded: boolean
  onToggle: () => void
  armedAction: 'approve' | 'reject' | null
  busy: boolean
  onApprove: () => void
  onReject: () => void
}

function ProposalRow({
  path,
  proposal,
  expanded,
  onToggle,
  armedAction,
  busy,
  onApprove,
  onReject,
}: ProposalRowProps) {
  return (
    <div
      data-testid="proposal-item"
      data-path={path}
      data-agent={proposal.agent}
      className="rounded-[12px] bg-[rgba(255,255,255,.035)] px-3 py-2.5"
    >
      <button
        type="button"
        data-testid="proposal-toggle"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-txt">{proposal.agent}</div>
          <div className="truncate text-[12.5px] text-dim">{proposal.date || 'no date'}</div>
        </div>
      </button>

      {expanded && (
        <div data-testid="proposal-detail" className="mt-2.5 flex flex-col gap-2.5">
          <ProposalSection heading="Change" body={proposal.change} />
          <ProposalSection heading="Diff" body={proposal.diff} mono />
          <ProposalSection heading="Why" body={proposal.why} />
        </div>
      )}

      <div className="mt-2.5 flex gap-2">
        <ActionButton
          testId="proposal-approve"
          armed={armedAction === 'approve'}
          disabled={busy}
          onClick={onApprove}
          idleLabel="Approve"
          armedLabel="Confirm approve?"
          variant="approve"
        />
        <ActionButton
          testId="proposal-reject"
          armed={armedAction === 'reject'}
          disabled={busy}
          onClick={onReject}
          idleLabel="Reject"
          armedLabel="Confirm reject?"
          variant="reject"
        />
      </div>
    </div>
  )
}

function ProposalSection({ heading, body, mono = false }: { heading: string; body: string; mono?: boolean }) {
  return (
    <div data-testid="proposal-section" data-heading={heading}>
      <div className="mb-1 text-[11px] uppercase tracking-[.1em] text-faint">{heading}</div>
      <div
        className={`whitespace-pre-wrap text-[13px] leading-[1.55] text-txt ${mono ? 'font-mono text-[12px]' : ''}`}
      >
        {body || '—'}
      </div>
    </div>
  )
}

// ─── Action button (§4.4 attention-row action-button tokens) ─────────────────

/**
 * `approve` uses §4.4's literal action-button tokens (`#a5b4fc` on
 * `rgba(165,180,252,.12)`, border `rgba(165,180,252,.25)`). `reject` reuses
 * the already-established `p3`/error-note red family (`#fca5a5` on
 * `rgba(248,113,113,.15)`, per Chip.tsx's `p3` variant and AgentsView's
 * error-note class) rather than inventing a new destructive color. The armed
 * (confirm) state reuses the LED glow technique verbatim (§4.7's
 * `shadow-[0_0_8px_theme(colors.X)]`, already used by AgentsView's `Led`) —
 * no new literal, just the existing warn/bad semantic tokens signalling
 * "about to commit."
 */
const BASE_BUTTON =
  'rounded-[999px] px-[10px] py-[4px] text-[11.5px] font-semibold transition-shadow ' +
  'motion-reduce:transition-none disabled:cursor-default disabled:opacity-50 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-txt'

const VARIANT_CLASS: Record<'approve' | 'reject', string> = {
  approve: 'text-[#a5b4fc] bg-[rgba(165,180,252,.12)] border border-[rgba(165,180,252,.25)]',
  reject: 'text-[#fca5a5] bg-[rgba(248,113,113,.15)] border border-[rgba(248,113,113,.3)]',
}

const ARMED_GLOW: Record<'approve' | 'reject', string> = {
  approve: 'shadow-[0_0_8px_theme(colors.warn)]',
  reject: 'shadow-[0_0_8px_theme(colors.bad)]',
}

interface ActionButtonProps {
  testId: string
  armed: boolean
  disabled: boolean
  onClick: () => void
  idleLabel: string
  armedLabel: string
  variant: 'approve' | 'reject'
}

function ActionButton({ testId, armed, disabled, onClick, idleLabel, armedLabel, variant }: ActionButtonProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-armed={armed}
      onClick={onClick}
      disabled={disabled}
      className={[BASE_BUTTON, VARIANT_CLASS[variant], armed ? ARMED_GLOW[variant] : '']
        .filter(Boolean)
        .join(' ')}
    >
      {armed ? armedLabel : idleLabel}
    </button>
  )
}
