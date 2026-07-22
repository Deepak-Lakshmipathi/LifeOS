/**
 * Tests for S49 — AgentsView fleet table (DESIGN_LANGUAGE §4.8, LED §4.7).
 *
 * Fixture-first: joins the static `agentManifest` roster to the committed S47
 * status fixtures (src/vault/__fixtures__/agents/<good|stale|failed>/status.json)
 * parsed through the real `parseStatus`, with an injected `now` so `healthOf`'s
 * staleness thresholds land deterministically:
 *   good   → email-triage  (ok:true,  last 09:30, 60m cadence)  → ok
 *   stale  → calendar-sync (ok:true,  last 06:00, 60m cadence)  → amber
 *   failed → job-scout     (ok:false, last 09:00)               → red
 * every other manifest agent has no status → idle.
 *
 * `framer-motion.useReducedMotion` is mocked via a hoisted mutable ref so both
 * the reduced (steady) and full-motion (blink) LED branches are exercised; the
 * rest of framer-motion stays real so `motion.span` renders. A `matchMedia`
 * stub is provided defensively for real framer-motion internals under jsdom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { AgentsView } from './AgentsView'
import { agentManifest } from '../../data/agentManifest'
import { parseStatus, type AgentStatus } from '../../vault/agentStatus'

const rm = vi.hoisted(() => ({ value: true }))
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => rm.value }
})

beforeEach(() => {
  rm.value = true
  if (!window.matchMedia) {
    // Defensive: jsdom has no matchMedia; real framer-motion internals may probe it.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  }
})
afterEach(cleanup)

const HERE = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) =>
  readFileSync(
    join(HERE, '..', '..', 'vault', '__fixtures__', 'agents', name, 'status.json'),
    'utf8',
  )

function fixtureStatuses(): Record<string, AgentStatus | null> {
  return {
    'email-triage': parseStatus(fixture('good')),
    'calendar-sync': parseStatus(fixture('stale')),
    'job-scout': parseStatus(fixture('failed')),
  }
}

// now = 10:00Z: email-triage 30m<60m → ok; calendar-sync 240m staleness (>2×60,
// not >4×60) → amber; job-scout ok:false → red regardless.
const NOW = Date.parse('2026-07-14T10:00:00Z')

function rowFor(name: string): HTMLElement {
  const row = screen.getAllByTestId('agent-row').find((r) => r.getAttribute('data-agent') === name)
  if (!row) throw new Error(`no row for agent ${name}`)
  return row
}
const ledHealth = (name: string) =>
  within(rowFor(name)).getByTestId('agent-led').getAttribute('data-health')

describe('AgentsView — DoD #1: full roster renders, status where present else idle', () => {
  it('renders all 7 manifest agents as rows', () => {
    render(<AgentsView statuses={fixtureStatuses()} now={NOW} />)
    expect(agentManifest).toHaveLength(7)
    expect(screen.getAllByTestId('agent-row')).toHaveLength(7)
  })

  it('applies fixture health where present, idle everywhere else', () => {
    render(<AgentsView statuses={fixtureStatuses()} now={NOW} />)
    expect(ledHealth('email-triage')).toBe('ok')
    expect(ledHealth('calendar-sync')).toBe('amber')
    expect(ledHealth('job-scout')).toBe('red')
    // No status file → idle.
    expect(ledHealth('daily-brief')).toBe('idle')
    expect(ledHealth('finance-sync')).toBe('idle')
    expect(ledHealth('telegram-bot')).toBe('idle')
    expect(ledHealth('supervisor')).toBe('idle')
  })

  it('shows the last-run timestamp for a run, dash for idle', () => {
    render(<AgentsView statuses={fixtureStatuses()} now={NOW} />)
    expect(within(rowFor('email-triage')).getByText('2026-07-14 09:30')).toBeInTheDocument()
    expect(within(rowFor('daily-brief')).getByText('—')).toBeInTheDocument()
  })
})

describe('AgentsView — DoD #2: infra badges (correct tint + cadence)', () => {
  const badge = (name: string) => within(rowFor(name)).getByTestId('infra-badge')

  it('renders GH ACTIONS / THIS PC / VPS with the right tint class and cadence', () => {
    render(<AgentsView statuses={fixtureStatuses()} now={NOW} />)

    expect(badge('email-triage').getAttribute('data-infra')).toBe('gha')
    expect(badge('email-triage').textContent).toBe('GH ACTIONS · hourly')
    expect(badge('email-triage').className).toContain('text-[#c4b5fd]')

    expect(badge('finance-sync').getAttribute('data-infra')).toBe('pc')
    expect(badge('finance-sync').textContent).toBe('THIS PC · daily')
    expect(badge('finance-sync').className).toContain('text-[#fcd34d]')

    expect(badge('telegram-bot').getAttribute('data-infra')).toBe('vps')
    expect(badge('telegram-bot').textContent).toBe('VPS · always-on')
    expect(badge('telegram-bot').className).toContain('text-[#86efac]')
  })
})

describe('AgentsView — DoD #3: failed agent → red blinking LED + red note', () => {
  it('blinks the red LED when motion is allowed', () => {
    rm.value = false
    render(<AgentsView statuses={fixtureStatuses()} now={NOW} />)
    const led = within(rowFor('job-scout')).getByTestId('agent-led')
    expect(led.getAttribute('data-health')).toBe('red')
    expect(led.getAttribute('data-animate')).toBe('blink')
  })

  it('holds the red LED steady under reduced motion', () => {
    rm.value = true
    render(<AgentsView statuses={fixtureStatuses()} now={NOW} />)
    const led = within(rowFor('job-scout')).getByTestId('agent-led')
    expect(led.getAttribute('data-health')).toBe('red')
    expect(led.getAttribute('data-animate')).toBe('none')
  })

  it('renders the failed run note red (#fca5a5) with the error text', () => {
    render(<AgentsView statuses={fixtureStatuses()} now={NOW} />)
    const note = within(rowFor('job-scout')).getByTestId('agent-note')
    expect(note.className).toContain('text-[#fca5a5]')
    expect(note.textContent).toContain('LinkedIn auth expired')
  })

  it('keeps a healthy run note dim, not red', () => {
    render(<AgentsView statuses={fixtureStatuses()} now={NOW} />)
    const note = within(rowFor('email-triage')).getByTestId('agent-note')
    expect(note.className).toContain('text-dim')
    expect(note.className).not.toContain('#fca5a5')
    expect(note.textContent).toContain('4 flagged, 1 draft')
  })
})

describe('AgentsView — DoD #4: §4.8 grid / structure', () => {
  it('rows use the verbatim 14px 1.4fr 1fr 1fr 1.6fr grid', () => {
    render(<AgentsView now={NOW} />)
    const row = screen.getAllByTestId('agent-row')[0]
    expect(row.className).toContain('grid-cols-[14px_1.4fr_1fr_1fr_1.6fr]')
  })

  it('mounts the fleet table container', () => {
    render(<AgentsView now={NOW} />)
    expect(screen.getByTestId('fleet-table')).toBeInTheDocument()
  })
})

describe('AgentsView — idle default (App mounts with no props)', () => {
  it('renders every agent idle when no statuses are supplied', () => {
    render(<AgentsView now={NOW} />)
    const leds = screen.getAllByTestId('agent-led')
    expect(leds).toHaveLength(7)
    expect(leds.every((l) => l.getAttribute('data-health') === 'idle')).toBe(true)
  })
})
