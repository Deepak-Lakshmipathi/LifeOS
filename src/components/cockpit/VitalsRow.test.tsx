/**
 * S26 — VitalsRow (DESIGN_LANGUAGE §4.2 / §5), later reshaped by S60.
 *
 * S60 (owner feedback items 3+4) retires the Warmth tile — warmth moves to
 * the Aurora background tint (see `src/lib/warmthTint.ts` +
 * `src/components/glass/Aurora.test.tsx`) — and gives its vacated first slot
 * to Completion. Covers the numbered DoD:
 *  1. No `data-vital="warmth"` tile and no `data-testid="warmth-bar"`
 *     anywhere; 5 tiles render, Completion first.
 *  2. Completion tile: percent + "<done> done · <open> to do"; an empty task
 *     list renders the honest `—`, not `0%`/`100%`.
 *
 * S41 extends this file for the Net worth + Burn/income tiles:
 *  1. Net worth tile: last series value + signed % delta, `.up`/`.dn` per
 *     sign, both directions.
 *  2. Burn tile: spend vs income for the latest month, sub names both.
 *  3. Missing/empty `networth`/`burn` props → stub `—` fallback, no crash.
 *
 * S45 extends this file for the Pipeline tile:
 *  1. Active-role count (closed excluded) renders as the tile's value.
 *  2. Missing/empty `pipeline` prop → stub `—` fallback, no crash.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { VitalsRow } from './VitalsRow'
import type { Task } from '../../types'
import type { NetworthPoint, BurnMonth } from '../../vault/finance'
import type { JobEntry } from '../../vault/career'

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

/** Minimal Task factory — only `done` matters to VitalsRow now. */
function task(done: boolean, id: string): Task {
  return { id, title: `t-${id}`, done, created_at: 0 }
}

// A generic non-empty task list (1 done / 1 open = 50%), used by the tests
// below that aren't specifically about Completion's own values — it keeps
// the money/pipeline stub-count assertions identical to what they were
// before S60 swapped Warmth for Completion in the first slot.
const SOME_TASKS: Task[] = [task(true, 'a'), task(false, 'b')]

/** Finds a rendered `Vital` tile's root by its `.k` label text. */
function tileFor(container: HTMLElement, label: string): HTMLElement {
  const kEl = Array.from(container.querySelectorAll('.k')).find((el) => el.textContent === label)
  if (!kEl) throw new Error(`no tile labeled "${label}"`)
  return kEl.parentElement as HTMLElement
}

describe('VitalsRow', () => {
  const originalMatchMedia = window.matchMedia
  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.useRealTimers()
  })

  it('renders 5 tiles in the named §5 order, Completion first', () => {
    mockMatchMedia(true) // skip count-up so stub `.v` values are stable
    const { container } = render(<VitalsRow tasks={[]} />)

    const labels = Array.from(container.querySelectorAll('.k')).map((el) => el.textContent)
    expect(labels).toEqual(['Completion', 'Net worth', 'Burn / income', 'Pipeline', 'Streak'])
  })

  it('no warmth tile or warmth bars anywhere in the rendered tree', () => {
    mockMatchMedia(true)
    const { container } = render(<VitalsRow tasks={SOME_TASKS} />)

    expect(container.querySelector('[data-vital="warmth"]')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('warmth-bar')).toHaveLength(0)
    expect(screen.queryByText('Warmth')).not.toBeInTheDocument()
  })

  // ── S60: Completion tile ─────────────────────────────────────────────────

  it('Completion tile shows the percentage plus "<done> done · <open> to do"', () => {
    mockMatchMedia(true)
    const tasks: Task[] = [task(true, 'a'), task(true, 'b'), task(false, 'c'), task(false, 'd')]
    const { container } = render(<VitalsRow tasks={tasks} />)

    const tile = tileFor(container, 'Completion')
    expect(tile.querySelector('.v')).toHaveTextContent('50%')
    expect(tile.querySelector('.s')).toHaveTextContent('2 done · 2 to do')
  })

  it('empty task list renders the honest — for Completion, never 0%/100%', () => {
    mockMatchMedia(true)
    const { container } = render(<VitalsRow tasks={[]} />)

    const tile = tileFor(container, 'Completion')
    expect(tile.querySelector('.v')).toHaveTextContent('—')
    expect(tile.querySelector('.v')).not.toHaveTextContent('0%')
    expect(tile.querySelector('.v')).not.toHaveTextContent('100%')
  })

  it('shows stub tiles as honest placeholders (—), no fake-real numbers', () => {
    mockMatchMedia(true)
    render(<VitalsRow tasks={[]} />)

    // Completion, Net worth, Burn/income, Pipeline, Streak — all 5 stub with
    // an empty task list and no money/pipeline props.
    const dashes = screen.getAllByText('—')
    expect(dashes).toHaveLength(5)
  })

  // ── S41: Net worth + Burn/income tiles ──────────────────────────────────

  it('missing/empty networth + burn props → both tiles fall back to the — stub (no crash)', () => {
    mockMatchMedia(true)
    render(<VitalsRow tasks={SOME_TASKS} />)

    // Net worth, Burn/income, Pipeline, Streak — 4 dashes total (Completion
    // is real here since SOME_TASKS is non-empty).
    expect(screen.getAllByText('—')).toHaveLength(4)
  })

  it('net worth tile: gain vs previous point renders the value with .up direction', () => {
    mockMatchMedia(true)
    const networth: NetworthPoint[] = [
      { date: '2026-06-01', networth: 1_800_000 },
      { date: '2026-07-01', networth: 1_840_000 },
    ]
    const { container } = render(<VitalsRow tasks={SOME_TASKS} networth={networth} />)

    expect(screen.getByText('₹18.4L')).toBeInTheDocument()
    const sub = container.querySelector('.s.up')
    expect(sub).toBeInTheDocument()
    expect(sub).toHaveTextContent('▲')
  })

  it('net worth tile: loss vs previous point renders the value with .dn direction', () => {
    mockMatchMedia(true)
    const networth: NetworthPoint[] = [
      { date: '2026-06-01', networth: 1_800_000 },
      { date: '2026-07-01', networth: 1_710_000 },
    ]
    const { container } = render(<VitalsRow tasks={SOME_TASKS} networth={networth} />)

    expect(screen.getByText('₹17.1L')).toBeInTheDocument()
    const sub = container.querySelector('.s.dn')
    expect(sub).toBeInTheDocument()
    expect(sub).toHaveTextContent('▼')
  })

  it('burn tile: names both spend and income for the latest month', () => {
    mockMatchMedia(true)
    const burn: BurnMonth[] = [{ month: '2026-07', income: 210_000, spend: 96_000 }]
    const { container } = render(<VitalsRow tasks={SOME_TASKS} burn={burn} />)

    expect(screen.getByText('₹96k')).toBeInTheDocument()
    const subText = Array.from(container.querySelectorAll('.s')).map((el) => el.textContent)
    expect(subText.some((t) => t?.includes('spend') && t?.includes('income'))).toBe(true)
  })

  it('burn tile: overspending (spend > income) renders .dn direction', () => {
    mockMatchMedia(true)
    const burn: BurnMonth[] = [{ month: '2026-07', income: 80_000, spend: 96_000 }]
    const { container } = render(<VitalsRow tasks={SOME_TASKS} burn={burn} />)

    const sub = container.querySelector('.s.dn')
    expect(sub).toBeInTheDocument()
  })

  it('count-up preserved: reduced motion still applies to the wired money tiles', () => {
    mockMatchMedia(false) // motion NOT reduced → count-up starts at 0
    const networth: NetworthPoint[] = [
      { date: '2026-06-01', networth: 1_800_000 },
      { date: '2026-07-01', networth: 1_840_000 },
    ]
    render(<VitalsRow tasks={SOME_TASKS} networth={networth} />)

    // Before the count-up timer fires, the Net worth tile has not yet
    // reached its target — the animated `.v` starts at the formatted 0,
    // proving the tile still goes through Vital's count-up, not a static
    // render straight to the final value.
    expect(screen.queryByText('₹18.4L')).not.toBeInTheDocument()
  })

  // ── S45: Pipeline tile ───────────────────────────────────────────────────

  it('missing/empty pipeline prop → Pipeline tile falls back to the — stub (no crash)', () => {
    mockMatchMedia(true)
    render(<VitalsRow tasks={SOME_TASKS} />)

    // Net worth, Burn/income, Pipeline, Streak — still 4 dashes total.
    expect(screen.getAllByText('—')).toHaveLength(4)
  })

  it('pipeline tile: active count (closed excluded) renders as the value', () => {
    mockMatchMedia(true)
    const pipeline: JobEntry[] = [
      { company: 'InstaCo', role: 'Senior Frontend', stage: 'applied', hot: false },
      { company: 'NorthStar', role: 'Founding Eng', stage: 'interview', hot: true },
      { company: 'OldCorp', role: 'Staff', stage: 'closed', hot: false },
    ]
    render(<VitalsRow tasks={SOME_TASKS} pipeline={pipeline} />)

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1 interview')).toBeInTheDocument()
  })

  it('pipeline tile: no dash once real pipeline data is present', () => {
    mockMatchMedia(true)
    const pipeline: JobEntry[] = [
      { company: 'Acme', role: 'SWE II', stage: 'found', hot: false },
    ]
    render(<VitalsRow tasks={SOME_TASKS} pipeline={pipeline} />)

    // Net worth + Burn/income + Streak still stub (no props) → 3 dashes,
    // not 4 — Pipeline itself is no longer one of them (Completion is real
    // since SOME_TASKS is non-empty).
    expect(screen.getAllByText('—')).toHaveLength(3)
  })
})
