/**
 * S59 — responsive tab bar metrics. TabBar.tsx's buttons now use CSS
 * `clamp()` for horizontal padding and font-size so all five labels
 * (Home · Tasks · Money · Career · Agents) fit down to a 320px viewport
 * without wrapping, clipping, or falling back to icons/abbreviations
 * (ticket DoD #1 and #4), while ≥~800px reproduces S58's fixed desktop
 * metrics exactly (DoD #2).
 *
 * jsdom has no real layout engine — `getBoundingClientRect`, `scrollWidth`,
 * and `clientWidth` all read back 0 regardless of applied CSS (verified by
 * hand before writing this file), and its CSSOM parser drops `clamp()`
 * values entirely rather than resolving them, so neither approach can
 * exercise real box-model output here. Instead this file parses the *actual*
 * `clamp()` expressions TabBar renders straight out of each button's
 * `className` (so a regression to fixed metrics changes what gets parsed,
 * not a hand-duplicated constant), resolves them at specific viewport widths
 * using the CSS spec's own definition of `vw` (`Xvw` == `X% of the viewport
 * width`, a fixed unit conversion — not something that depends on jsdom's
 * box model), and combines that with real Helvetica/Arial per-character
 * advance widths for the five exact labels to get a defensible px estimate
 * of the rendered row width at each DoD-listed viewport (320 / 390 / 1280).
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { TabBar, TABS } from './TabBar'

// Real Helvetica/Arial advance widths (per 1000 em units) for every letter
// used across the five tab labels — close enough to the shell's system-ui/
// -apple-system font stack to size this conservatively. jsdom ships no
// canvas 2D context (no `canvas` package in this project), so `measureText`
// isn't available as an alternative.
const CHAR_WIDTH_PER_1000: Record<string, number> = {
  H: 722, o: 556, m: 556, e: 556, T: 611, a: 556, s: 500, k: 500,
  M: 833, n: 556, y: 500, C: 722, r: 333, A: 667, g: 556, t: 278,
}

function textWidthPx(label: string, fontSizePx: number): number {
  const units = [...label].reduce((sum, ch) => sum + (CHAR_WIDTH_PER_1000[ch] ?? 600), 0)
  return (units / 1000) * fontSizePx
}

/**
 * Resolves `clamp(min, Xvw, max)` the way CSS defines it — `vw` is a fixed
 * unit conversion (`X% of viewport width`), so this is exact arithmetic, not
 * a jsdom layout simulation.
 */
function resolveClamp(min: number, vw: number, max: number, viewportPx: number): number {
  const preferred = (vw / 100) * viewportPx
  return Math.min(max, Math.max(min, preferred))
}

/** Pulls the three `clamp()` numbers out of a rendered Tailwind arbitrary-value class, e.g. `px-[clamp(6px,2.5vw,20px)]`. */
function clampFromClassName(className: string, prefix: 'px' | 'text'): [number, number, number] | null {
  const re = new RegExp(`${prefix}-\\[clamp\\(([\\d.]+)px,([\\d.]+)vw,([\\d.]+)px\\)\\]`)
  const m = className.match(re)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

const LABELS = ['Home', 'Tasks', 'Money', 'Career', 'Agents']

describe('TabBar — S59 responsive metrics', () => {
  it('renders all five labels unabbreviated, identically at every DoD width (320 / 390 / 1280)', () => {
    render(<TabBar active="home" onTabChange={() => {}} />)
    const bar = screen.getByTestId('tab-bar')
    const labels = within(bar).getAllByRole('button').map((b) => b.textContent)
    // TabBar's label rendering has no width-keyed branch, so one render's
    // markup already answers this for every viewport — asserted per-width
    // below for documentation value against the ticket's explicit test list.
    for (const w of [320, 390, 1280]) {
      expect(labels, `labels must be identical (not abbreviated/iconified) at ${w}px`).toEqual(LABELS)
    }
  })

  it('data-testid="tab-bar" and aria-current="page" on the active tab survive (DoD #3)', () => {
    render(<TabBar active="career" onTabChange={() => {}} />)
    const bar = screen.getByTestId('tab-bar')
    expect(bar).toBeInTheDocument()
    expect(within(bar).getByText('Career')).toHaveAttribute('aria-current', 'page')
    expect(within(bar).getByText('Home')).not.toHaveAttribute('aria-current')
  })

  it('the track keeps shrink-to-fit (w-max) sizing plus a max-w-full safety cap — never a full-bleed bar', () => {
    render(<TabBar active="home" onTabChange={() => {}} />)
    const bar = screen.getByTestId('tab-bar')
    expect(bar.className).toMatch(/\bw-max\b/)
    expect(bar.className).toMatch(/\bmax-w-full\b/)
  })

  it('at a 320px viewport the five fluid-clamp buttons fit inside the shell content width, with room to spare (DoD #1)', () => {
    render(<TabBar active="home" onTabChange={() => {}} />)
    const buttons = within(screen.getByTestId('tab-bar')).getAllByRole('button')
    const pad = clampFromClassName(buttons[0].className, 'px')
    const font = clampFromClassName(buttons[0].className, 'text')
    expect(pad, 'button must use a fluid px-[clamp(...)] class, not a fixed px-N').not.toBeNull()
    expect(font, 'button must use a fluid text-[clamp(...)] class, not a fixed text-[Npx]').not.toBeNull()
    const [padMin, padVw, padMax] = pad!
    const [fontMin, fontVw, fontMax] = font!

    const VIEWPORT = 320
    // App.tsx's shell: `mx-auto max-w-shell px-4 ...` — 16px gutter each side
    // below the `sm` (640px) breakpoint where `sm:px-6` would take over.
    const SHELL_GUTTER_PX = 16
    // nav.tabs track: `p-1` (4px) + `border` (1px) each side (§4.1).
    const TRACK_CHROME_PX = (4 + 1) * 2
    const availableForRow = VIEWPORT - SHELL_GUTTER_PX * 2 - TRACK_CHROME_PX

    const padPx = resolveClamp(padMin, padVw, padMax, VIEWPORT)
    const fontPx = resolveClamp(fontMin, fontVw, fontMax, VIEWPORT)
    const rowWidth = TABS.reduce((sum, { label }) => sum + padPx * 2 + textWidthPx(label, fontPx), 0)

    expect(rowWidth).toBeLessThanOrEqual(availableForRow)
  })

  it('at ≥800px the resolved metrics equal S58\'s fixed desktop baseline — 20px padding / 14px font — well inside the shell\'s 841px breakpoint (DoD #2)', () => {
    render(<TabBar active="home" onTabChange={() => {}} />)
    const buttons = within(screen.getByTestId('tab-bar')).getAllByRole('button')
    const pad = clampFromClassName(buttons[0].className, 'px')
    const font = clampFromClassName(buttons[0].className, 'text')
    expect(pad).not.toBeNull()
    expect(font).not.toBeNull()
    const [padMin, padVw, padMax] = pad!
    const [fontMin, fontVw, fontMax] = font!

    for (const w of [841, 1280]) {
      expect(resolveClamp(padMin, padVw, padMax, w)).toBe(20)
      expect(resolveClamp(fontMin, fontVw, fontMax, w)).toBe(14)
    }
  })
})
