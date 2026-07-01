/**
 * serialize unit tests (S15a).
 *
 * Covers serializeTaskLine round-trip against parseTaskLine for the full
 * matrix of field combinations: checked, unchecked, done_when-only,
 * priority-only, both fields, neither field.
 *
 * Round-trip assertion: parseTaskLine(serializeTaskLine(t), {}) ≡ t over
 * the MODELED fields (title, done, done_when, priority) only — id,
 * created_at, and completed_at are re-synthesised by the parser and are
 * intentionally excluded from the comparison.
 *
 * String-level assertions verify canonical field order and absent-field
 * omission in the raw output.
 */

import { describe, it, expect } from 'vitest'
import { serializeTaskLine } from './serialize'
import { parseTaskLine } from './parseVault'
import type { Task } from '../types'

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract only the fields that round-trip through the markdown line.
 * id, created_at, completed_at, domain, project are all omitted —
 * they live outside the line (in uuid generation or file-path context).
 */
function pickModeled(t: Task): { title: string; done: boolean; done_when?: string; priority?: 1 | 2 | 3 } {
  const result: { title: string; done: boolean; done_when?: string; priority?: 1 | 2 | 3 } = {
    title: t.title,
    done: t.done,
  }
  if (t.done_when !== undefined) result.done_when = t.done_when
  if (t.priority !== undefined) result.priority = t.priority
  return result
}

/** Minimal Task factory — only sets the fields relevant to the serializer. */
function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'test-id',
    title: 'Test task',
    done: false,
    created_at: 1000,
    ...overrides,
  }
}

/** Assert round-trip for a task's modeled fields. */
function assertRoundTrip(task: Task): void {
  const line = serializeTaskLine(task)
  const parsed = parseTaskLine(line, {})
  expect(parsed).not.toBeNull()
  expect(pickModeled(parsed!)).toEqual(pickModeled(task))
}

// ─── round-trip — unchecked, no fields ───────────────────────────────────────

describe('serializeTaskLine — unchecked, no inline fields', () => {
  const task = makeTask({ title: 'Buy groceries' })

  it('round-trips title and done=false', () => {
    assertRoundTrip(task)
  })

  it('produces the correct checkbox prefix', () => {
    expect(serializeTaskLine(task)).toMatch(/^- \[ \] /)
  })

  it('title appears verbatim in the line', () => {
    expect(serializeTaskLine(task)).toContain('Buy groceries')
  })

  it('done_when is absent from the output', () => {
    expect(serializeTaskLine(task)).not.toContain('done_when::')
  })

  it('priority is absent from the output', () => {
    expect(serializeTaskLine(task)).not.toContain('priority::')
  })

  it('produces the exact expected string', () => {
    expect(serializeTaskLine(task)).toBe('- [ ] Buy groceries')
  })
})

// ─── round-trip — checked (done), no fields ───────────────────────────────────

describe('serializeTaskLine — checked, no inline fields', () => {
  const task = makeTask({ title: 'Done item', done: true, completed_at: 2000 })

  it('round-trips done=true', () => {
    assertRoundTrip(task)
  })

  it('produces the checked checkbox prefix', () => {
    expect(serializeTaskLine(task)).toMatch(/^- \[x\] /)
  })

  it('produces the exact expected string', () => {
    expect(serializeTaskLine(task)).toBe('- [x] Done item')
  })
})

// ─── round-trip — done_when only ─────────────────────────────────────────────

describe('serializeTaskLine — done_when only', () => {
  const task = makeTask({ title: 'Submit report', done_when: 'PR is merged' })

  it('round-trips title and done_when', () => {
    assertRoundTrip(task)
  })

  it('done_when value appears in the output', () => {
    expect(serializeTaskLine(task)).toContain('done_when:: PR is merged')
  })

  it('priority is absent from the output', () => {
    expect(serializeTaskLine(task)).not.toContain('priority::')
  })

  it('produces the exact expected string', () => {
    expect(serializeTaskLine(task)).toBe('- [ ] Submit report done_when:: PR is merged')
  })
})

// ─── round-trip — priority only ──────────────────────────────────────────────

describe('serializeTaskLine — priority only', () => {
  it('round-trips priority 1', () => {
    assertRoundTrip(makeTask({ title: 'Low priority', priority: 1 }))
  })

  it('round-trips priority 2', () => {
    assertRoundTrip(makeTask({ title: 'Medium priority', priority: 2 }))
  })

  it('round-trips priority 3', () => {
    assertRoundTrip(makeTask({ title: 'High priority', priority: 3 }))
  })

  it('priority value appears in the output', () => {
    const task = makeTask({ title: 'Urgent', priority: 3 })
    expect(serializeTaskLine(task)).toContain('priority:: 3')
  })

  it('done_when is absent from the output', () => {
    const task = makeTask({ title: 'Urgent', priority: 3 })
    expect(serializeTaskLine(task)).not.toContain('done_when::')
  })

  it('produces the exact expected string for priority 2', () => {
    const task = makeTask({ title: 'Medium task', priority: 2 })
    expect(serializeTaskLine(task)).toBe('- [ ] Medium task priority:: 2')
  })
})

// ─── round-trip — both fields ─────────────────────────────────────────────────

describe('serializeTaskLine — both done_when and priority', () => {
  const task = makeTask({
    title: 'Write tests',
    done_when: 'all pass',
    priority: 3,
  })

  it('round-trips all modeled fields', () => {
    assertRoundTrip(task)
  })

  it('produces the exact expected string', () => {
    expect(serializeTaskLine(task)).toBe(
      '- [ ] Write tests done_when:: all pass priority:: 3',
    )
  })
})

// ─── field order ──────────────────────────────────────────────────────────────

describe('serializeTaskLine — canonical field order', () => {
  const task = makeTask({
    title: 'Order check',
    done_when: 'criterion',
    priority: 2,
  })

  it('done_when appears BEFORE priority in the output', () => {
    const line = serializeTaskLine(task)
    const doneWhenIdx = line.indexOf('done_when::')
    const priorityIdx = line.indexOf('priority::')
    expect(doneWhenIdx).toBeGreaterThan(-1)
    expect(priorityIdx).toBeGreaterThan(-1)
    expect(doneWhenIdx).toBeLessThan(priorityIdx)
  })
})

// ─── absent fields are not emitted ───────────────────────────────────────────

describe('serializeTaskLine — absent fields are omitted', () => {
  it('does not emit done_when when absent', () => {
    const task = makeTask({ title: 'No criterion', priority: 1 })
    expect(serializeTaskLine(task)).not.toContain('done_when')
  })

  it('does not emit priority when absent', () => {
    const task = makeTask({ title: 'Unranked task', done_when: 'ok' })
    expect(serializeTaskLine(task)).not.toContain('priority')
  })

  it('emits only the title when both are absent', () => {
    const task = makeTask({ title: 'Minimal task' })
    expect(serializeTaskLine(task)).toBe('- [ ] Minimal task')
  })
})

// ─── checked with both fields ─────────────────────────────────────────────────

describe('serializeTaskLine — checked task with both fields', () => {
  const task = makeTask({
    title: 'Deploy to prod',
    done: true,
    completed_at: 9000,
    done_when: 'smoke tests pass',
    priority: 3,
  })

  it('round-trips all modeled fields for a checked task', () => {
    assertRoundTrip(task)
  })

  it('uses checked checkbox with both fields', () => {
    expect(serializeTaskLine(task)).toBe(
      '- [x] Deploy to prod done_when:: smoke tests pass priority:: 3',
    )
  })
})
