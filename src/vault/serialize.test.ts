/**
 * serialize unit tests (S15a; extended S16a for durable id::).
 *
 * Covers serializeTaskLine round-trip against parseTaskLine for the full
 * matrix of field combinations: checked, unchecked, done_when-only,
 * priority-only, both fields, neither field.
 *
 * Round-trip assertion: parseTaskLine(serializeTaskLine(t), {}) ≡ t over
 * the MODELED fields (id, title, done, done_when, priority) only —
 * created_at and completed_at are re-synthesised by the parser and are
 * intentionally excluded from the comparison. `id` IS included (S16a,
 * ADR-0011 §3): serializeTaskLine now always emits id:: and parseTaskLine
 * now reads it back verbatim, so a task's durable identity must survive
 * a serialize → parse round trip.
 *
 * String-level assertions verify canonical field order (id, then
 * done_when, then priority) and absent-field omission (done_when/priority
 * only — id is never absent) in the raw output.
 */

import { describe, it, expect } from 'vitest'
import { serializeTaskLine } from './serialize'
import { parseTaskLine } from './parseVault'
import type { Task } from '../types'

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract only the fields that round-trip through the markdown line.
 * created_at, completed_at, domain, project are all omitted — they live
 * outside the line (in-memory only, or file-path context). `id` IS
 * included — it now round-trips via id:: (S16a).
 */
function pickModeled(t: Task): { id: string; title: string; done: boolean; done_when?: string; priority?: 1 | 2 | 3 } {
  const result: { id: string; title: string; done: boolean; done_when?: string; priority?: 1 | 2 | 3 } = {
    id: t.id,
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

  it('round-trips id, title and done=false', () => {
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
    expect(serializeTaskLine(task)).toBe('- [ ] Buy groceries id:: test-id')
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
    expect(serializeTaskLine(task)).toBe('- [x] Done item id:: test-id')
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
    expect(serializeTaskLine(task)).toBe('- [ ] Submit report id:: test-id done_when:: PR is merged')
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
    expect(serializeTaskLine(task)).toBe('- [ ] Medium task id:: test-id priority:: 2')
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
      '- [ ] Write tests id:: test-id done_when:: all pass priority:: 3',
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

  it('id appears BEFORE done_when in the output', () => {
    const line = serializeTaskLine(task)
    const idIdx = line.indexOf('id::')
    const doneWhenIdx = line.indexOf('done_when::')
    expect(idIdx).toBeGreaterThan(-1)
    expect(doneWhenIdx).toBeGreaterThan(-1)
    expect(idIdx).toBeLessThan(doneWhenIdx)
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

// ─── id:: — always emitted (S16a, ADR-0011 §3) ────────────────────────────────

describe('serializeTaskLine — id:: is always emitted', () => {
  it('emits id:: for a task with neither done_when nor priority set', () => {
    const task = makeTask({ id: 'abc-123', title: 'Minimal task' })
    expect(serializeTaskLine(task)).toBe('- [ ] Minimal task id:: abc-123')
  })

  it('emits id:: for a task with both done_when and priority set', () => {
    const task = makeTask({
      id: 'def-456',
      title: 'Full task',
      done_when: 'criterion met',
      priority: 1,
    })
    expect(serializeTaskLine(task)).toBe(
      '- [ ] Full task id:: def-456 done_when:: criterion met priority:: 1',
    )
  })

  it('positions id:: immediately after the title, before done_when/priority', () => {
    const task = makeTask({
      id: 'pos-check',
      title: 'Position check',
      done_when: 'x',
      priority: 2,
    })
    const line = serializeTaskLine(task)
    expect(line).toBe('- [ ] Position check id:: pos-check done_when:: x priority:: 2')
  })

  it('uses the exact task.id value verbatim (a real UUID)', () => {
    const uuid = crypto.randomUUID()
    const task = makeTask({ id: uuid, title: 'UUID task' })
    expect(serializeTaskLine(task)).toContain(`id:: ${uuid}`)
  })
})

// ─── absent fields are not emitted (done_when/priority only) ─────────────────

describe('serializeTaskLine — absent optional fields are omitted', () => {
  it('does not emit done_when when absent', () => {
    const task = makeTask({ title: 'No criterion', priority: 1 })
    expect(serializeTaskLine(task)).not.toContain('done_when')
  })

  it('does not emit priority when absent', () => {
    const task = makeTask({ title: 'Unranked task', done_when: 'ok' })
    expect(serializeTaskLine(task)).not.toContain('priority')
  })

  it('emits title and id only when both optional fields are absent', () => {
    const task = makeTask({ title: 'Minimal task' })
    expect(serializeTaskLine(task)).toBe('- [ ] Minimal task id:: test-id')
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
      '- [x] Deploy to prod id:: test-id done_when:: smoke tests pass priority:: 3',
    )
  })
})

// ─── legacy lazy-stamp path (S16a, ADR-0011 §3) ───────────────────────────────

describe('serializeTaskLine — legacy lazy-stamp regression guard', () => {
  it('a legacy id-less line, once parsed, synthesises an id — and re-serializing it stamps id:: onto the rewritten line', () => {
    // A pre-S16a vault line has no id:: at all.
    const legacyLine = '- [ ] Legacy task done_when:: still works priority:: 2'
    const parsed = parseTaskLine(legacyLine, {})
    expect(parsed).not.toBeNull()
    expect(parsed!.id).toBeTruthy() // ephemeral id synthesised, unchanged from S14/S15

    // The very next write of this task (any mutator) re-serializes it —
    // this is the lazy backfill: no separate migration step, id:: just
    // appears because serializeTaskLine always emits it now.
    const rewritten = serializeTaskLine(parsed!)
    expect(rewritten).toContain(`id:: ${parsed!.id}`)

    // And it survives a further round trip using that stamped id.
    const reparsed = parseTaskLine(rewritten, {})
    expect(reparsed!.id).toBe(parsed!.id)
  })
})
