/**
 * mail parser unit tests (S36).
 *
 * Proves the `Mail/attention.md` vault contract round-trips: the shipped
 * fixture parses to exactly the expected AttentionItem[], every label
 * variant is covered, handled items are flagged, waiting:: unit conversion
 * (h/d/missing) is exact, unknown labels fall back to `other`, and malformed
 * lines are skipped without throwing.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parseAttention,
  parseAttentionLine,
  type AttentionItem,
} from './mail'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURE = readFileSync(
  join(HERE, '__fixtures__', 'mail-attention.md'),
  'utf-8',
)

function hasKey(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

// ─── fixture round-trip (DoD 1) ──────────────────────────────────────────────

describe('parseAttention — fixture round-trips to expected items (DoD 1)', () => {
  const items = parseAttention(FIXTURE)

  it('parses exactly the 6 well-formed task lines (headings/blank/prose/malformed skipped)', () => {
    expect(items).toHaveLength(6)
  })

  it('round-trips the full item set exactly', () => {
    const expected: AttentionItem[] = [
      {
        title: 'Meera (NorthStar) asked for a revised quote',
        label: 'client-money',
        from: 'meera@northstar.io',
        waitingHours: 26,
        draftPath: 'Mail/drafts/2026-07-14-meera.md',
        handled: false,
      },
      {
        title: 'Electricity bill ₹2,340 due',
        label: 'bill',
        from: 'alerts@bescom.in',
        waitingHours: 72,
        handled: false,
      },
      {
        title: 'Recruiter reply — InstaCo',
        label: 'job',
        from: 't@instaco.dev',
        waitingHours: 0,
        handled: true,
      },
      {
        title: 'Calendar sync agent failed to run',
        label: 'agent-failure',
        from: 'system',
        waitingHours: 12,
        handled: false,
      },
      {
        title: 'Newsletter digest ready to review',
        label: 'other', // unknown label `newsletter-digest` → other
        from: 'digest@substack.com',
        waitingHours: 5,
        handled: false,
      },
      {
        title: 'Ping with no waiting field at all',
        label: 'other',
        from: 'nobody@example.com',
        waitingHours: 0, // missing waiting:: → 0
        handled: false,
      },
    ]
    expect(items).toEqual(expected)
  })

  it('covers every canonical label variant at least once', () => {
    const labels = new Set(items.map((i) => i.label))
    for (const l of ['client-money', 'bill', 'job', 'agent-failure', 'other']) {
      expect(labels.has(l as AttentionItem['label'])).toBe(true)
    }
  })

  it('flags handled items ([x]) and only those', () => {
    const handled = items.filter((i) => i.handled)
    expect(handled).toHaveLength(1)
    expect(handled[0]!.title).toBe('Recruiter reply — InstaCo')
  })

  it('surfaces a draft pointer only where one exists', () => {
    const withDraft = items.filter((i) => hasKey(i, 'draftPath'))
    expect(withDraft).toHaveLength(1)
    expect(withDraft[0]!.draftPath).toBe('Mail/drafts/2026-07-14-meera.md')
  })
})

// ─── waiting:: unit conversion (DoD 2) ───────────────────────────────────────

describe('parseAttentionLine — waiting:: conversion (DoD 2)', () => {
  const waitingOf = (line: string) => parseAttentionLine(line)!.waitingHours

  it('26h → 26', () => {
    expect(waitingOf('- [ ] T (waiting:: 26h)')).toBe(26)
  })

  it('3d → 72', () => {
    expect(waitingOf('- [ ] T (waiting:: 3d)')).toBe(72)
  })

  it('0h → 0', () => {
    expect(waitingOf('- [ ] T (waiting:: 0h)')).toBe(0)
  })

  it('1d → 24', () => {
    expect(waitingOf('- [ ] T (waiting:: 1d)')).toBe(24)
  })

  it('missing waiting:: → 0', () => {
    expect(waitingOf('- [ ] T (label:: bill)')).toBe(0)
  })

  it('unparseable waiting value → 0', () => {
    expect(waitingOf('- [ ] T (waiting:: soon)')).toBe(0)
  })

  it('bare number with no h/d suffix → 0', () => {
    expect(waitingOf('- [ ] T (waiting:: 5)')).toBe(0)
  })

  it('uppercase suffix (48H, 2D) is accepted', () => {
    expect(waitingOf('- [ ] T (waiting:: 48H)')).toBe(48)
    expect(waitingOf('- [ ] T (waiting:: 2D)')).toBe(48)
  })
})

// ─── label fallback (DoD 3) ──────────────────────────────────────────────────

describe('parseAttentionLine — label handling (DoD 3)', () => {
  const labelOf = (line: string) => parseAttentionLine(line)!.label

  it('each known label passes through unchanged', () => {
    for (const l of ['client-money', 'bill', 'job', 'agent-failure', 'other']) {
      expect(labelOf(`- [ ] T (label:: ${l})`)).toBe(l)
    }
  })

  it('unknown label → other', () => {
    expect(labelOf('- [ ] T (label:: spam)')).toBe('other')
  })

  it('missing label:: → other', () => {
    expect(labelOf('- [ ] T (from:: x@y.z)')).toBe('other')
  })

  it('empty label value → other', () => {
    expect(labelOf('- [ ] T (label::) (from:: x@y.z)')).toBe('other')
  })
})

// ─── malformed lines skipped, never throw (DoD 3) ────────────────────────────

describe('parseAttentionLine — malformed lines return null, never throw', () => {
  it('empty string → null', () => {
    expect(parseAttentionLine('')).toBeNull()
  })

  it('whitespace-only → null', () => {
    expect(parseAttentionLine('   ')).toBeNull()
  })

  it('heading → null', () => {
    expect(parseAttentionLine('# attention — written by email-triage')).toBeNull()
  })

  it('plain prose → null', () => {
    expect(parseAttentionLine('Just a note, not a task at all.')).toBeNull()
  })

  it('empty checkbox → null', () => {
    expect(parseAttentionLine('- [ ]')).toBeNull()
  })

  it('checkbox with no space → null', () => {
    expect(parseAttentionLine('- [ ]NoSpace')).toBeNull()
  })

  it('wrong bullet → null', () => {
    expect(parseAttentionLine('* [ ] Wrong bullet (label:: bill)')).toBeNull()
  })
})

describe('parseAttention — whole-file resilience', () => {
  it('a file of only headings/prose/blank lines → zero items, no throw', () => {
    const md = '# attention\n\nsome prose\n\n- not a task\n'
    expect(parseAttention(md)).toEqual([])
  })

  it('empty string → zero items', () => {
    expect(parseAttention('')).toEqual([])
  })

  it('a malformed line between good ones does not drop its neighbours', () => {
    const md = [
      '- [ ] First (label:: bill) (waiting:: 1h)',
      '- [ ]',
      '- [ ] Second (label:: job) (waiting:: 2h)',
    ].join('\n')
    const items = parseAttention(md)
    expect(items.map((i) => i.title)).toEqual(['First', 'Second'])
  })
})

// ─── field ordering + edge cases ─────────────────────────────────────────────

describe('parseAttentionLine — field extraction edge cases', () => {
  it('fields parse regardless of order relative to each other', () => {
    const a = parseAttentionLine(
      '- [ ] T (draft:: d.md) (waiting:: 3d) (from:: a@b.c) (label:: job)',
    )!
    expect(a).toMatchObject({
      title: 'T',
      label: 'job',
      from: 'a@b.c',
      waitingHours: 72,
      draftPath: 'd.md',
    })
  })

  it('parenthesised text in the title is preserved (title ends at first field marker)', () => {
    const t = parseAttentionLine(
      '- [ ] Meera (NorthStar) asked (label:: client-money) (waiting:: 1h)',
    )!
    expect(t.title).toBe('Meera (NorthStar) asked')
  })

  it('missing from:: yields empty string', () => {
    const t = parseAttentionLine('- [ ] T (label:: bill) (waiting:: 1h)')!
    expect(t.from).toBe('')
  })

  it('no draft:: → draftPath key is absent', () => {
    const t = parseAttentionLine('- [ ] T (label:: bill) (waiting:: 1h)')!
    expect(hasKey(t, 'draftPath')).toBe(false)
  })

  it('uppercase [X] is recognised as handled', () => {
    const t = parseAttentionLine('- [X] T (label:: job) (waiting:: 0h)')!
    expect(t.handled).toBe(true)
  })
})
