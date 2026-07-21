/**
 * Tests for S40 — BillsList (DESIGN_LANGUAGE §4.9 "Bills row" + §8 provenance).
 *
 * DoD #4: due-soon red at ≤7 days, paid ✓ dimmed, provenance sub shown.
 * Driven off the real S39 committed fixture
 * (src/vault/__fixtures__/finance-bills.md) parsed through `parseBills`, so
 * this doubles as a fixture-first integration check, not just a unit test
 * against hand-written objects.
 */
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { BillsList } from './BillsList'
import { parseBills, type Bill } from '../../vault/finance'

afterEach(cleanup)

const HERE = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) =>
  readFileSync(join(HERE, '..', '..', 'vault', '__fixtures__', `finance-${name}.md`), 'utf8')

// Matches the boundary fixed in finance.test.ts's dueInDays suite.
const TODAY = '2026-07-15'

describe('BillsList — fixture-driven (S39 finance-bills.md)', () => {
  const bills = parseBills(fixture('bills'))
  // Electricity due 2026-07-20 (5d, unpaid) · Rent due 2026-07-05 (paid) ·
  // Internet due 2026-07-22 (7d, unpaid) — Water/"Missing amount" dropped by the parser.

  it('renders one row per parsed bill', () => {
    render(<BillsList bills={bills} now={TODAY} />)
    expect(screen.getAllByTestId('bill-row')).toHaveLength(3)
  })

  it('flags due-soon (≤7 days) in red for unpaid bills, at and inside the boundary', () => {
    render(<BillsList bills={bills} now={TODAY} />)
    const rows = screen.getAllByTestId('bill-row')

    const electricity = rows.find((r) => r.textContent?.includes('Electricity'))!
    const internet = rows.find((r) => r.textContent?.includes('Internet'))!

    expect(electricity).toHaveAttribute('data-due-soon', 'true') // 5 days out
    expect(internet).toHaveAttribute('data-due-soon', 'true') // exactly 7 days out (boundary)
    expect(electricity.querySelector('.dn')).not.toBeNull()
    expect(internet.querySelector('.dn')).not.toBeNull()
  })

  it('shows paid bills as a dimmed ✓, not a due countdown', () => {
    render(<BillsList bills={bills} now={TODAY} />)
    const rent = screen.getAllByTestId('bill-row').find((r) => r.textContent?.includes('Rent'))!

    expect(rent).toHaveAttribute('data-paid', 'true')
    expect(rent.textContent).toContain('✓ paid')
    expect(rent.querySelector('.dn')).toBeNull()
  })

  it('shows a provenance sub-line naming the source (§8)', () => {
    render(<BillsList bills={bills} now={TODAY} />)
    const rows = screen.getAllByTestId('bill-row')

    const electricity = rows.find((r) => r.textContent?.includes('Electricity'))!
    const rent = rows.find((r) => r.textContent?.includes('Rent'))!

    expect(electricity.textContent).toContain('auto-detected from Gmail')
    expect(rent.textContent).toContain('added manually')
  })

  it('right-aligns tabular money values formatted via formatINR', () => {
    render(<BillsList bills={bills} now={TODAY} />)
    // formatINR(2340) === '₹2340'... actually below 1000 threshold is plain,
    // 2340 >= 1e3 -> thousands bucket -> '₹2.3k'.
    expect(screen.getByText('₹2.3k')).toBeInTheDocument() // Electricity
    expect(screen.getByText('₹32k')).toBeInTheDocument() // Rent
    expect(screen.getByText('₹1.2k')).toBeInTheDocument() // Internet
  })
})

describe('BillsList — direct boundary + edge cases', () => {
  const bill = (over: Partial<Bill>): Bill => ({
    name: 'Test bill',
    amount: 1000,
    due: '2026-07-22',
    source: 'manual',
    paid: false,
    ...over,
  })

  it('does not flag a bill due in 8 days (just outside the ≤7 window)', () => {
    render(<BillsList bills={[bill({ due: '2026-07-23' })]} now={TODAY} />)
    const row = screen.getByTestId('bill-row')
    expect(row).toHaveAttribute('data-due-soon', 'false')
    expect(row.querySelector('.dn')).toBeNull()
  })

  it('flags an overdue bill as due-soon too (negative days ≤ 7)', () => {
    render(<BillsList bills={[bill({ due: '2026-07-01' })]} now={TODAY} />)
    const row = screen.getByTestId('bill-row')
    expect(row).toHaveAttribute('data-due-soon', 'true')
    expect(row.textContent).toContain('overdue')
  })

  it('an unknown provenance source still renders a sub-line', () => {
    render(<BillsList bills={[bill({ source: 'telegram' })]} now={TODAY} />)
    expect(screen.getByText(/telegram/)).toBeInTheDocument()
  })
})
