/**
 * gapFit unit tests (Slice S34). Pure, DOM-free — no render, no jsdom.
 * Covers the numbered DoD:
 *  2. gap hints present + named when a task fits; null when nothing fits.
 *  4. gapFit is pure + unit-tested separately from the DOM.
 */
import { describe, it, expect } from 'vitest'
import type { Task } from '../types'
import type { Gap } from '../vault/calendar'
import {
  gapFit,
  estimateEffortMinutes,
  SHORT_EFFORT_MINUTES,
  DEFAULT_EFFORT_MINUTES,
  LONG_EFFORT_MINUTES,
} from './gapFit'

/** Minimal Task factory — only the fields gapFit reads matter. */
function task(over: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: over.id,
    done: false,
    created_at: 0,
    ...over,
  }
}

function gap(start: string, end: string, minutes: number): Gap {
  return { start, end, minutes }
}

describe('gapFit — pure function contract', () => {
  it('is deterministic and does not mutate its inputs', () => {
    const gaps = [gap('09:00', '10:30', 90)]
    const tasks = [task({ id: 'a', title: 'Module 4 quiz' })]
    const gapsCopy = JSON.parse(JSON.stringify(gaps))
    const tasksCopy = JSON.parse(JSON.stringify(tasks))

    const result1 = gapFit(gaps, tasks)
    const result2 = gapFit(gaps, tasks)

    expect(gaps).toEqual(gapsCopy)
    expect(tasks).toEqual(tasksCopy)
    expect(result1.get(gaps[0]!)!.id).toBe(result2.get(gaps[0]!)!.id)
  })

  it('returns a Map keyed by the exact Gap object instances passed in', () => {
    const g1 = gap('09:00', '10:00', 60)
    const result = gapFit([g1], [task({ id: 'a', title: 'Quiz review' })])
    expect(result.has(g1)).toBe(true)
    expect(result.size).toBe(1)
  })

  it('empty gaps → empty map', () => {
    expect(gapFit([], [task({ id: 'a' })]).size).toBe(0)
  })

  it('no tasks → every gap maps to null', () => {
    const g1 = gap('09:00', '11:00', 120)
    const result = gapFit([g1], [])
    expect(result.get(g1)).toBeNull()
  })
})

describe('gapFit — short gaps (<60min) only accept short/quiz-shaped tasks', () => {
  it('names a quiz task for a 45-min gap', () => {
    const g1 = gap('14:00', '14:45', 45)
    const quiz = task({ id: 'a', title: 'Module 4 quiz' })
    const result = gapFit([g1], [quiz])
    expect(result.get(g1)).toBe(quiz)
  })

  it('does not suggest a long/heads-down task for a short gap', () => {
    const g1 = gap('14:00', '14:45', 45)
    const deepTask = task({ id: 'a', title: 'Deep work: redesign onboarding' })
    const result = gapFit([g1], [deepTask])
    expect(result.get(g1)).toBeNull()
  })

  it('does not suggest a generic/default-effort task for a short gap', () => {
    const g1 = gap('14:00', '14:45', 45)
    const generic = task({ id: 'a', title: 'Call the landlord' })
    const result = gapFit([g1], [generic])
    expect(result.get(g1)).toBeNull()
  })
})

describe('gapFit — 60+ min gaps accept any task whose estimate fits', () => {
  it('names the top-ranked (first) task when its estimate fits', () => {
    const g1 = gap('11:00', '14:00', 180)
    const first = task({ id: 'a', title: 'Write the client proposal' })
    const second = task({ id: 'b', title: 'Module 4 quiz' })
    const result = gapFit([g1], [first, second])
    // "Write the client proposal" matches no LONG keyword ("write proposal"
    // is the long keyword, not "write the client proposal") — falls to the
    // default 45min estimate, which fits a 180min gap; first-ranked wins.
    expect(result.get(g1)).toBe(first)
  })

  it('skips a task whose long-effort estimate exceeds the gap, falls to the next', () => {
    const g1 = gap('16:00', '17:00', 60)
    const longTask = task({ id: 'a', title: 'Deep work: refactor the pipeline' })
    // No long/short keyword — lands on the default 45min estimate, which fits a 60min gap.
    const genericTask = task({ id: 'b', title: 'Call the landlord' })
    const result = gapFit([g1], [longTask, genericTask])
    expect(result.get(g1)).toBe(genericTask)
  })

  it('90-min gap accepts a long/heads-down task', () => {
    const g1 = gap('14:00', '15:30', 90)
    const longTask = task({ id: 'a', title: 'Deep work: redesign onboarding' })
    const result = gapFit([g1], [longTask])
    expect(result.get(g1)).toBe(longTask)
  })
})

describe('gapFit — a task is suggested at most once across multiple gaps', () => {
  it('does not repeat the same task for a second gap', () => {
    const g1 = gap('09:00', '09:45', 45)
    const g2 = gap('15:00', '15:45', 45)
    const onlyQuiz = task({ id: 'a', title: 'Module 4 quiz' })
    const result = gapFit([g1, g2], [onlyQuiz])
    expect(result.get(g1)).toBe(onlyQuiz)
    expect(result.get(g2)).toBeNull()
  })

  it('moves to the next-ranked fitting task once the first is used', () => {
    const g1 = gap('09:00', '09:45', 45)
    const g2 = gap('15:00', '15:45', 45)
    const quizA = task({ id: 'a', title: 'Module 4 quiz' })
    const quizB = task({ id: 'b', title: 'Module 5 quiz' })
    const result = gapFit([g1, g2], [quizA, quizB])
    expect(result.get(g1)).toBe(quizA)
    expect(result.get(g2)).toBe(quizB)
  })
})

describe('estimateEffortMinutes', () => {
  it('short-keyword titles estimate SHORT_EFFORT_MINUTES', () => {
    expect(estimateEffortMinutes(task({ id: 'a', title: 'Module 4 quiz' }))).toBe(
      SHORT_EFFORT_MINUTES,
    )
  })

  it('long-keyword titles estimate LONG_EFFORT_MINUTES', () => {
    expect(estimateEffortMinutes(task({ id: 'a', title: 'Deep work block' }))).toBe(
      LONG_EFFORT_MINUTES,
    )
  })

  it('titles with no keyword signal estimate DEFAULT_EFFORT_MINUTES', () => {
    expect(estimateEffortMinutes(task({ id: 'a', title: 'Call the landlord' }))).toBe(
      DEFAULT_EFFORT_MINUTES,
    )
  })
})
