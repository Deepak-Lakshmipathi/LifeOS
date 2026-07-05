import { describe, expect, it } from 'vitest'
import {
  scoreMatch,
  matchTasks,
  classifyMatches,
  tasksFromFiles,
  CONFIDENT_THRESHOLD,
  CANDIDATE_FLOOR,
  MAX_CANDIDATES,
  type MatchedTask,
} from './taskMatch'
import type { Task } from '../../src/types'

function task(overrides: Partial<Task> & { title: string }): Task {
  return {
    id: crypto.randomUUID(),
    done: false,
    created_at: Date.now(),
    ...overrides,
  }
}

function matched(overrides: Partial<Task> & { title: string }, path = 'Inbox/Inbox.md'): MatchedTask {
  const t = task(overrides)
  return { task: t, path, rawLine: `- [ ] ${t.title} id:: ${t.id}` }
}

describe('scoreMatch', () => {
  it('returns 1 for an exact case-insensitive substring match', () => {
    expect(scoreMatch('gst', 'GST registration')).toBe(1)
    expect(scoreMatch('GST REGISTRATION', 'gst registration')).toBe(1)
  })

  it('returns the fraction of query tokens present as whole tokens in the title', () => {
    // q tokens: {call, ca, about, tax} — title has "call" and "ca" but not
    // "about"/"tax", and "call ca" is not a substring of "call ca" reversed...
    expect(scoreMatch('call ca about tax', 'Call CA')).toBe(0.5) // 2/4
  })

  it('returns 0 when no query tokens appear in the title', () => {
    expect(scoreMatch('xyz zzz', 'Completely unrelated title')).toBe(0)
  })

  it('returns 0 for an empty/whitespace-only query', () => {
    expect(scoreMatch('', 'Anything')).toBe(0)
    expect(scoreMatch('   ', 'Anything')).toBe(0)
  })
})

describe('matchTasks', () => {
  it('sorts descending by score', () => {
    const candidates: MatchedTask[] = [
      matched({ title: 'Call plumber' }),
      matched({ title: 'Call the CA about GST' }),
    ]

    const result = matchTasks('call CA GST', candidates)

    expect(result[0]!.task.title).toBe('Call the CA about GST')
  })

  it('filters to domainHint before scoring when given', () => {
    const inFinance = matched({ title: 'Call the CA about GST', domain: 'Finance' })
    const inGrowth = matched({ title: 'Call the CA about GST', domain: 'Growth' })

    const result = matchTasks('call CA GST', [inFinance, inGrowth], 'Finance')

    expect(result).toHaveLength(1)
    expect(result[0]!.task.domain).toBe('Finance')
  })

  it('excludes candidates scoring below CANDIDATE_FLOOR', () => {
    const weak = matched({ title: 'Totally unrelated' })
    const strong = matched({ title: 'Call the CA about GST' })

    const result = matchTasks('call CA GST', [weak, strong])

    expect(result).toHaveLength(1)
    expect(result[0]).toBe(strong)
  })

  it('breaks score ties by created_at descending (newest first)', () => {
    const older = matched({ title: 'Call CA', created_at: 1000 })
    const newer = matched({ title: 'Call CA', created_at: 2000 })

    const result = matchTasks('call ca', [older, newer])

    expect(result[0]).toBe(newer)
    expect(result[1]).toBe(older)
  })
})

describe('classifyMatches', () => {
  it('confident-single: exactly one candidate >= 0.6 with every other candidate < 0.5', () => {
    const target = matched({ title: 'Call the CA about GST' })
    const unrelated = matched({ title: 'Buy milk' })

    const result = classifyMatches('call CA GST', [target, unrelated])

    expect(result.kind).toBe('confident')
    if (result.kind === 'confident') {
      expect(result.match).toBe(target)
      expect(scoreMatch('call CA GST', target.task.title)).toBeGreaterThanOrEqual(CONFIDENT_THRESHOLD)
    }
  })

  it('disambiguate: 2+ candidates scoring >= 0.5, capped at 5, tie-broken by created_at desc', () => {
    const candidates: MatchedTask[] = Array.from({ length: 7 }, (_, i) =>
      matched({ title: 'Call the CA', created_at: i }),
    )

    const result = classifyMatches('call the ca', candidates)

    expect(result.kind).toBe('disambiguate')
    if (result.kind === 'disambiguate') {
      expect(result.candidates).toHaveLength(MAX_CANDIDATES)
      // Newest (highest created_at) first among the 7 same-score candidates.
      expect(result.candidates[0]!.task.created_at).toBe(6)
      expect(result.candidates[4]!.task.created_at).toBe(2)
    }
  })

  it('no-match: zero candidates scoring >= 0.5', () => {
    const unrelated = matched({ title: 'Buy milk' })

    const result = classifyMatches('call the CA about GST', [unrelated])

    expect(result.kind).toBe('none')
  })

  it('respects a domainHint when narrowing before classifying', () => {
    const finance = matched({ title: 'Call the CA about GST', domain: 'Finance' })
    const growth = matched({ title: 'Call the CA about GST', domain: 'Growth' })

    const result = classifyMatches('call CA GST', [finance, growth], 'Finance')

    expect(result.kind).toBe('confident')
    if (result.kind === 'confident') {
      expect(result.match.task.domain).toBe('Finance')
    }
  })

  it('CANDIDATE_FLOOR/CONFIDENT_THRESHOLD are the literal ADR-0013 values', () => {
    expect(CANDIDATE_FLOOR).toBe(0.5)
    expect(CONFIDENT_THRESHOLD).toBe(0.6)
    expect(MAX_CANDIDATES).toBe(5)
  })
})

describe('tasksFromFiles', () => {
  it('parses tasks from vault files, capturing path and verbatim rawLine', () => {
    const files = [
      { path: 'Finance/Inbox.md', content: '- [ ] Call the CA about GST id:: abc-1 priority:: 2\n' },
    ]

    const result = tasksFromFiles(files)

    expect(result).toHaveLength(1)
    expect(result[0]!.path).toBe('Finance/Inbox.md')
    expect(result[0]!.rawLine).toBe('- [ ] Call the CA about GST id:: abc-1 priority:: 2')
    expect(result[0]!.task.title).toBe('Call the CA about GST')
    expect(result[0]!.task.domain).toBe('Finance')
    expect(result[0]!.task.priority).toBe(2)
  })

  it('includes done tasks (delete may target a completed task)', () => {
    const files = [{ path: 'Inbox/Inbox.md', content: '- [x] Renew passport id:: abc-2\n' }]

    const result = tasksFromFiles(files)

    expect(result).toHaveLength(1)
    expect(result[0]!.task.done).toBe(true)
  })

  it('skips non-task lines and files with fewer than 2 path segments', () => {
    const files = [
      { path: 'not-nested.md', content: '- [ ] Should be skipped\n' },
      { path: 'Inbox/Inbox.md', content: 'not a task line\n- [ ] Real task\n' },
    ]

    const result = tasksFromFiles(files)

    expect(result).toHaveLength(1)
    expect(result[0]!.task.title).toBe('Real task')
  })
})
