/**
 * Tests for S54 — ProposalList (proposal approval flow, DESIGN_LANGUAGE §4.4
 * action-button tokens, ADR-0013 confirm-destructive spirit).
 *
 * DoD:
 *   #1 Pending fixtures listed; approved/rejected fixtures NOT listed.
 *   #2 Approve is two-step: first tap arms ("Confirm approve?"), second tap
 *      commits; a tap after CONFIRM_MS resets to the idle label (fake timers).
 *   #3 flipProposal writes through the transport seam — asserted via a FAKE
 *      transport's captured writeFile payload (no direct fs/git).
 *   #4 Reject flips to `rejected` identically (two-step confirm).
 *
 * Fixture-first for pending/approved (mirrors SupervisorCard.test.tsx): reads
 * the real S52 fixtures committed under src/vault/__fixtures__/. No
 * "rejected" fixture is committed yet, so that one case uses an inline
 * proposal string built from the same shape.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, screen, fireEvent, act, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ProposalList } from './ProposalList'
import type { VaultTransport } from '../../vault/transport'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIX = join(HERE, '..', '..', 'vault', '__fixtures__')
const readFix = (name: string) => readFileSync(join(FIX, name), 'utf8')

const PENDING_MD = readFix('proposal-pending.md')
const APPROVED_MD = readFix('proposal-approved.md')
const REJECTED_MD = `---
agent: calendar-sync
date: 2026-07-14
status: rejected # pending | approved | rejected
---
## Change
Widen the stale-sync window from 30m to 60m.
## Diff
\`\`\`
- stale after: 30m
+ stale after: 60m
\`\`\`
## Why
Too many false-positive alerts during owner's lunch break.
`

const PENDING_PATH = 'proposals/email-triage-2026-07-13.md'
const APPROVED_PATH = 'proposals/email-triage-2026-06-01.md'
const REJECTED_PATH = 'proposals/calendar-sync-2026-07-14.md'

// ─── FakeTransport (mirrors src/sync/VaultSync.test.ts) ─────────────────────

interface WriteCall {
  path: string
  content: string
  message: string
}

class FakeTransport implements VaultTransport {
  readonly writeCalls: WriteCall[] = []
  private readonly files: { path: string; content: string }[]

  constructor(files: { path: string; content: string }[]) {
    this.files = files.map((f) => ({ ...f }))
  }

  readFiles() {
    return Promise.resolve(this.files.map((f) => ({ ...f })))
  }

  writeFile(path: string, content: string, message: string) {
    this.writeCalls.push({ path, content, message })
    const existing = this.files.find((f) => f.path === path)
    if (existing) existing.content = content
    else this.files.push({ path, content })
    return Promise.resolve()
  }
}

afterEach(cleanup)

// ── DoD #1: list filtering ───────────────────────────────────────────────────

describe('ProposalList — DoD #1: pending listed, approved/rejected excluded', () => {
  it('shows the empty state with no proposal files', () => {
    render(<ProposalList proposals={[]} />)
    expect(screen.getByTestId('proposal-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('proposal-item')).not.toBeInTheDocument()
  })

  it('lists a pending proposal', () => {
    render(<ProposalList proposals={[{ path: PENDING_PATH, content: PENDING_MD }]} />)
    const items = screen.getAllByTestId('proposal-item')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveAttribute('data-agent', 'email-triage')
  })

  it('does NOT list an approved proposal', () => {
    render(<ProposalList proposals={[{ path: APPROVED_PATH, content: APPROVED_MD }]} />)
    expect(screen.getByTestId('proposal-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('proposal-item')).not.toBeInTheDocument()
  })

  it('does NOT list a rejected proposal', () => {
    render(<ProposalList proposals={[{ path: REJECTED_PATH, content: REJECTED_MD }]} />)
    expect(screen.getByTestId('proposal-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('proposal-item')).not.toBeInTheDocument()
  })

  it('filters a mixed set down to only the pending one', () => {
    render(
      <ProposalList
        proposals={[
          { path: PENDING_PATH, content: PENDING_MD },
          { path: APPROVED_PATH, content: APPROVED_MD },
          { path: REJECTED_PATH, content: REJECTED_MD },
        ]}
      />,
    )
    const items = screen.getAllByTestId('proposal-item')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveAttribute('data-path', PENDING_PATH)
  })

  it('expands to show Change/Diff/Why on toggle', () => {
    render(<ProposalList proposals={[{ path: PENDING_PATH, content: PENDING_MD }]} />)
    expect(screen.queryByTestId('proposal-detail')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('proposal-toggle'))

    const detail = screen.getByTestId('proposal-detail')
    const sections = within(detail).getAllByTestId('proposal-section')
    expect(sections.map((s) => s.getAttribute('data-heading'))).toEqual(['Change', 'Diff', 'Why'])
    expect(detail.textContent).toContain('Lower draft threshold')
    expect(detail.textContent).toContain('3 bill emails last week')
  })
})

// ── DoD #2 + #3: two-step approve + write payload ─────────────────────────────

describe('ProposalList — DoD #2/#3: two-step approve, timeout reset, write payload', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('arms on first tap ("Confirm approve?") without committing', () => {
    const transport = new FakeTransport([{ path: PENDING_PATH, content: PENDING_MD }])
    render(<ProposalList proposals={[{ path: PENDING_PATH, content: PENDING_MD }]} transport={transport} />)

    const approveBtn = screen.getByTestId('proposal-approve')
    expect(approveBtn).toHaveTextContent('Approve')

    fireEvent.click(approveBtn)

    expect(approveBtn).toHaveTextContent('Confirm approve?')
    expect(approveBtn).toHaveAttribute('data-armed', 'true')
    expect(transport.writeCalls).toHaveLength(0)
  })

  it('commits on the second tap within the confirm window, writing via the transport', async () => {
    const transport = new FakeTransport([{ path: PENDING_PATH, content: PENDING_MD }])
    render(<ProposalList proposals={[{ path: PENDING_PATH, content: PENDING_MD }]} transport={transport} />)

    const approveBtn = screen.getByTestId('proposal-approve')
    fireEvent.click(approveBtn) // arm
    act(() => {
      vi.advanceTimersByTime(2000) // well inside the 5s window
    })
    await act(async () => {
      fireEvent.click(approveBtn) // confirm
    })

    expect(transport.writeCalls).toHaveLength(1)
    expect(transport.writeCalls[0]!.path).toBe(PENDING_PATH)
    expect(transport.writeCalls[0]!.content).toContain('status: approved')

    // Approved proposal leaves the pending list.
    expect(screen.getByTestId('proposal-empty')).toBeInTheDocument()
  })

  it('resets the arm if the second tap lands after the confirm window (5s)', () => {
    const transport = new FakeTransport([{ path: PENDING_PATH, content: PENDING_MD }])
    render(<ProposalList proposals={[{ path: PENDING_PATH, content: PENDING_MD }]} transport={transport} />)

    const approveBtn = screen.getByTestId('proposal-approve')
    fireEvent.click(approveBtn) // arm
    expect(approveBtn).toHaveTextContent('Confirm approve?')

    act(() => {
      vi.advanceTimersByTime(5001) // past the window — auto-reset
    })
    expect(approveBtn).toHaveTextContent('Approve')
    expect(approveBtn).toHaveAttribute('data-armed', 'false')

    // A tap now re-arms instead of committing.
    fireEvent.click(approveBtn)
    expect(approveBtn).toHaveTextContent('Confirm approve?')
    expect(transport.writeCalls).toHaveLength(0)
  })

  it('a tap on a DIFFERENT proposal does not commit the first one\'s arm', () => {
    const transport = new FakeTransport([
      { path: PENDING_PATH, content: PENDING_MD },
      { path: 'proposals/other-2026-07-14.md', content: PENDING_MD.replace('email-triage', 'other') },
    ])
    render(
      <ProposalList
        proposals={[
          { path: PENDING_PATH, content: PENDING_MD },
          { path: 'proposals/other-2026-07-14.md', content: PENDING_MD.replace('email-triage', 'other') },
        ]}
        transport={transport}
      />,
    )

    const approveButtons = screen.getAllByTestId('proposal-approve')
    fireEvent.click(approveButtons[0]!) // arm proposal 1
    fireEvent.click(approveButtons[1]!) // tap proposal 2 — arms proposal 2, does not commit 1

    expect(transport.writeCalls).toHaveLength(0)
    expect(approveButtons[1]).toHaveTextContent('Confirm approve?')
  })

  it('does not write when no transport is provided (buttons render but are inert)', async () => {
    render(<ProposalList proposals={[{ path: PENDING_PATH, content: PENDING_MD }]} />)

    const approveBtn = screen.getByTestId('proposal-approve')
    fireEvent.click(approveBtn)
    await act(async () => {
      fireEvent.click(approveBtn)
    })

    // Still listed — no transport means no-op commit, proposal stays pending.
    expect(screen.getByTestId('proposal-item')).toBeInTheDocument()
  })
})

// ── DoD #4: reject mirrors approve ────────────────────────────────────────────

describe('ProposalList — DoD #4: reject flips to rejected, two-step', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('arms on first tap ("Confirm reject?") without committing', () => {
    const transport = new FakeTransport([{ path: PENDING_PATH, content: PENDING_MD }])
    render(<ProposalList proposals={[{ path: PENDING_PATH, content: PENDING_MD }]} transport={transport} />)

    const rejectBtn = screen.getByTestId('proposal-reject')
    fireEvent.click(rejectBtn)

    expect(rejectBtn).toHaveTextContent('Confirm reject?')
    expect(transport.writeCalls).toHaveLength(0)
  })

  it('commits "rejected" on the second tap, writing via the transport', async () => {
    const transport = new FakeTransport([{ path: PENDING_PATH, content: PENDING_MD }])
    render(<ProposalList proposals={[{ path: PENDING_PATH, content: PENDING_MD }]} transport={transport} />)

    const rejectBtn = screen.getByTestId('proposal-reject')
    fireEvent.click(rejectBtn) // arm
    await act(async () => {
      fireEvent.click(rejectBtn) // confirm
    })

    expect(transport.writeCalls).toHaveLength(1)
    expect(transport.writeCalls[0]!.content).toContain('status: rejected')
    expect(screen.getByTestId('proposal-empty')).toBeInTheDocument()
  })

  it('resets the reject arm after the confirm window', () => {
    const transport = new FakeTransport([{ path: PENDING_PATH, content: PENDING_MD }])
    render(<ProposalList proposals={[{ path: PENDING_PATH, content: PENDING_MD }]} transport={transport} />)

    const rejectBtn = screen.getByTestId('proposal-reject')
    fireEvent.click(rejectBtn)
    act(() => {
      vi.advanceTimersByTime(5001)
    })
    expect(rejectBtn).toHaveTextContent('Reject')
  })

  it('clears the arm-timeout timer on unmount (no post-teardown setState)', () => {
    const transport = new FakeTransport([{ path: PENDING_PATH, content: PENDING_MD }])
    const clearSpy = vi.spyOn(window, 'clearTimeout')
    const { unmount } = render(
      <ProposalList proposals={[{ path: PENDING_PATH, content: PENDING_MD }]} transport={transport} />,
    )

    fireEvent.click(screen.getByTestId('proposal-reject')) // schedules the timer
    const before = clearSpy.mock.calls.length
    unmount()

    expect(clearSpy.mock.calls.length).toBeGreaterThan(before)
    act(() => {
      vi.advanceTimersByTime(5001)
    })
    // No crash / no error — the assertion is that unmount+advance doesn't throw.
  })
})
