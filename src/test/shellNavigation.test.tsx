/**
 * S63 (#173) — the shell must never let a tab panel trap navigation.
 *
 * Test A is the load-bearing red. It does NOT replay the #173 user journey
 * (Domains → Home with the 107-row seed): that replay was measured and it is
 * VACUOUS in jsdom — all five journey variants passed against broken `master`,
 * because the jsdom harness removes the trigger (the render churn inside the
 * 300 ms exit window) while leaving the defect fully armed. That is the #120
 * lesson verbatim.
 *
 * So this tests the INVARIANT rather than the incident: *the shell's
 * correctness must not be a function of any panel's animation behaviour.*
 * A stub panel is mounted that deliberately never discharges its presence
 * obligation, and the shell is required to navigate away from it anyway.
 *
 * No fake timers (framer-motion's rAF driver interacts badly with them and
 * manufactures another vacuous green), no seed, no clock, no timing
 * dependence. The never-completing stub is the deterministic lever.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import App from '../App'

// ---------------------------------------------------------------------------
// The trap panel.
//
// `usePresence()` is framer-motion's *explicit* form of the same obligation a
// `motion` component joins implicitly by declaring `exit` (or `layout` /
// `layoutId`): it calls `register(id)` on the nearest PresenceContext, which
// seeds that child's completion map with `false`. The ack only lands when
// `safeToRemove()` is called. This stub never calls it.
//
// Using `usePresence()` rather than `exit={{...}} transition={{duration: 1e6}}`
// makes the block independent of the animation driver — no rAF, no WAAPI, no
// duration to wait out, and nothing a future framer-motion version could
// short-circuit by finishing an animation early.
//
// It is injected by mocking a real leaf panel module rather than by adding an
// injection seam to `App` — restructuring `App` to make itself testable would
// be scope creep, and the panel identity is irrelevant to the invariant.
// ---------------------------------------------------------------------------
vi.mock('../components/money/MoneyView', async () => {
  const { usePresence } = await import('framer-motion')
  return {
    MoneyView: () => {
      // Registers with any presence context above it; `safeToRemove` (the
      // second tuple slot) is deliberately never called.
      usePresence()
      return <div data-testid="trap-panel">panel that never completes its exit</div>
    },
  }
})

beforeEach(() => {
  // jsdom has no matchMedia; framer-motion's useReducedMotion() reads it.
  // `matches: false` pins the MOTION branch — the whole bug class exists only
  // there (the reduced-motion branch has never declared an `exit`).
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia

  // ADR-0006 test hook: skip the 107-row seed importer. The invariant under
  // test is seed-independent by construction — that is the entire point.
  window.history.pushState({}, '', '/?noseed')
})

afterEach(() => {
  window.history.pushState({}, '', '/')
})

// ─── TEST A — the invariant ─────────────────────────────────────────────────
describe('S63 — shell navigation is independent of panel animation behaviour', () => {
  it('swaps tab panels even when the outgoing panel never completes its presence obligation', async () => {
    render(<App />)
    const bar = () => screen.getByTestId('tab-bar')

    // Home is the default tab and exits cleanly — establishes that the shell
    // navigates at all, so a failure below is attributable to the trap panel.
    expect(await screen.findByText('+ New task')).toBeInTheDocument()

    // Mount the trap panel. (Guards against a vacuous pass: if the module mock
    // silently failed, the real MoneyView would render and this would fail
    // here rather than falsely satisfying the assertions below.)
    fireEvent.click(within(bar()).getByText('Money'))
    expect(await screen.findByTestId('trap-panel')).toBeInTheDocument()

    // Navigate away from it. The trap panel's acknowledgement will never come.
    fireEvent.click(within(bar()).getByText('Home'))

    // 1. The INCOMING panel must mount. Under a `mode="wait"` presence
    //    protocol it is not rendered at all until every descendant ack lands,
    //    so one missing ack is a total blackout — this is the #173 assertion.
    await waitFor(() =>
      expect(
        screen.queryByText('+ New task'),
        'the incoming tab panel never mounted: the shell is blocked waiting on a presence acknowledgement that will never arrive (#173)',
      ).not.toBeNull(),
    )

    // 2. The OUTGOING subtree must be gone. #173 is not merely a blank screen:
    //    the stale panel stays mounted at opacity 0 and remains hit-testable.
    expect(
      screen.queryByTestId('trap-panel'),
      'the outgoing tab panel is still mounted after navigating away — invisible-but-clickable stale content (#173)',
    ).toBeNull()
  })
})

// ─── TEST B — structural ────────────────────────────────────────────────────
// The only thing preventing a future slice from silently re-arming the hazard
// with a single auto-import. Same static-analysis style as
// src/test/syncProvider.test.ts:54 and src/test/tokens.test.tsx:16.
describe('S63 — the shell owns no presence protocol', () => {
  it('src/App.tsx does not reference AnimatePresence — verified by static analysis', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
    const occurrences = appSource.split('AnimatePresence').length - 1
    expect(
      occurrences,
      'src/App.tsx references AnimatePresence. The shell must not host an exit-acknowledgement protocol: any descendant of any panel can join it implicitly (via `exit`, or `layout`/`layoutId`) and there is no timeout to recover. See docs/adr/0015-shell-owns-no-presence-protocol.md (#173).',
    ).toBe(0)
  })
})
