/**
 * briefs parser unit tests (S50).
 *
 * Covers the numbered DoD:
 *  1. parseBrief roundtrips the exact markdown agents/daily-brief/brief.mjs
 *     writes into exactly 5 non-empty lines.
 *  2. latestBriefPath agrees with the agent's own briefFilePath for the same
 *     date, in both Date and string input forms.
 *  Tolerant parsing: missing file, no bullets, and blank bullets all fold to
 *  `[]` rather than throwing or returning garbage.
 */

import { describe, it, expect } from 'vitest'
import { parseBrief, latestBriefPath } from './briefs'

const FIVE_LINES = [
  'Win: ship the S50 daily brief agent.',
  '10:00 Client call — NorthStar handoff.',
  'Meera (NorthStar) is waiting 26h on a quote.',
  'Course study block is on a 6-day streak — keep it alive.',
  'Net worth is ₹18.4L, up 2.1% this month.',
]

const FIXTURE_MD = [
  '# Briefs/2026-07-23.md',
  '',
  ...FIVE_LINES.map((l) => `- ${l}`),
  '',
].join('\n')

// ─── parseBrief — happy path ────────────────────────────────────────────────

describe('parseBrief — fixture roundtrips to exactly 5 non-empty lines (S50 DoD)', () => {
  it('parses the exact 5 lines in order', () => {
    expect(parseBrief(FIXTURE_MD)).toEqual(FIVE_LINES)
  })

  it('every parsed line is non-empty after trimming', () => {
    const lines = parseBrief(FIXTURE_MD)
    expect(lines.length).toBe(5)
    expect(lines.every((l) => l.trim().length > 0)).toBe(true)
  })

  it('trims surrounding whitespace on each bullet', () => {
    const md = '# Briefs/2026-07-23.md\n\n-    padded line   \n- another\n'
    expect(parseBrief(md)).toEqual(['padded line', 'another'])
  })
})

// ─── parseBrief — tolerant on malformed/missing input ──────────────────────

describe('parseBrief — tolerant, never throws (missing/malformed → [])', () => {
  it('returns [] for null/undefined', () => {
    expect(parseBrief(null)).toEqual([])
    expect(parseBrief(undefined)).toEqual([])
  })

  it('returns [] for empty string', () => {
    expect(parseBrief('')).toEqual([])
  })

  it('returns [] when there are no bullet lines at all', () => {
    expect(parseBrief('# Briefs/2026-07-23.md\n\nJust prose, no bullets.\n')).toEqual([])
  })

  it('skips blank/whitespace-only bullets rather than including them', () => {
    const md = '- real line\n-    \n- \n- another real line\n'
    expect(parseBrief(md)).toEqual(['real line', 'another real line'])
  })

  it('ignores non-bullet lines interspersed with bullets', () => {
    const md = '# heading\nsome prose\n- one\nmore prose\n- two\n'
    expect(parseBrief(md)).toEqual(['one', 'two'])
  })
})

// ─── latestBriefPath — agrees with the agent's briefFilePath ───────────────

describe('latestBriefPath — path helper both PWA and agent compute identically', () => {
  it('accepts an ISO date string directly', () => {
    expect(latestBriefPath('2026-07-23')).toBe('Briefs/2026-07-23.md')
  })

  it('accepts a Date, using its UTC calendar date', () => {
    expect(latestBriefPath(new Date('2026-07-23T00:00:00Z'))).toBe('Briefs/2026-07-23.md')
  })

  it('slices a longer ISO timestamp string down to the date', () => {
    expect(latestBriefPath('2026-07-23T09:30:00.000Z')).toBe('Briefs/2026-07-23.md')
  })

  it('defaults to now when called with no argument', () => {
    const path = latestBriefPath()
    expect(path).toMatch(/^Briefs\/\d{4}-\d{2}-\d{2}\.md$/)
  })
})
