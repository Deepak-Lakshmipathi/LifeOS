import { describe, it, expect } from 'vitest'
import { parseCapture, fuzzyMatchDomain } from './parseCapture'

// ─── fuzzyMatchDomain ─────────────────────────────────────────────────────────

describe('fuzzyMatchDomain', () => {
  it('exact match (case-insensitive)', () => {
    expect(fuzzyMatchDomain('Growth')).toBe('Growth')
    expect(fuzzyMatchDomain('growth')).toBe('Growth')
    expect(fuzzyMatchDomain('GROWTH')).toBe('Growth')
    expect(fuzzyMatchDomain('Career')).toBe('Career')
    expect(fuzzyMatchDomain('Finance')).toBe('Finance')
    expect(fuzzyMatchDomain('Relationship')).toBe('Relationship')
  })

  it('prefix of first word in domain', () => {
    expect(fuzzyMatchDomain('build')).toBe('Building Things')
    expect(fuzzyMatchDomain('building')).toBe('Building Things')
    expect(fuzzyMatchDomain('rel')).toBe('Relationship')
    expect(fuzzyMatchDomain('fin')).toBe('Finance')
    expect(fuzzyMatchDomain('car')).toBe('Career')
    expect(fuzzyMatchDomain('grow')).toBe('Growth')
  })

  it('prefix of second word in domain', () => {
    expect(fuzzyMatchDomain('thing')).toBe('Building Things')
    expect(fuzzyMatchDomain('things')).toBe('Building Things')
    expect(fuzzyMatchDomain('admin')).toBe('Life Admin')
    expect(fuzzyMatchDomain('mind')).toBe('Body & Mind')
  })

  it('first word prefix for multi-word domains', () => {
    expect(fuzzyMatchDomain('life')).toBe('Life Admin')
    expect(fuzzyMatchDomain('body')).toBe('Body & Mind')
  })

  it('substring match as fallback', () => {
    expect(fuzzyMatchDomain('bodymind')).toBe('Body & Mind')
    expect(fuzzyMatchDomain('lifeadmin')).toBe('Life Admin')
  })

  it('returns undefined for unmatched tokens', () => {
    expect(fuzzyMatchDomain('unknown')).toBeUndefined()
    expect(fuzzyMatchDomain('zork')).toBeUndefined()
    expect(fuzzyMatchDomain('xyz')).toBeUndefined()
    expect(fuzzyMatchDomain('')).toBeUndefined()
  })
})

// ─── parseCapture — basic extraction ─────────────────────────────────────────

describe('parseCapture — title only', () => {
  it('bare text → title', () => {
    expect(parseCapture('Buy groceries')).toMatchObject({ title: 'Buy groceries' })
  })

  it('empty string → empty title', () => {
    expect(parseCapture('')).toMatchObject({ title: '' })
    expect(parseCapture('   ')).toMatchObject({ title: '' })
  })

  it('no extra fields when no tokens present', () => {
    const result = parseCapture('Clean the desk')
    expect(result).toEqual({ title: 'Clean the desk' })
  })
})

describe('parseCapture — priority', () => {
  it('!1 → priority 1', () => {
    expect(parseCapture('Do thing !1')).toMatchObject({ priority: 1 })
  })

  it('!2 → priority 2', () => {
    expect(parseCapture('Do thing !2')).toMatchObject({ priority: 2 })
  })

  it('!3 → priority 3', () => {
    expect(parseCapture('Do thing !3')).toMatchObject({ priority: 3 })
  })

  it('priority token removed from title', () => {
    const r = parseCapture('Fix bug !2')
    expect(r.title).toBe('Fix bug')
    expect(r.priority).toBe(2)
  })

  it('missing priority → field absent', () => {
    const r = parseCapture('Fix bug')
    expect(r.priority).toBeUndefined()
  })

  it('first !N wins when multiple present', () => {
    const r = parseCapture('Task !1 !3')
    expect(r.priority).toBe(1)
  })
})

describe('parseCapture — project', () => {
  it('/project → project field', () => {
    expect(parseCapture('Fix bug /ops-infra')).toMatchObject({ project: 'ops-infra' })
  })

  it('project token removed from title', () => {
    const r = parseCapture('Fix bug /ops-infra')
    expect(r.title).toBe('Fix bug')
  })

  it('missing project → field absent', () => {
    const r = parseCapture('Fix bug')
    expect(r.project).toBeUndefined()
  })

  it('first /token wins; subsequent appear in title', () => {
    const r = parseCapture('Task /alpha /beta')
    expect(r.project).toBe('alpha')
    expect(r.title).toContain('/beta')
  })
})

describe('parseCapture — domain', () => {
  it('#growth → Growth', () => {
    expect(parseCapture('Read book #growth')).toMatchObject({ domain: 'Growth' })
  })

  it('domain token removed from title', () => {
    const r = parseCapture('Read book #growth')
    expect(r.title).toBe('Read book')
    expect(r.domain).toBe('Growth')
  })

  it('fuzzy: #build → Building Things', () => {
    expect(parseCapture('Ship feature #build')).toMatchObject({ domain: 'Building Things' })
  })

  it('fuzzy: #body → Body & Mind', () => {
    expect(parseCapture('Morning run #body')).toMatchObject({ domain: 'Body & Mind' })
  })

  it('fuzzy: #fin → Finance', () => {
    expect(parseCapture('Pay bills #fin')).toMatchObject({ domain: 'Finance' })
  })

  it('fuzzy: #life → Life Admin', () => {
    expect(parseCapture('Renew passport #life')).toMatchObject({ domain: 'Life Admin' })
  })

  it('fuzzy: #rel → Relationship', () => {
    expect(parseCapture('Call mom #rel')).toMatchObject({ domain: 'Relationship' })
  })

  it('unmatched #token → domain absent (→ Inbox)', () => {
    const r = parseCapture('Fix bug #unknown')
    expect(r.domain).toBeUndefined()
    expect(r.title).toBe('Fix bug')
  })

  it('missing domain → field absent', () => {
    const r = parseCapture('Fix bug')
    expect(r.domain).toBeUndefined()
  })
})

describe('parseCapture — done_when', () => {
  it('"when <text>" → done_when', () => {
    expect(parseCapture('Buy milk when basket empty')).toMatchObject({
      done_when: 'basket empty',
      title: 'Buy milk',
    })
  })

  it('"~ <text>" → done_when', () => {
    expect(parseCapture('Deploy service ~ tests green')).toMatchObject({
      done_when: 'tests green',
      title: 'Deploy service',
    })
  })

  it('"~text" (no space) → done_when', () => {
    expect(parseCapture('Fix bug ~done')).toMatchObject({
      done_when: 'done',
      title: 'Fix bug',
    })
  })

  it('standalone "when" at end with no text → done_when absent', () => {
    const r = parseCapture('Fix bug when')
    expect(r.done_when).toBeUndefined()
    expect(r.title).toBe('Fix bug')
  })

  it('standalone "~" at end with no text → done_when absent', () => {
    const r = parseCapture('Fix bug ~')
    expect(r.done_when).toBeUndefined()
    expect(r.title).toBe('Fix bug')
  })

  it('missing done_when → field absent', () => {
    const r = parseCapture('Fix bug')
    expect(r.done_when).toBeUndefined()
  })
})

// ─── parseCapture — tokens in any order ──────────────────────────────────────

describe('parseCapture — any order', () => {
  const expected = {
    title: 'Learn React',
    domain: 'Growth',
    priority: 2,
    done_when: 'all chapters done',
  }

  it('domain first', () => {
    expect(parseCapture('#growth Learn React !2 when all chapters done')).toMatchObject(expected)
  })

  it('priority first', () => {
    expect(parseCapture('!2 Learn React #growth when all chapters done')).toMatchObject(expected)
  })

  it('title first', () => {
    expect(parseCapture('Learn React #growth !2 when all chapters done')).toMatchObject(expected)
  })

  it('all tokens before when', () => {
    expect(parseCapture('Learn React !2 #growth when all chapters done')).toMatchObject(expected)
  })

  it('with project too — any order', () => {
    const r = parseCapture('/side-project !3 #career Build portfolio when launched')
    expect(r).toMatchObject({
      title: 'Build portfolio',
      domain: 'Career',
      priority: 3,
      project: 'side-project',
      done_when: 'launched',
    })
  })

  it('project at end (before when)', () => {
    const r = parseCapture('Build portfolio #career !3 /side-project when launched')
    expect(r).toMatchObject({
      title: 'Build portfolio',
      domain: 'Career',
      priority: 3,
      project: 'side-project',
      done_when: 'launched',
    })
  })
})

// ─── parseCapture — missing tokens ───────────────────────────────────────────

describe('parseCapture — missing tokens', () => {
  it('only title', () => {
    const r = parseCapture('Grocery run')
    expect(r).toEqual({ title: 'Grocery run' })
  })

  it('title + domain only', () => {
    const r = parseCapture('Morning run #body')
    expect(r).toEqual({ title: 'Morning run', domain: 'Body & Mind' })
  })

  it('title + priority only', () => {
    const r = parseCapture('Fix critical bug !3')
    expect(r).toEqual({ title: 'Fix critical bug', priority: 3 })
  })

  it('title + done_when only', () => {
    const r = parseCapture('Ship feature when PR merged')
    expect(r).toEqual({ title: 'Ship feature', done_when: 'PR merged' })
  })

  it('title + project only', () => {
    const r = parseCapture('Fix bug /my-project')
    expect(r).toEqual({ title: 'Fix bug', project: 'my-project' })
  })
})

// ─── parseCapture — unmatched domain → Inbox ─────────────────────────────────

describe('parseCapture — unmatched domain lands in Inbox', () => {
  it('#zork → no domain field', () => {
    const r = parseCapture('Fix bug #zork')
    expect(r.domain).toBeUndefined()
  })

  it('#zork does not appear in title', () => {
    const r = parseCapture('Fix bug #zork')
    expect(r.title).toBe('Fix bug')
    expect(r.title).not.toContain('#zork')
  })

  it('unmatched domain with other tokens → others still parsed', () => {
    const r = parseCapture('Fix bug #zork !2 /ops')
    expect(r.domain).toBeUndefined()
    expect(r.priority).toBe(2)
    expect(r.project).toBe('ops')
    expect(r.title).toBe('Fix bug')
  })
})
