/**
 * Tests for S53 — SupervisorCard (DESIGN_LANGUAGE §4.8 supervisor report card).
 *
 * Fixture-first: renders the real S52 fixture (`supervisor-report.md`) through
 * the component's own `parseReport` call and asserts against the DoD:
 *   #1 all rendered sections appear (Fleet week / Concerns), and numbers
 *      inside prose get the metric-accent treatment.
 *   #2 no report → quiet empty state, no crash.
 *   #3 Proposals render as a count/pointer only — no approve/reject controls.
 */
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { SupervisorCard } from './SupervisorCard'

afterEach(cleanup)

/** Multiple `[data-testid="supervisor-section"]` nodes can render; pick by heading. */
function sectionFor(heading: string): HTMLElement {
  const section = screen
    .getAllByTestId('supervisor-section')
    .find((el) => el.getAttribute('data-heading') === heading)
  if (!section) throw new Error(`no supervisor-section rendered for heading "${heading}"`)
  return section
}

const HERE = dirname(fileURLToPath(import.meta.url))
const REPORT_MD = readFileSync(
  join(HERE, '..', '..', 'vault', '__fixtures__', 'supervisor-report.md'),
  'utf8',
)

describe('SupervisorCard — DoD #1: fixture renders all sections + metric accent', () => {
  it('mounts the card', () => {
    render(<SupervisorCard reportMd={REPORT_MD} />)
    expect(screen.getByTestId('supervisor-card')).toBeInTheDocument()
  })

  it('renders the Fleet week section with its prose', () => {
    render(<SupervisorCard reportMd={REPORT_MD} />)
    const section = sectionFor('Fleet week')
    expect(section.textContent).toContain('email-triage')
    expect(section.textContent).toContain('168 runs')
    expect(section.textContent).toContain('job-scout')
  })

  it('renders the Concerns section', () => {
    render(<SupervisorCard reportMd={REPORT_MD} />)
    const section = sectionFor('Concerns')
    expect(section.textContent).toContain('calendar-sync stale twice')
  })

  it('highlights numbers inside prose with the metric accent (#c4b5fd, 600)', () => {
    render(<SupervisorCard reportMd={REPORT_MD} />)
    const section = sectionFor('Fleet week')
    const metrics = within(section).getAllByTestId('supervisor-metric')
    expect(metrics.length).toBeGreaterThan(0)

    const metricTexts = metrics.map((m) => m.textContent)
    expect(metricTexts).toContain('168')
    expect(metricTexts).toContain('2')
    expect(metricTexts).toContain('8.1')

    for (const m of metrics) {
      expect(m.className).toContain('text-[#c4b5fd]')
      expect(m.className).toContain('font-semibold')
    }
  })

  it('does not swallow the non-numeric prose around a highlighted metric', () => {
    render(<SupervisorCard reportMd={REPORT_MD} />)
    const section = sectionFor('Fleet week')
    expect(section.textContent).toContain('runs, 2 failures, avg 8.1s')
  })
})

describe('SupervisorCard — DoD #3: proposals render as a count/pointer only', () => {
  it('shows a proposal count, not the proposal link/body', () => {
    render(<SupervisorCard reportMd={REPORT_MD} />)
    const proposals = screen.getByTestId('supervisor-proposals')
    expect(proposals.textContent).toContain('1')
    expect(proposals.textContent).toMatch(/proposal/i)
    expect(proposals.textContent).not.toContain('[[proposals/')
  })

  it('renders no approve/reject controls (that UI is S54, not this slice)', () => {
    render(<SupervisorCard reportMd={REPORT_MD} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})

describe('SupervisorCard — DoD #2: missing report → empty state, no crash', () => {
  it('renders the quiet empty state when reportMd is null', () => {
    render(<SupervisorCard reportMd={null} />)
    expect(screen.getByTestId('supervisor-empty')).toHaveTextContent('No supervisor report yet')
    expect(screen.queryByTestId('supervisor-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('supervisor-proposals')).not.toBeInTheDocument()
  })

  it('renders the quiet empty state when reportMd is omitted', () => {
    render(<SupervisorCard />)
    expect(screen.getByTestId('supervisor-empty')).toHaveTextContent('No supervisor report yet')
  })

  it('renders the quiet empty state for an empty-string report, without throwing', () => {
    expect(() => render(<SupervisorCard reportMd="" />)).not.toThrow()
    expect(screen.getByTestId('supervisor-empty')).toBeInTheDocument()
  })
})

describe('SupervisorCard — card chrome (§4.8: purple-tinted, border .35 / bg .06)', () => {
  it('carries the §4.8 border and background literals', () => {
    render(<SupervisorCard reportMd={REPORT_MD} />)
    const card = screen.getByTestId('supervisor-card')
    expect(card.className).toContain('rgba(167,139,250,.35)')
    expect(card.className).toContain('rgba(167,139,250,.06)')
  })
})
