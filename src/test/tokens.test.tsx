/**
 * S20 — Glass Cockpit design tokens.
 * Guards the LOCKED contract (docs/DESIGN_LANGUAGE.md §2): the token values
 * themselves, and that the Tailwind mapping actually compiles to them.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
// @ts-expect-error — tailwind.config.js is plain JS with no type declarations
import tailwindConfig from '../../tailwind.config.js'

const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

/** Compile Tailwind against a snippet of markup and return the emitted CSS. */
async function compile(markup: string): Promise<string> {
  const result = await postcss([
    tailwindcss({
      ...tailwindConfig,
      content: [{ raw: markup, extension: 'html' }],
    }),
  ]).process('@tailwind utilities;', { from: undefined })
  return result.css
}

describe('design tokens (DESIGN_LANGUAGE §2.1)', () => {
  // Spot-checks named by the ticket DoD, plus one per token family.
  it.each([
    ['--bg', '#0b0f1e'],
    ['--bg2', '#10162b'],
    ['--panel', 'rgba(255,255,255,.055)'],
    ['--panel-brd', 'rgba(255,255,255,.09)'],
    ['--txt', '#e8ecf6'],
    ['--dim', '#8b93ab'],
    ['--faint', '#5a6178'],
    ['--d-build', '#f59e0b'],
    ['--d-career', '#38bdf8'],
    ['--d-growth', '#a78bfa'],
    ['--d-admin', '#94a3b8'],
    ['--d-body', '#2dd4bf'],
    ['--d-fin', '#4ade80'],
    ['--d-rel', '#f472b6'],
    ['--good', '#4ade80'],
    ['--warn', '#fbbf24'],
    ['--bad', '#f87171'],
  ])('%s is %s', (token, value) => {
    expect(tokensCss).toContain(`${token}: ${value};`)
  })

  it('is dark-only', () => {
    expect(tokensCss).toContain('color-scheme: dark')
  })
})

describe('tailwind mapping (DESIGN_LANGUAGE §2.4)', () => {
  // Tailwind emits palette colors as `rgb(r g b / <alpha-var>)`, and passes
  // rgba() values through verbatim — assert what it actually emits.
  it('compiles the token classes to contract values', async () => {
    const css = await compile(
      '<div class="bg-panel text-dim rounded-card backdrop-blur-card max-w-shell text-domain-build border-panel-brd"></div>'
    )
    expect(css).toContain('background-color: rgba(255,255,255,.055)') // bg-panel
    expect(css).toContain('border-color: rgba(255,255,255,.09)') //      border-panel-brd
    expect(css).toContain('rgb(139 147 171') //                          text-dim   #8b93ab
    expect(css).toContain('rgb(245 158 11') //                           domain-build #f59e0b
    expect(css).toContain('border-radius: 18px') //                      rounded-card
    expect(css).toContain('blur(16px)') //                               backdrop-blur-card
    expect(css).toContain('max-width: 1180px') //                        max-w-shell
  })

  it('keeps v1 classes compiling until each view is restyled (S21+)', async () => {
    const css = await compile('<div class="bg-apple-blue rounded-ios shadow-glass-md"></div>')
    expect(css).toContain('rgb(0 122 255') // #007AFF
    expect(css).toContain('border-radius: 12px')
  })
})

describe('token-consuming component', () => {
  it('renders', () => {
    render(
      <div data-testid="panel" className="bg-panel rounded-card backdrop-blur-card text-txt">
        Glass
      </div>
    )
    // jest-dom isn't installed in this suite — assert on classList directly.
    const el = screen.getByTestId('panel')
    expect(el.classList.contains('bg-panel')).toBe(true)
    expect(el.classList.contains('rounded-card')).toBe(true)
  })
})
