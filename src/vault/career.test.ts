/**
 * career parser unit tests (S43).
 *
 * Covers the committed vault fixtures round-tripping through the parsers:
 *   - pipeline: every field (incl. hot/source/outcome) tested per stage
 *   - groupByStage: fixed 4-key canonical order, empty stages present
 *   - courses: progress clamped 0–100, missing next tolerated
 *   - malformed/unknown lines skipped; unknown stage → found (source kept)
 */

import { describe, it, expect } from 'vitest'
import {
  parsePipeline,
  parseCourses,
  groupByStage,
  STAGES,
  type JobEntry,
} from './career'

import pipelineFixture from './__fixtures__/career-pipeline.md?raw'
import coursesFixture from './__fixtures__/career-courses.md?raw'

// ─── helpers ─────────────────────────────────────────────────────────────────

function byCompany(entries: JobEntry[], company: string): JobEntry {
  const found = entries.find((e) => e.company === company)
  if (!found) throw new Error(`no entry for ${company}`)
  return found
}

// ─── parsePipeline — per-stage field coverage ───────────────────────────────

describe('parsePipeline — fixture parses all fields per stage', () => {
  const entries = parsePipeline(pipelineFixture)

  it('parses an applied entry with age/match/next', () => {
    const e = byCompany(entries, 'InstaCo')
    expect(e).toMatchObject({
      company: 'InstaCo',
      role: 'Senior Frontend',
      stage: 'applied',
      age: '6d',
      match: '82%',
      hot: false,
      next: 'follow up with recruiter',
    })
  })

  it('parses an interview entry flagged hot', () => {
    const e = byCompany(entries, 'NorthStar')
    expect(e).toMatchObject({
      company: 'NorthStar',
      role: 'Founding Eng',
      stage: 'interview',
      age: '2d',
      hot: true,
      next: 'prep system design',
    })
  })

  it('parses a found entry sourced from the job-scout agent', () => {
    const e = byCompany(entries, 'Acme')
    expect(e).toMatchObject({
      company: 'Acme',
      role: 'SWE II',
      stage: 'found',
      match: '71%',
      source: 'job-scout',
      hot: false,
    })
  })

  it('parses a closed entry with an outcome', () => {
    const e = byCompany(entries, 'OldCorp')
    expect(e).toMatchObject({
      company: 'OldCorp',
      role: 'Staff',
      stage: 'closed',
      outcome: 'rejected',
      hot: false,
    })
  })

  it('omits absent optional fields (no age/match/next keys)', () => {
    const e = byCompany(entries, 'OldCorp')
    expect(e).not.toHaveProperty('age')
    expect(e).not.toHaveProperty('match')
    expect(e).not.toHaveProperty('next')
    expect(e).not.toHaveProperty('source')
  })
})

// ─── DoD #4 — malformed skipped, unknown stage → found, source preserved ────

describe('parsePipeline — robustness', () => {
  it('skips prose and title-less lines', () => {
    const entries = parsePipeline(pipelineFixture)
    // 6 valid `- Company — Role` lines; prose + the empty-title line are dropped.
    expect(entries).toHaveLength(6)
    expect(entries.some((e) => e.company === '')).toBe(false)
  })

  it('maps an unknown stage to found while preserving source', () => {
    const e = byCompany(parsePipeline(pipelineFixture), 'Initech')
    expect(e.stage).toBe('found')
    expect(e.source).toBe('job-scout')
  })

  it('never throws on arbitrary junk', () => {
    expect(() => parsePipeline('garbage\n- \n-\n   \n# heading')).not.toThrow()
    expect(parsePipeline('')).toEqual([])
  })

  it('defaults stage to found when the field is absent', () => {
    const [e] = parsePipeline('- SoloCo — Hacker (next:: apply)')
    expect(e!.stage).toBe('found')
    expect(e!.hot).toBe(false)
  })

  it('tolerates a missing role', () => {
    const [e] = parsePipeline('- JustACompany (stage:: found)')
    expect(e!.company).toBe('JustACompany')
    expect(e!.role).toBe('')
  })
})

// ─── DoD #2 — groupByStage: fixed 4 keys, canonical order, empty present ─────

describe('groupByStage', () => {
  it('returns exactly the 4 canonical stages in fixed order', () => {
    const groups = groupByStage(parsePipeline(pipelineFixture))
    expect(Object.keys(groups)).toEqual([...STAGES])
  })

  it('keeps empty stages present as empty arrays', () => {
    const groups = groupByStage([]) // nothing at all
    expect(Object.keys(groups)).toEqual(['found', 'applied', 'interview', 'closed'])
    for (const stage of STAGES) {
      expect(groups[stage]).toEqual([])
    }
  })

  it('routes each entry into its stage column', () => {
    const groups = groupByStage(parsePipeline(pipelineFixture))
    expect(groups.found.map((e) => e.company).sort()).toEqual(
      ['Acme', 'Globex', 'Initech'].sort(),
    )
    expect(groups.applied.map((e) => e.company)).toEqual(['InstaCo'])
    expect(groups.interview.map((e) => e.company)).toEqual(['NorthStar'])
    expect(groups.closed.map((e) => e.company)).toEqual(['OldCorp'])
  })
})

// ─── DoD #3 — courses: progress clamp 0–100, missing next tolerated ─────────

describe('parseCourses', () => {
  const courses = parseCourses(coursesFixture)

  it('parses a course with progress/next/domain', () => {
    const c = courses.find((x) => x.name === 'LLM Engineering Cert')!
    expect(c).toMatchObject({
      name: 'LLM Engineering Cert',
      progress: 62,
      next: 'Module 4 quiz ~45min',
      domain: 'Growth',
    })
  })

  it('tolerates a missing next (no next key)', () => {
    const c = courses.find((x) => x.name === 'Rust for Rustaceans')!
    expect(c.progress).toBe(100)
    expect(c).not.toHaveProperty('next')
  })

  it('clamps progress above 100 down to 100', () => {
    const c = courses.find((x) => x.name === 'Overshoot Cram')!
    expect(c.progress).toBe(100)
  })

  it('clamps negative progress up to 0', () => {
    const c = courses.find((x) => x.name === 'Undershoot Cram')!
    expect(c.progress).toBe(0)
  })

  it('skips prose and progress-less lines', () => {
    // 5 valid course lines in the fixture; prose + the no-progress line drop.
    expect(courses).toHaveLength(5)
    expect(courses.some((c) => c.name === 'Missing Progress Course')).toBe(false)
  })

  it('never throws on junk and returns [] for empty input', () => {
    expect(() => parseCourses('nonsense\n- \n#h')).not.toThrow()
    expect(parseCourses('')).toEqual([])
  })
})
