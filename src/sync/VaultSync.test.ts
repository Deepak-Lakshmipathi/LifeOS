/**
 * VaultSync unit tests (S15a).
 *
 * All tests use a FakeTransport so no git, network, IndexedDB, or jsdom-hostile
 * side effects are exercised.  The fake captures writeFile calls into an array
 * and keeps the in-memory file list consistent.
 *
 * Test matrix (as required by the issue):
 *   (a) add() writes the resolved path with the new line appended.
 *   (b) toggleDone() flips the checkbox on the target line; every other byte
 *       of the file is identical.
 *   (c) update() rewrites inline fields on the right line; all others intact.
 *   (d) delete() removes the matched line; all others intact.
 *   (e) a duplicate identical rawLine makes the mutation throw.
 *   (f) two concurrent mutations serialize FIFO through the queue.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { VaultSync } from './VaultSync'
import type { VaultTransport } from '../vault/transport'

// ─── FakeTransport ────────────────────────────────────────────────────────────

interface WriteCall {
  path: string
  content: string
  message: string
}

/**
 * In-memory VaultTransport.
 *
 * readFiles() returns the current in-memory file list.
 * writeFile() records each call and updates the file list in place so that
 *   subsequent reads/mutations see the latest content.
 */
class FakeTransport implements VaultTransport {
  readonly writeCalls: WriteCall[] = []
  private readonly files: { path: string; content: string }[]

  constructor(files: { path: string; content: string }[] = []) {
    // Deep-copy so each test starts with its own slice of data
    this.files = files.map((f) => ({ ...f }))
  }

  readFiles() {
    return Promise.resolve(this.files.map((f) => ({ ...f })))
  }

  writeFile(path: string, content: string, message: string) {
    this.writeCalls.push({ path, content, message })
    const existing = this.files.find((f) => f.path === path)
    if (existing) {
      existing.content = content
    } else {
      this.files.push({ path, content })
    }
    return Promise.resolve()
  }
}

// ─── (a) add — path resolution + content ─────────────────────────────────────

describe('VaultSync.add — path resolution and line append', () => {
  it('appends to an existing file for domain+project', async () => {
    const transport = new FakeTransport([
      { path: 'Growth/Reading.md', content: '- [ ] Existing task\n' },
    ])
    const sync = new VaultSync(transport)
    await sync.list()

    await sync.add({ title: 'New task', domain: 'Growth', project: 'Reading' })

    expect(transport.writeCalls).toHaveLength(1)
    expect(transport.writeCalls[0]!.path).toBe('Growth/Reading.md')
    expect(transport.writeCalls[0]!.content).toBe('- [ ] Existing task\n- [ ] New task\n')
  })

  it('resolves domain only → <domain>/Inbox.md', async () => {
    const transport = new FakeTransport()
    const sync = new VaultSync(transport)
    await sync.list()

    await sync.add({ title: 'Unprojecte task', domain: 'Career' })

    expect(transport.writeCalls[0]!.path).toBe('Career/Inbox.md')
  })

  it('resolves project only → Inbox/<project>.md', async () => {
    const transport = new FakeTransport()
    const sync = new VaultSync(transport)
    await sync.list()

    await sync.add({ title: 'Orphan task', project: 'SomeProject' })

    expect(transport.writeCalls[0]!.path).toBe('Inbox/SomeProject.md')
  })

  it('resolves neither → Inbox/Inbox.md', async () => {
    const transport = new FakeTransport()
    const sync = new VaultSync(transport)
    await sync.list()

    await sync.add({ title: 'Unsorted task' })

    expect(transport.writeCalls[0]!.path).toBe('Inbox/Inbox.md')
  })

  it('creates file content when the target file does not yet exist', async () => {
    const transport = new FakeTransport()
    const sync = new VaultSync(transport)
    await sync.list()

    const task = await sync.add({ title: 'Brand new', priority: 2 })

    expect(transport.writeCalls[0]!.content).toBe(`- [ ] Brand new priority:: 2\n`)
    expect(task.title).toBe('Brand new')
    expect(task.priority).toBe(2)
    expect(task.done).toBe(false)
  })

  it('includes done_when in the serialized line', async () => {
    const transport = new FakeTransport()
    const sync = new VaultSync(transport)
    await sync.list()

    await sync.add({ title: 'Criterioned', done_when: 'tests green', priority: 3 })

    expect(transport.writeCalls[0]!.content).toBe(
      '- [ ] Criterioned done_when:: tests green priority:: 3\n',
    )
  })

  it('rejects an empty title', async () => {
    const transport = new FakeTransport()
    const sync = new VaultSync(transport)
    await sync.list()

    await expect(sync.add({ title: '  ' })).rejects.toThrow('must not be empty')
  })

  it('rejects an invalid priority', async () => {
    const transport = new FakeTransport()
    const sync = new VaultSync(transport)
    await sync.list()

    await expect(sync.add({ title: 'Bad priority', priority: 4 as 1 | 2 | 3 })).rejects.toThrow(
      'priority must be 1, 2, or 3',
    )
  })
})

// ─── (b) toggleDone — checkbox flip, other bytes identical ───────────────────

describe('VaultSync.toggleDone — checkbox flip', () => {
  it('flips unchecked → checked on the target line', async () => {
    const transport = new FakeTransport([
      { path: 'Growth/Reading.md', content: '# Notes\n- [ ] Task A\n- [ ] Task B\n' },
    ])
    const sync = new VaultSync(transport)
    const tasks = await sync.list()

    const taskA = tasks.find((t) => t.title === 'Task A')!
    await sync.toggleDone(taskA.id)

    expect(transport.writeCalls).toHaveLength(1)
    expect(transport.writeCalls[0]!.content).toBe('# Notes\n- [x] Task A\n- [ ] Task B\n')
  })

  it('flips checked → unchecked on the target line', async () => {
    const transport = new FakeTransport([
      { path: 'Career/Work.md', content: '- [x] Done item\n- [ ] Pending\n' },
    ])
    const sync = new VaultSync(transport)
    const tasks = await sync.list()

    const done = tasks.find((t) => t.title === 'Done item')!
    expect(done.done).toBe(true)

    await sync.toggleDone(done.id)

    expect(transport.writeCalls[0]!.content).toBe('- [ ] Done item\n- [ ] Pending\n')
  })

  it('every other byte of the file is identical after toggle', async () => {
    const original = '# Heading\n- [ ] Target task\n- [ ] Other task\nSome prose\n'
    const transport = new FakeTransport([{ path: 'Growth/Test.md', content: original }])
    const sync = new VaultSync(transport)
    const tasks = await sync.list()

    const target = tasks.find((t) => t.title === 'Target task')!
    await sync.toggleDone(target.id)

    const after = transport.writeCalls[0]!.content
    // Replace the toggled line with the original line — result must equal original
    const restored = after.replace('- [x] Target task', '- [ ] Target task')
    expect(restored).toBe(original)
  })

  it('toggleDone on a done task with priority round-trips cleanly', async () => {
    const transport = new FakeTransport([
      { path: 'Finance/Budget.md', content: '- [x] Review budget priority:: 2\n' },
    ])
    const sync = new VaultSync(transport)
    const tasks = await sync.list()

    const task = tasks.find((t) => t.title === 'Review budget')!
    const updated = await sync.toggleDone(task.id)

    expect(updated.done).toBe(false)
    expect(updated.priority).toBe(2)
    expect(transport.writeCalls[0]!.content).toBe('- [ ] Review budget priority:: 2\n')
  })

  it('throws when id is unknown', async () => {
    const transport = new FakeTransport([])
    const sync = new VaultSync(transport)
    await sync.list()

    await expect(sync.toggleDone('no-such-id')).rejects.toThrow('not found')
  })
})

// ─── (c) update — inline field rewrite ───────────────────────────────────────

describe('VaultSync.update — inline field rewrite', () => {
  it('rewrites priority on the correct line and leaves others intact', async () => {
    const transport = new FakeTransport([
      {
        path: 'Career/Work.md',
        content: '- [ ] Write report priority:: 2\n- [ ] Other task\n',
      },
    ])
    const sync = new VaultSync(transport)
    const tasks = await sync.list()

    const report = tasks.find((t) => t.title === 'Write report')!
    const updated = await sync.update(report.id, { priority: 3 })

    expect(updated.priority).toBe(3)
    expect(transport.writeCalls[0]!.content).toBe(
      '- [ ] Write report priority:: 3\n- [ ] Other task\n',
    )
  })

  it('adds done_when to a task that had none', async () => {
    const transport = new FakeTransport([
      { path: 'Growth/Reading.md', content: '- [ ] Read a book\n' },
    ])
    const sync = new VaultSync(transport)
    const tasks = await sync.list()

    const book = tasks[0]!
    await sync.update(book.id, { done_when: 'all chapters done' })

    expect(transport.writeCalls[0]!.content).toBe(
      '- [ ] Read a book done_when:: all chapters done\n',
    )
  })

  it('clears done_when when patch sets it to empty string', async () => {
    const transport = new FakeTransport([
      { path: 'Growth/Reading.md', content: '- [ ] Read a book done_when:: criterion\n' },
    ])
    const sync = new VaultSync(transport)
    const tasks = await sync.list()

    const book = tasks[0]!
    await sync.update(book.id, { done_when: '' })

    expect(transport.writeCalls[0]!.content).toBe('- [ ] Read a book\n')
  })

  it('updates the title on the line', async () => {
    const transport = new FakeTransport([
      { path: 'Career/Work.md', content: '- [ ] Old title\n- [ ] Another\n' },
    ])
    const sync = new VaultSync(transport)
    const tasks = await sync.list()

    const old = tasks.find((t) => t.title === 'Old title')!
    await sync.update(old.id, { title: 'New title' })

    expect(transport.writeCalls[0]!.content).toBe('- [ ] New title\n- [ ] Another\n')
  })

  it('throws for unknown id', async () => {
    const transport = new FakeTransport([])
    const sync = new VaultSync(transport)
    await sync.list()

    await expect(sync.update('no-such-id', { title: 'X' })).rejects.toThrow('not found')
  })

  it('rejects an empty title patch', async () => {
    const transport = new FakeTransport([
      { path: 'Growth/Reading.md', content: '- [ ] Task\n' },
    ])
    const sync = new VaultSync(transport)
    const tasks = await sync.list()

    await expect(sync.update(tasks[0]!.id, { title: '  ' })).rejects.toThrow('must not be empty')
  })
})

// ─── (d) delete — line removal ────────────────────────────────────────────────

describe('VaultSync.delete — line removal', () => {
  it('removes the target line and leaves all others byte-identical', async () => {
    const transport = new FakeTransport([
      { path: 'Growth/Reading.md', content: '- [ ] Task A\n- [ ] Task B\n- [ ] Task C\n' },
    ])
    const sync = new VaultSync(transport)
    const tasks = await sync.list()

    const taskB = tasks.find((t) => t.title === 'Task B')!
    await sync.delete(taskB.id)

    expect(transport.writeCalls).toHaveLength(1)
    expect(transport.writeCalls[0]!.content).toBe('- [ ] Task A\n- [ ] Task C\n')
  })

  it('deleting the only task leaves an empty-ish file', async () => {
    const transport = new FakeTransport([
      { path: 'Inbox/Inbox.md', content: '- [ ] Sole task\n' },
    ])
    const sync = new VaultSync(transport)
    const tasks = await sync.list()

    await sync.delete(tasks[0]!.id)

    // '- [ ] Sole task\n'.split('\n') → ['- [ ] Sole task', '']
    // After removing index 0 → ['']
    // [''].join('\n') → ''
    expect(transport.writeCalls[0]!.content).toBe('')
  })

  it('throws for unknown id', async () => {
    const transport = new FakeTransport([])
    const sync = new VaultSync(transport)
    await sync.list()

    await expect(sync.delete('ghost-id')).rejects.toThrow('not found')
  })
})

// ─── (e) duplicate rawLine → throw ───────────────────────────────────────────

describe('VaultSync mutations — ambiguous (duplicate) rawLine throws', () => {
  const dupLine = '- [ ] Duplicate task'

  let sync: VaultSync
  let tasks: Awaited<ReturnType<VaultSync['list']>>

  beforeEach(async () => {
    const transport = new FakeTransport([
      {
        path: 'Growth/Reading.md',
        content: `${dupLine}\n${dupLine}\n`,
      },
    ])
    sync = new VaultSync(transport)
    tasks = await sync.list()
  })

  it('list() returns two tasks (one per line)', () => {
    expect(tasks).toHaveLength(2)
  })

  it('toggleDone throws when the rawLine is ambiguous', async () => {
    await expect(sync.toggleDone(tasks[0]!.id)).rejects.toThrow(/[Aa]mbiguous|stale/)
  })

  it('update throws when the rawLine is ambiguous', async () => {
    await expect(sync.update(tasks[0]!.id, { priority: 1 })).rejects.toThrow(/[Aa]mbiguous|stale/)
  })

  it('delete throws when the rawLine is ambiguous', async () => {
    await expect(sync.delete(tasks[0]!.id)).rejects.toThrow(/[Aa]mbiguous|stale/)
  })
})

// ─── (f) queue — concurrent mutations serialize FIFO ─────────────────────────

describe('VaultSync queue — concurrent mutations serialize FIFO', () => {
  it('two concurrent add() calls execute in call order', async () => {
    const callOrder: string[] = []

    const transport: VaultTransport = {
      readFiles: () => Promise.resolve([]),
      writeFile(_path, _content, message) {
        callOrder.push(message)
        return Promise.resolve()
      },
    }

    const sync = new VaultSync(transport)
    await sync.list()

    // Fire both synchronously — neither has awaited yet
    const p1 = sync.add({ title: 'Alpha' })
    const p2 = sync.add({ title: 'Beta' })

    await Promise.all([p1, p2])

    expect(callOrder).toHaveLength(2)
    // FIFO: Alpha was enqueued first, must write first
    expect(callOrder[0]).toContain('Alpha')
    expect(callOrder[1]).toContain('Beta')
  })

  it('a failed mutation does not block the queue', async () => {
    const transport = new FakeTransport([
      { path: 'Growth/Reading.md', content: '- [ ] Task A\n' },
    ])
    const sync = new VaultSync(transport)
    const tasks = await sync.list()

    const taskA = tasks[0]!

    // First mutation will fail (invalid priority)
    const bad = sync.update(taskA.id, { priority: 99 as 1 | 2 | 3 })
    // Second mutation is valid
    const good = sync.toggleDone(taskA.id)

    await expect(bad).rejects.toThrow('priority')
    // Good should still complete despite bad failing
    const result = await good
    expect(result.done).toBe(true)
  })

  it('three concurrent adds write in order', async () => {
    const titles: string[] = []

    const transport: VaultTransport = {
      readFiles: () => Promise.resolve([]),
      writeFile(_path, content, _message) {
        // Extract the task title from the written line
        const match = content.match(/- \[ \] (.+)\n?$/)
        if (match) titles.push(match[1]!)
        return Promise.resolve()
      },
    }

    const sync = new VaultSync(transport)
    await sync.list()

    const p1 = sync.add({ title: 'First' })
    const p2 = sync.add({ title: 'Second' })
    const p3 = sync.add({ title: 'Third' })

    await Promise.all([p1, p2, p3])

    // The first write contains only 'First', second only 'Second', etc.
    // (each append builds on the previous content, but the TITLE order is FIFO)
    expect(titles[0]).toBe('First')
    expect(titles[1]).toBe('Second')
    expect(titles[2]).toBe('Third')
  })
})

// ─── snapshot is updated after mutations ─────────────────────────────────────

describe('VaultSync snapshot consistency after mutations', () => {
  it('subsequent toggleDone works after an update (snapshot stays live)', async () => {
    const transport = new FakeTransport([
      { path: 'Finance/Budget.md', content: '- [ ] Track spending priority:: 1\n' },
    ])
    const sync = new VaultSync(transport)
    const tasks = await sync.list()

    const task = tasks[0]!
    // Update changes rawLine — snapshot must reflect the new line
    await sync.update(task.id, { priority: 2 })
    // Now toggle — should find the updated rawLine, not the stale one
    const toggled = await sync.toggleDone(task.id)

    expect(toggled.done).toBe(true)
    expect(toggled.priority).toBe(2)
    expect(transport.writeCalls[1]!.content).toBe('- [x] Track spending priority:: 2\n')
  })
})
