/**
 * Tests for S48 — FleetStrip Home right-stack mini strip (DESIGN_LANGUAGE
 * §4.7 LED, §5 layout).
 *
 * Fixture-first, same convention as AgentsView.test.tsx: joins the static
 * `agentManifest` roster to the committed S47 status fixtures
 * (src/vault/__fixtures__/agents/<good|stale|failed>/status.json) parsed
 * through the real `parseStatus`, with an injected `now` so `healthOf`'s
 * staleness thresholds land deterministically — the exact same mapping
 * AgentsView.test.tsx documents:
 *   good   → email-triage  (ok:true,  last 09:30, 60m cadence)  → ok
 *   stale  → calendar-sync (ok:true,  last 06:00, 60m cadence)  → amber
 *   failed → job-scout     (ok:false, last 09:00)               → red
 * every other manifest agent has no status → idle.
 *
 * `framer-motion.useReducedMotion` is mocked via a hoisted mutable ref (same
 * pattern as AgentsView.test.tsx) so both the reduced (steady) and
 * full-motion (blink) LED branches are exercised.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { FleetStrip } from './FleetStrip'
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

function pillFor(name: string): HTMLElement {
  const pill = screen
    .getAllByTestId('fleet-pill')
    .find((p) => p.getAttribute('data-agent') === name)
  if (!pill) throw new Error(`no pill for agent ${name}`)
  return pill
}
const ledHealth = (name: string) =>
  within(pillFor(name)).getByTestId('fleet-led').getAttribute('data-health')

describe('FleetStrip — DoD #1: health→LED mapping (ok/amber/red + idle for missing)', () => {
  it('renders one pill per manifest agent', () => {
    render(<FleetStrip statuses={fixtureStatuses()} now={NOW} />)
    expect(agentManifest).toHaveLength(7)
    expect(screen.getAllByTestId('fleet-pill')).toHaveLength(7)
  })

  it('maps the three S47 fixtures to their intended LEDs', () => {
    render(<FleetStrip statuses={fixtureStatuses()} now={NOW} />)
    expect(ledHealth('email-triage')).toBe('ok')
    expect(ledHealth('calendar-sync')).toBe('amber')
    expect(ledHealth('job-scout')).toBe('red')
  })

  it('renders idle (no glow) for every agent with no status file', () => {
    render(<FleetStrip statuses={fixtureStatuses()} now={NOW} />)
    expect(ledHealth('daily-brief')).toBe('idle')
    expect(ledHealth('finance-sync')).toBe('idle')
    expect(ledHealth('telegram-bot')).toBe('idle')
    expect(ledHealth('supervisor')).toBe('idle')

    const led = within(pillFor('daily-brief')).getByTestId('fleet-led')
    // §4.7: `.led.idle` has no `box-shadow` glow — only ok/amber/red carry one.
    expect(led.className).not.toContain('shadow-')
  })

  it('renders every agent idle when no statuses are supplied (App default)', () => {
    render(<FleetStrip now={NOW} />)
    const leds = screen.getAllByTestId('fleet-led')
    expect(leds).toHaveLength(7)
    expect(leds.every((l) => l.getAttribute('data-health') === 'idle')).toBe(true)
  })
})

describe('FleetStrip — DoD #2: blink animation class present only on red', () => {
  it('blinks the red LED when motion is allowed', () => {
    rm.value = false
    render(<FleetStrip statuses={fixtureStatuses()} now={NOW} />)
    const led = within(pillFor('job-scout')).getByTestId('fleet-led')
    expect(led.getAttribute('data-health')).toBe('red')
    expect(led.getAttribute('data-animate')).toBe('blink')
  })

  it('holds the red LED steady under reduced motion (no blink)', () => {
    rm.value = true
    render(<FleetStrip statuses={fixtureStatuses()} now={NOW} />)
    const led = within(pillFor('job-scout')).getByTestId('fleet-led')
    expect(led.getAttribute('data-health')).toBe('red')
    expect(led.getAttribute('data-animate')).toBe('none')
  })

  it('never blinks ok/amber/idle LEDs, even with motion allowed', () => {
    rm.value = false
    render(<FleetStrip statuses={fixtureStatuses()} now={NOW} />)
    expect(within(pillFor('email-triage')).getByTestId('fleet-led').getAttribute('data-animate')).toBe(
      'none',
    )
    expect(within(pillFor('calendar-sync')).getByTestId('fleet-led').getAttribute('data-animate')).toBe(
      'none',
    )
    expect(within(pillFor('daily-brief')).getByTestId('fleet-led').getAttribute('data-animate')).toBe(
      'none',
    )
  })
})

describe('FleetStrip — DoD #3: relative last-run at minute/hour/day granularity (fixed now)', () => {
  const FIXED_NOW = Date.parse('2026-07-20T12:00:00Z')

  const statusAt = (agent: string, isoLastRun: string): AgentStatus => ({
    agent,
    last_run: isoLastRun,
    ok: true,
    expected_cadence_min: 60,
  })

  it('shows minute granularity ("12m ago")', () => {
    const statuses = {
      'email-triage': statusAt('email-triage', '2026-07-20T11:48:00Z'), // 12 min before FIXED_NOW
    }
    render(<FleetStrip statuses={statuses} now={FIXED_NOW} />)
    expect(within(pillFor('email-triage')).getByText(/12m ago/)).toBeInTheDocument()
  })

  it('shows hour granularity ("3h ago")', () => {
    const statuses = {
      'calendar-sync': statusAt('calendar-sync', '2026-07-20T09:00:00Z'), // 3h before FIXED_NOW
    }
    render(<FleetStrip statuses={statuses} now={FIXED_NOW} />)
    expect(within(pillFor('calendar-sync')).getByText(/3h ago/)).toBeInTheDocument()
  })

  it('shows day granularity ("5d ago")', () => {
    const statuses = {
      'job-scout': statusAt('job-scout', '2026-07-15T12:00:00Z'), // 5d before FIXED_NOW
    }
    render(<FleetStrip statuses={statuses} now={FIXED_NOW} />)
    expect(within(pillFor('job-scout')).getByText(/5d ago/)).toBeInTheDocument()
  })

  it('shows an honest "never ran" for an agent with no status file', () => {
    render(<FleetStrip statuses={{}} now={FIXED_NOW} />)
    expect(within(pillFor('daily-brief')).getByText(/never ran/)).toBeInTheDocument()
  })
})

describe('FleetStrip — DoD #4: mount structure', () => {
  it('mounts the fleet strip container with agent name + pill for every manifest entry', () => {
    render(<FleetStrip statuses={fixtureStatuses()} now={NOW} />)
    expect(screen.getByTestId('fleet-strip')).toBeInTheDocument()
    for (const agent of agentManifest) {
      expect(within(pillFor(agent.name)).getByText(new RegExp(agent.name))).toBeInTheDocument()
    }
  })
})
