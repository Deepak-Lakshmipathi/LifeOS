/**
 * Tests for S44 — Career tab (pipeline kanban + courses).
 *
 * Fixture-first (per ticket): reads the S43 committed fixtures
 * (src/vault/__fixtures__/career-*.md), parses them through the real S43
 * parsers, and renders CareerView / PipelineBoard / CoursesCard from that
 * parsed data — zero network, zero fetching inside the components.
 *
 * `framer-motion` is mocked to force `useReducedMotion() -> true` so the
 * course count-up resolves synchronously (no timer-driven flake). The
 * reduced-motion no-op is the app's established pattern (MoneyView, TaskItem).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CareerView } from './CareerView'
import { PipelineBoard } from './PipelineBoard'
import { CoursesCard } from './CoursesCard'
import { parsePipeline, parseCourses, type JobEntry } from '../../vault/career'

vi.mock('framer-motion', () => ({
  useReducedMotion: () => true,
}))

afterEach(cleanup)

const HERE = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) =>
  readFileSync(join(HERE, '..', '..', 'vault', '__fixtures__', `career-${name}.md`), 'utf8')

const fixtureJobs = () => parsePipeline(fixture('pipeline'))
const fixtureCourses = () => parseCourses(fixture('courses'))

describe('CareerView — DoD #1: 4 columns, canonical order, correct counts', () => {
  it('renders the pipeline + courses cards', () => {
    render(<CareerView jobs={fixtureJobs()} courses={fixtureCourses()} />)
    expect(screen.getByTestId('career-pipeline-card')).toBeInTheDocument()
    expect(screen.getByTestId('career-courses-card')).toBeInTheDocument()
  })

  it('renders exactly 4 columns in Found · Applied · Interview · Closed order', () => {
    render(<PipelineBoard jobs={fixtureJobs()} />)
    const cols = screen.getAllByTestId('pipeline-col')
    expect(cols.map((c) => c.getAttribute('data-stage'))).toEqual([
      'found',
      'applied',
      'interview',
      'closed',
    ])
  })

  it('shows the correct per-column counts from the fixture', () => {
    // found: Acme, Globex, Initech(weird→found) = 3; applied: InstaCo = 1;
    // interview: NorthStar = 1; closed: OldCorp = 1. Prose + no-company lines skipped.
    render(<PipelineBoard jobs={fixtureJobs()} />)
    const counts = screen
      .getAllByTestId('pipeline-col')
      .map((c) => within(c).getByTestId('pipeline-col-count').textContent)
    expect(counts).toEqual(['3', '1', '1', '1'])
  })

  it('renders an empty stage as an empty column, not a missing one', () => {
    // Only a single applied job — the other three stages must still render.
    const jobs: JobEntry[] = [
      { company: 'Solo', role: 'Eng', stage: 'applied', hot: false },
    ]
    render(<PipelineBoard jobs={jobs} />)
    const cols = screen.getAllByTestId('pipeline-col')
    expect(cols).toHaveLength(4)
    const found = cols.find((c) => c.getAttribute('data-stage') === 'found')!
    expect(within(found).getByTestId('pipeline-col-count').textContent).toBe('0')
    expect(within(found).queryAllByTestId('job-card')).toHaveLength(0)
  })
})

describe('CareerView — DoD #2: hot / closed / provenance card states', () => {
  it('marks the hot card urgent (⚡ in sub + sky border)', () => {
    render(<PipelineBoard jobs={fixtureJobs()} />)
    const cards = screen.getAllByTestId('job-card')
    const hot = cards.find((c) => c.getAttribute('data-hot') === 'true')!
    expect(hot).toBeDefined()
    expect(hot.getAttribute('data-stage')).toBe('interview') // NorthStar
    expect(hot.className).toContain('border-[rgba(56,189,248,.4)]')
    expect(within(hot).getByTestId('job-card-sub').textContent).toContain('⚡')
  })

  it('dims closed / rejected cards (opacity .55)', () => {
    render(<PipelineBoard jobs={fixtureJobs()} />)
    const closed = screen
      .getAllByTestId('job-card')
      .find((c) => c.getAttribute('data-closed') === 'true')!
    expect(closed.getAttribute('data-stage')).toBe('closed') // OldCorp
    expect(closed.className).toContain('opacity-[.55]')
    expect(within(closed).getByTestId('job-card-sub').textContent).toContain('rejected')
  })

  it('shows provenance on scout-sourced cards (§8)', () => {
    render(<PipelineBoard jobs={fixtureJobs()} />)
    const scouted = screen
      .getAllByTestId('job-card')
      .filter((c) => c.getAttribute('data-source') === 'job-scout')
    // Acme, Globex, Initech are job-scout sourced.
    expect(scouted.length).toBe(3)
    for (const card of scouted) {
      expect(within(card).getByTestId('job-card-sub').textContent).toContain('via job-scout')
    }
  })

  it('non-hot, non-closed cards carry neither urgent border nor dim', () => {
    render(<PipelineBoard jobs={fixtureJobs()} />)
    const instaco = screen
      .getAllByTestId('job-card')
      .find((c) => c.textContent?.includes('InstaCo'))!
    expect(instaco.className).not.toContain('opacity-[.55]')
    expect(instaco.className).toContain('border-transparent')
  })
})

describe('CareerView — DoD #3 & #4: CoursesCard reuses BarMeter, row anatomy', () => {
  it('renders one reused BarMeter track per course (import from ../money/BarMeter)', () => {
    render(<CoursesCard courses={fixtureCourses()} />)
    // 5 valid courses parse (Missing-Progress skipped); each renders the shared
    // S40 BarMeter, whose track testid proves the component was reused, not copied.
    const rows = screen.getAllByTestId('course-row')
    expect(rows).toHaveLength(5)
    expect(screen.getAllByTestId('bar-meter-track')).toHaveLength(5)
  })

  it('shows the % value, count-up resolved under reduced motion, clamped 0–100', () => {
    render(<CoursesCard courses={fixtureCourses()} />)
    const pcts = screen.getAllByTestId('course-pct').map((p) => p.textContent)
    // LLM 62, K8s 15, Rust 100, Overshoot 140→100, Undershoot -10→0
    expect(pcts).toEqual(['62%', '15%', '100%', '100%', '0%'])
  })

  it('uses the growth gradient by default and the body gradient for Body & Mind', () => {
    const courses = [
      { name: 'Growthy', progress: 40, domain: 'Growth' },
      { name: 'Bodyish', progress: 50, domain: 'Body & Mind' },
      { name: 'Untagged', progress: 60 },
    ]
    render(<CoursesCard courses={courses} />)
    const variants = screen.getAllByTestId('bar-meter-track').map((t) => t.getAttribute('data-variant'))
    expect(variants).toEqual(['growth', 'body', 'growth'])
  })

  it('styles the next-lesson pointer per §4.10 (#a5b4fc, 600)', () => {
    render(<CoursesCard courses={fixtureCourses()} />)
    const nexts = screen.getAllByTestId('course-next')
    // LLM cert + K8s carry a next; Rust/Overshoot/Undershoot do not.
    expect(nexts).toHaveLength(2)
    const pointer = nexts[0]!.querySelector('.text-\\[\\#a5b4fc\\]')
    expect(pointer).not.toBeNull()
    expect(pointer!.className).toContain('font-semibold')
    expect(pointer!.textContent).toBe('Module 4 quiz ~45min')
  })
})

describe('CareerView — honest empty states (no fetching, no fake data)', () => {
  it('renders 4 empty columns + "no course progress" when mounted with no props', () => {
    render(<CareerView />)
    expect(screen.getAllByTestId('pipeline-col')).toHaveLength(4)
    expect(screen.getAllByTestId('pipeline-col-count').map((c) => c.textContent)).toEqual([
      '0',
      '0',
      '0',
      '0',
    ])
    expect(screen.getByText('No course progress yet.')).toBeInTheDocument()
  })
})
