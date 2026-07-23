/**
 * AttentionCard fixture + variant tests (S37).
 *
 * Renders straight off the COMMITTED S36 fixture (src/vault/__fixtures__/
 * mail-attention.md) via the real `parseAttention` (src/vault/mail.ts), so
 * this test doubles as a guard on the checked-in vault file — same
 * convention as HabitsCard.test.tsx / TodayCard.test.tsx. `items` short-
 * circuits AttentionCard's own vault fetch — GitTransport is never
 * constructed for these tests.
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { AttentionCard } from './AttentionCard'
import { parseAttention, type AttentionItem } from '../../vault/mail'
import ATTENTION_MD from '../../vault/__fixtures__/mail-attention.md?raw'

const items = parseAttention(ATTENTION_MD)

describe('AttentionCard — fixture render (DoD 1)', () => {
  it('renders exactly one row per unhandled item (5 of the fixture\'s 6 parsed items)', () => {
    render(<AttentionCard items={items} />)
    expect(items.filter((i) => i.handled)).toHaveLength(1) // sanity: fixture still has exactly 1 handled item
    expect(screen.getAllByTestId('attention-row')).toHaveLength(5)
  })

  it('hides the handled item ("Recruiter reply — InstaCo") entirely', () => {
    render(<AttentionCard items={items} />)
    expect(screen.queryByText('Recruiter reply — InstaCo')).not.toBeInTheDocument()
  })

  it('heading reads "Needs you · N" with N = unhandled count', () => {
    render(<AttentionCard items={items} />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('Needs you · 5')
  })
})

describe('AttentionCard — icon tint per label (DoD 2)', () => {
  // The fixture's only `job` item is handled (hidden by DoD 1), so exercise
  // all five label variants — including `job` — via a synthetic unhandled
  // fixture built from real AttentionItem shapes (no re-parsing, no new
  // fields invented).
  const allLabelsUnhandled: AttentionItem[] = [
    { title: 'Client money item', label: 'client-money', from: 'a@b.c', waitingHours: 1, handled: false },
    { title: 'Bill item', label: 'bill', from: 'a@b.c', waitingHours: 1, handled: false },
    { title: 'Job item', label: 'job', from: 'a@b.c', waitingHours: 1, handled: false },
    { title: 'Agent failure item', label: 'agent-failure', from: 'a@b.c', waitingHours: 1, handled: false },
    { title: 'Other item', label: 'other', from: 'a@b.c', waitingHours: 1, handled: false },
  ]

  it.each([
    ['client-money', 'bg-[rgba(56,189,248,.15)]'],
    ['bill', 'bg-[rgba(251,191,36,.15)]'],
    ['job', 'bg-[rgba(167,139,250,.16)]'],
    ['agent-failure', 'bg-[rgba(248,113,113,.15)]'],
    ['other', 'bg-[rgba(255,255,255,.06)]'],
  ] as const)('label %s gets its §4.4 icon tint class', (label, tintClass) => {
    render(<AttentionCard items={allLabelsUnhandled} />)
    const row = screen.getAllByTestId('attention-row').find((r) => r.getAttribute('data-label') === label)
    expect(row).toBeDefined()
    const icon = row!.querySelector('[data-testid="attention-icon"]')!
    expect(icon.className).toContain(tintClass)
  })
})

describe('AttentionCard — provenance sub-line (DoD 3, §8)', () => {
  it('every row names the flagging agent (email-triage) and the label', () => {
    render(<AttentionCard items={items} />)
    const subLines = screen.getAllByTestId('attention-provenance')
    expect(subLines).toHaveLength(5)
    for (const el of subLines) {
      expect(el.textContent).toMatch(/email-triage flagged as/)
    }
  })

  it('the client-money row reads the §4.4 worked example text exactly', () => {
    render(<AttentionCard items={items} />)
    const row = screen
      .getAllByTestId('attention-row')
      .find((r) => r.getAttribute('data-label') === 'client-money')!
    const sub = row.querySelector('[data-testid="attention-provenance"]')!
    expect(sub.textContent).toBe('waiting 26h · email-triage flagged as client / money')
  })
})

describe('AttentionCard — sort by waiting desc (DoD 4)', () => {
  it('rows are ordered by waitingHours descending', () => {
    render(<AttentionCard items={items} />)
    const rows = screen.getAllByTestId('attention-row')
    const waitingTexts = rows.map((r) => r.querySelector('[data-testid="attention-provenance"]')!.textContent!)
    const hours = waitingTexts.map((t) => Number(t.match(/waiting (\d+)h/)![1]))
    const sorted = [...hours].sort((a, b) => b - a)
    expect(hours).toEqual(sorted)
    // Concretely: bill (72h) first, client-money (26h) second, agent-failure
    // (12h) third, other/newsletter (5h) fourth, other/no-waiting (0h) last.
    expect(hours).toEqual([72, 26, 12, 5, 0])
  })
})

describe('AttentionCard — action button (DoD 5)', () => {
  it('the draft-pointer item shows "Draft ready →"', () => {
    render(<AttentionCard items={items} />)
    const row = screen
      .getAllByTestId('attention-row')
      .find((r) => r.getAttribute('data-label') === 'client-money')!
    const btn = row.querySelector('[data-testid="attention-action"]')!
    expect(btn.textContent).toBe('Draft ready →')
    expect(btn).toHaveAttribute('data-kind', 'draft')
  })

  it('items with no draft pointer show the generic "Open →" placeholder', () => {
    render(<AttentionCard items={items} />)
    const rows = screen.getAllByTestId('attention-row')
    const nonDraftRows = rows.filter((r) => r.getAttribute('data-label') !== 'client-money')
    expect(nonDraftRows).toHaveLength(4)
    for (const row of nonDraftRows) {
      const btn = row.querySelector('[data-testid="attention-action"]')!
      expect(btn.textContent).toBe('Open →')
      expect(btn).toHaveAttribute('data-kind', 'open')
    }
  })
})

describe('AttentionCard — no data (honest empty state)', () => {
  it('renders an empty-state message and "Needs you · 0" when nothing is unhandled', () => {
    const handledOnly: AttentionItem[] = [
      { title: 'Old thing', label: 'bill', from: 'x@y.z', waitingHours: 10, handled: true },
    ]
    render(<AttentionCard items={handledOnly} />)
    expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument()
    expect(screen.queryByTestId('attention-row')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Needs you · 0')
  })
})
