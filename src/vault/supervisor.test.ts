/**
 * supervisor.test.ts — S52 coverage for src/vault/supervisor.ts.
 *
 * DoD:
 *   #1 Fixtures parse to expected structures; unknown sections preserved.
 *   #2 setProposalStatus(pending, "approved") differs from input ONLY on the
 *      status line (byte-diff tested), and round-trips to the approved fixture.
 *   #3 A proposal with an invalid status → treated as pending (safe default).
 *   #4 No changes outside src/vault (structural — not asserted here).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  parseReport,
  parseProposal,
  setProposalStatus,
  type ProposalStatus,
} from './supervisor'

const FIX = join(process.cwd(), 'src', 'vault', '__fixtures__')
const readFix = (name: string) => readFileSync(join(FIX, name), 'utf8')

const REPORT = readFix('supervisor-report.md')
const PENDING = readFix('proposal-pending.md')
const APPROVED = readFix('proposal-approved.md')

// ── DoD #1: fixtures parse to expected structures ────────────────────────────
describe('parseReport (DoD #1)', () => {
  it('lifts the ISO date from the H1', () => {
    expect(parseReport(REPORT).date).toBe('2026-07-13')
  })

  it('splits every H2 into a section, known or not', () => {
    const { sections } = parseReport(REPORT)
    expect(Object.keys(sections)).toEqual(['Fleet week', 'Concerns', 'Proposals', 'Notes'])
  })

  it('preserves section bodies verbatim (inner content kept)', () => {
    const { sections } = parseReport(REPORT)
    expect(sections['Concerns']).toBe('- calendar-sync stale twice (>2h) on 07-11.')
    expect(sections['Proposals']).toBe('- [[proposals/email-triage-2026-07-13]]')
    expect(sections['Fleet week']).toContain('email-triage: 168 runs, 2 failures')
  })

  it('keeps an unknown section rather than dropping it', () => {
    // "Notes" is not one of the contract's named sections — it must survive.
    const { sections } = parseReport(REPORT)
    expect(sections['Notes']).toBe(
      '- Fleet cost held flat week-over-week; no model-tier changes needed.',
    )
  })

  it('is tolerant of empty / missing input', () => {
    expect(parseReport('')).toEqual({ date: '', sections: {} })
    expect(parseReport(null)).toEqual({ date: '', sections: {} })
    expect(parseReport(undefined)).toEqual({ date: '', sections: {} })
  })

  it('falls back to the first ISO date anywhere when the H1 has none', () => {
    const md = '# Weekly supervisor report\n## When\n- generated 2026-07-20\n'
    expect(parseReport(md).date).toBe('2026-07-20')
  })
})

describe('parseProposal (DoD #1)', () => {
  it('parses frontmatter + the three body sections', () => {
    expect(parseProposal(PENDING)).toEqual({
      agent: 'email-triage',
      date: '2026-07-13',
      status: 'pending',
      change: 'Lower draft threshold: also draft for label bill when amount > ₹5,000.',
      diff:
        '```\n' +
        '- draft when: label in {urgent, reply-needed}\n' +
        '+ draft when: label in {urgent, reply-needed} OR (label == bill AND amount > 5000)\n' +
        '```',
      why: '3 bill emails last week needed manual replies.',
    })
  })

  it('reads an approved proposal as approved', () => {
    expect(parseProposal(APPROVED).status).toBe('approved')
  })

  it('strips the inline comment from the status value', () => {
    // The fixture status line carries a "# pending | approved | rejected" comment.
    expect(parseProposal(PENDING).status).toBe('pending')
  })

  it('is tolerant of empty / missing input', () => {
    expect(parseProposal(null)).toEqual({
      agent: '',
      date: '',
      status: 'pending',
      change: '',
      diff: '',
      why: '',
    })
  })

  it('parses CRLF-encoded input identically to LF (no stray \\r in bodies)', () => {
    // Guards against an autocrlf checkout rewriting fixtures to CRLF.
    expect(parseProposal(PENDING.replace(/\n/g, '\r\n'))).toEqual(parseProposal(PENDING))
  })

  it('missing frontmatter → safe empty defaults, status pending', () => {
    const p = parseProposal('## Change\njust a body, no frontmatter\n')
    expect(p.agent).toBe('')
    expect(p.status).toBe('pending')
    expect(p.change).toBe('just a body, no frontmatter')
  })
})

// ── DoD #3: invalid status → pending (safe default) ──────────────────────────
describe('parseProposal invalid status → pending (DoD #3)', () => {
  const cases = ['bogus', 'APPROVED', 'approve', 'yes', '', 'pending!']
  for (const bad of cases) {
    it(`status "${bad}" resolves to pending`, () => {
      const md = `---\nagent: x\ndate: 2026-07-13\nstatus: ${bad}\n---\n## Change\nc\n`
      expect(parseProposal(md).status).toBe('pending')
    })
  }

  it('a status key absent entirely → pending', () => {
    const md = '---\nagent: x\ndate: 2026-07-13\n---\n## Change\nc\n'
    expect(parseProposal(md).status).toBe('pending')
  })
})

// ── DoD #2: surgical, byte-preserving status flip ────────────────────────────
describe('setProposalStatus (DoD #2)', () => {
  it('flips pending → approved changing ONLY the status line', () => {
    const out = setProposalStatus(PENDING, 'approved')
    const before = PENDING.split('\n')
    const after = out.split('\n')

    // Same number of lines, and exactly one line differs.
    expect(after.length).toBe(before.length)
    const diffIdx = before.reduce<number[]>((acc, line, i) => {
      if (line !== after[i]) acc.push(i)
      return acc
    }, [])
    expect(diffIdx.length).toBe(1)

    // …and that one differing line is the status line.
    expect(before[diffIdx[0]!]).toMatch(/^status:/)
    expect(after[diffIdx[0]!]).toMatch(/^status: approved/)
  })

  it('round-trips exactly to the approved fixture (byte-for-byte)', () => {
    expect(setProposalStatus(PENDING, 'approved')).toBe(APPROVED)
    expect(setProposalStatus(APPROVED, 'pending')).toBe(PENDING)
  })

  it('preserves the trailing inline comment on the status line', () => {
    const out = setProposalStatus(PENDING, 'rejected')
    expect(out).toContain('status: rejected # pending | approved | rejected')
  })

  it('is idempotent when the status is already the target', () => {
    expect(setProposalStatus(APPROVED, 'approved')).toBe(APPROVED)
  })

  it('parseProposal sees the new status after a flip', () => {
    for (const s of ['approved', 'rejected', 'pending'] as ProposalStatus[]) {
      expect(parseProposal(setProposalStatus(PENDING, s)).status).toBe(s)
    }
  })

  it('no frontmatter → unchanged no-op', () => {
    const body = '## Change\nno frontmatter here\n'
    expect(setProposalStatus(body, 'approved')).toBe(body)
  })

  it('frontmatter without a status line → unchanged no-op', () => {
    const md = '---\nagent: x\ndate: 2026-07-13\n---\n## Change\nc\n'
    expect(setProposalStatus(md, 'approved')).toBe(md)
  })

  it('touches only the frontmatter status, not a "status:" in the body', () => {
    const md =
      '---\nagent: x\nstatus: pending\n---\n## Change\nold status: pending stays here\n'
    const out = setProposalStatus(md, 'approved')
    expect(out).toContain('old status: pending stays here')
    expect(parseProposal(out).status).toBe('approved')
  })
})
