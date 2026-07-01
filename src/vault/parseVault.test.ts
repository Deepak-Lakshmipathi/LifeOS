/**
 * parseVault unit tests (S14).
 *
 * Covers parseTaskLine + parseVault against the full documented vault shape:
 *   checked / unchecked, missing inline fields, both fields in either order,
 *   invalid domain, malformed lines (skipped), multiple projects/domains,
 *   empty file.
 */

import { describe, it, expect } from 'vitest'
import { parseTaskLine, parseVault } from './parseVault'
import type { Task } from '../types'

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Minimal context used across tests when a real path isn't needed. */
const CTX = { domain: 'Growth', project: 'Reading' }

/** Returns true when obj has the key as an own property (even if value is undefined). */
function hasKey(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

// ─── parseTaskLine — basic checkbox ──────────────────────────────────────────

describe('parseTaskLine — unchecked task', () => {
  it('returns a Task with done=false', () => {
    const t = parseTaskLine('- [ ] Buy groceries', CTX)
    expect(t).not.toBeNull()
    expect(t!.done).toBe(false)
  })

  it('title is extracted correctly', () => {
    const t = parseTaskLine('- [ ] Buy groceries', CTX)
    expect(t!.title).toBe('Buy groceries')
  })

  it('completed_at is ABSENT for unchecked tasks', () => {
    const t = parseTaskLine('- [ ] Not done yet', CTX)
    expect(hasKey(t!, 'completed_at')).toBe(false)
    expect(t!.completed_at).toBeUndefined()
  })

  it('generates a non-empty id', () => {
    const t = parseTaskLine('- [ ] Some task', CTX)
    expect(t!.id).toBeTruthy()
    expect(typeof t!.id).toBe('string')
  })

  it('sets created_at to a recent timestamp', () => {
    const before = Date.now()
    const t = parseTaskLine('- [ ] Some task', CTX)
    const after = Date.now()
    expect(t!.created_at).toBeGreaterThanOrEqual(before)
    expect(t!.created_at).toBeLessThanOrEqual(after)
  })
})

describe('parseTaskLine — checked task', () => {
  it('returns a Task with done=true', () => {
    const t = parseTaskLine('- [x] Completed task', CTX)
    expect(t!.done).toBe(true)
  })

  it('completed_at === created_at when done', () => {
    const t = parseTaskLine('- [x] Completed task', CTX) as Task
    expect(t.completed_at).toBe(t.created_at)
  })

  it('uppercase X is also recognised as done', () => {
    const t = parseTaskLine('- [X] Also done', CTX)
    expect(t!.done).toBe(true)
    expect(t!.completed_at).toBe(t!.created_at)
  })
})

// ─── parseTaskLine — context fields ──────────────────────────────────────────

describe('parseTaskLine — domain from context', () => {
  it('sets domain from ctx.domain', () => {
    const t = parseTaskLine('- [ ] Task', { domain: 'Career', project: 'Work' })
    expect(t!.domain).toBe('Career')
  })

  it('domain is absent when ctx.domain is undefined', () => {
    const t = parseTaskLine('- [ ] Task', { project: 'Work' })
    expect(hasKey(t!, 'domain')).toBe(false)
  })
})

describe('parseTaskLine — project from context', () => {
  it('sets project from ctx.project', () => {
    const t = parseTaskLine('- [ ] Task', { domain: 'Growth', project: 'Reading' })
    expect(t!.project).toBe('Reading')
  })

  it('project is absent when ctx.project is undefined', () => {
    const t = parseTaskLine('- [ ] Task', { domain: 'Growth' })
    expect(hasKey(t!, 'project')).toBe(false)
  })
})

// ─── parseTaskLine — inline fields ───────────────────────────────────────────

describe('parseTaskLine — no inline fields', () => {
  it('done_when is absent when not present on line', () => {
    const t = parseTaskLine('- [ ] Plain task', CTX)
    expect(hasKey(t!, 'done_when')).toBe(false)
  })

  it('priority is absent when not present on line', () => {
    const t = parseTaskLine('- [ ] Plain task', CTX)
    expect(hasKey(t!, 'priority')).toBe(false)
  })
})

describe('parseTaskLine — done_when only', () => {
  it('extracts done_when and strips it from title', () => {
    const t = parseTaskLine('- [ ] Submit report done_when:: PR merged', CTX)
    expect(t!.done_when).toBe('PR merged')
    expect(t!.title).toBe('Submit report')
  })

  it('done_when with multi-word value', () => {
    const t = parseTaskLine('- [ ] Ship feature done_when:: all acceptance tests pass', CTX)
    expect(t!.done_when).toBe('all acceptance tests pass')
  })

  it('priority is absent when not given', () => {
    const t = parseTaskLine('- [ ] Task done_when:: done', CTX)
    expect(hasKey(t!, 'priority')).toBe(false)
  })
})

describe('parseTaskLine — priority only', () => {
  it('extracts priority 1 and strips from title', () => {
    const t = parseTaskLine('- [ ] Low priority task priority:: 1', CTX)
    expect(t!.priority).toBe(1)
    expect(t!.title).toBe('Low priority task')
  })

  it('extracts priority 2', () => {
    const t = parseTaskLine('- [ ] Medium task priority:: 2', CTX)
    expect(t!.priority).toBe(2)
  })

  it('extracts priority 3', () => {
    const t = parseTaskLine('- [ ] High priority task priority:: 3', CTX)
    expect(t!.priority).toBe(3)
  })

  it('done_when is absent when not given', () => {
    const t = parseTaskLine('- [ ] Task priority:: 2', CTX)
    expect(hasKey(t!, 'done_when')).toBe(false)
  })
})

describe('parseTaskLine — both fields, done_when first', () => {
  it('extracts both fields correctly', () => {
    const t = parseTaskLine('- [ ] Write tests done_when:: all pass priority:: 3', CTX)
    expect(t!.title).toBe('Write tests')
    expect(t!.done_when).toBe('all pass')
    expect(t!.priority).toBe(3)
  })
})

describe('parseTaskLine — both fields, priority first', () => {
  it('extracts both fields correctly regardless of order', () => {
    const t = parseTaskLine('- [ ] Write tests priority:: 2 done_when:: coverage at 80%', CTX)
    expect(t!.title).toBe('Write tests')
    expect(t!.priority).toBe(2)
    expect(t!.done_when).toBe('coverage at 80%')
  })
})

describe('parseTaskLine — invalid inline field values', () => {
  it('invalid priority (0) → priority absent, task still returned', () => {
    const t = parseTaskLine('- [ ] Task priority:: 0', CTX)
    expect(t).not.toBeNull()
    expect(hasKey(t!, 'priority')).toBe(false)
  })

  it('invalid priority (4) → priority absent, task still returned', () => {
    const t = parseTaskLine('- [ ] Task priority:: 4', CTX)
    expect(t).not.toBeNull()
    expect(hasKey(t!, 'priority')).toBe(false)
  })

  it('invalid priority (text) → priority absent', () => {
    const t = parseTaskLine('- [ ] Task priority:: high', CTX)
    expect(t).not.toBeNull()
    expect(hasKey(t!, 'priority')).toBe(false)
  })
})

// ─── parseTaskLine — malformed lines ─────────────────────────────────────────

describe('parseTaskLine — malformed lines return null (never throw)', () => {
  it('empty string → null', () => {
    expect(parseTaskLine('', CTX)).toBeNull()
  })

  it('whitespace-only → null', () => {
    expect(parseTaskLine('   ', CTX)).toBeNull()
  })

  it('heading → null', () => {
    expect(parseTaskLine('# My Domain', CTX)).toBeNull()
  })

  it('plain prose → null', () => {
    expect(parseTaskLine('Some random text in the note', CTX)).toBeNull()
  })

  it('incomplete checkbox (missing text) → null', () => {
    // "- [ ]" with nothing after → empty title after trim → skip
    expect(parseTaskLine('- [ ]', CTX)).toBeNull()
  })

  it('incomplete checkbox (no space after bracket) → null', () => {
    expect(parseTaskLine('- [ ]NoSpace', CTX)).toBeNull()
  })

  it('wrong checkbox format → null', () => {
    expect(parseTaskLine('* [ ] Wrong bullet', CTX)).toBeNull()
  })

  it('checked but missing title → null', () => {
    expect(parseTaskLine('- [x]', CTX)).toBeNull()
  })

  it('bulleted non-task line → null', () => {
    expect(parseTaskLine('- Regular bullet point', CTX)).toBeNull()
  })

  it('code fence line → null', () => {
    expect(parseTaskLine('```typescript', CTX)).toBeNull()
  })
})

// ─── parseVault — domain / project extraction ─────────────────────────────────

describe('parseVault — path parsing', () => {
  it('extracts domain from folder and project from filename', () => {
    const files = [{ path: 'Growth/Reading.md', content: '- [ ] Read a book\n' }]
    const tasks = parseVault(files)
    expect(tasks).toHaveLength(1)
    expect(tasks[0]!.domain).toBe('Growth')
    expect(tasks[0]!.project).toBe('Reading')
  })

  it('invalid domain folder → domain is absent', () => {
    const files = [{ path: 'NotADomain/Project.md', content: '- [ ] Some task\n' }]
    const tasks = parseVault(files)
    expect(tasks).toHaveLength(1)
    expect(hasKey(tasks[0]!, 'domain')).toBe(false)
  })

  it('all 7 canonical domains are accepted', () => {
    const domains = [
      'Building Things',
      'Career',
      'Growth',
      'Life Admin',
      'Body & Mind',
      'Finance',
      'Relationship',
    ]
    for (const d of domains) {
      const files = [{ path: `${d}/Project.md`, content: '- [ ] Task\n' }]
      const tasks = parseVault(files)
      expect(tasks[0]!.domain).toBe(d)
    }
  })

  it('filename without .md → project name kept as-is', () => {
    const files = [{ path: 'Career/Side Project.md', content: '- [ ] Task\n' }]
    const tasks = parseVault(files)
    expect(tasks[0]!.project).toBe('Side Project')
  })

  it('back-slash paths are normalised', () => {
    const files = [{ path: 'Finance\\Budget.md', content: '- [ ] Track spending\n' }]
    const tasks = parseVault(files)
    expect(tasks[0]!.domain).toBe('Finance')
    expect(tasks[0]!.project).toBe('Budget')
  })

  it('path with fewer than 2 parts is skipped', () => {
    const files = [{ path: 'lone-file.md', content: '- [ ] Task\n' }]
    const tasks = parseVault(files)
    expect(tasks).toHaveLength(0)
  })
})

// ─── parseVault — empty file ──────────────────────────────────────────────────

describe('parseVault — empty file', () => {
  it('empty content → zero tasks', () => {
    const tasks = parseVault([{ path: 'Growth/Blank.md', content: '' }])
    expect(tasks).toHaveLength(0)
  })

  it('file with only headings/prose → zero tasks', () => {
    const content = '# My Project\n\nSome notes here.\n\nMore prose.\n'
    const tasks = parseVault([{ path: 'Career/Planning.md', content }])
    expect(tasks).toHaveLength(0)
  })
})

// ─── parseVault — multiple projects / domains ─────────────────────────────────

describe('parseVault — multiple projects and domains', () => {
  const files = [
    {
      path: 'Growth/Reading.md',
      content: [
        '# Reading list',
        '- [ ] Read Clean Code done_when:: all chapters done priority:: 2',
        '- [x] Read The Pragmatic Programmer',
        '- Regular note',
        '',
      ].join('\n'),
    },
    {
      path: 'Career/Job Search.md',
      content: [
        '- [ ] Update resume priority:: 3',
        '- [x] Send application done_when:: reply received priority:: 1',
      ].join('\n'),
    },
    {
      path: 'NotADomain/Misc.md',
      content: '- [ ] Task without domain\n',
    },
  ]

  it('parses tasks from all files', () => {
    const tasks = parseVault(files)
    expect(tasks).toHaveLength(5)
  })

  it('Growth tasks carry correct domain/project', () => {
    const tasks = parseVault(files).filter((t) => t.domain === 'Growth')
    expect(tasks).toHaveLength(2)
    expect(tasks.every((t) => t.project === 'Reading')).toBe(true)
  })

  it('Career tasks carry correct domain/project', () => {
    const tasks = parseVault(files).filter((t) => t.domain === 'Career')
    expect(tasks).toHaveLength(2)
    expect(tasks.every((t) => t.project === 'Job Search')).toBe(true)
  })

  it('invalid domain task has no domain field', () => {
    const tasks = parseVault(files).filter((t) => !hasKey(t, 'domain'))
    expect(tasks).toHaveLength(1)
    expect(tasks[0]!.title).toBe('Task without domain')
  })

  it('inline fields survive across multiple files', () => {
    const tasks = parseVault(files)
    const cleanCode = tasks.find((t) => t.title === 'Read Clean Code')!
    expect(cleanCode.done_when).toBe('all chapters done')
    expect(cleanCode.priority).toBe(2)

    const updateResume = tasks.find((t) => t.title === 'Update resume')!
    expect(updateResume.priority).toBe(3)

    const sendApp = tasks.find((t) => t.title === 'Send application')!
    expect(sendApp.done).toBe(true)
    expect(sendApp.done_when).toBe('reply received')
    expect(sendApp.priority).toBe(1)
    expect(sendApp.completed_at).toBe(sendApp.created_at)
  })

  it('non-task lines are skipped without affecting task count', () => {
    // File 1 has a heading and blank line — still only 2 tasks from it
    const tasks = parseVault(files).filter((t) => t.domain === 'Growth')
    expect(tasks).toHaveLength(2)
  })
})

// ─── parseVault — unique ids per task ────────────────────────────────────────

describe('parseVault — task identity', () => {
  it('every task gets a unique id', () => {
    const files = [
      {
        path: 'Growth/Project.md',
        content: '- [ ] Task A\n- [ ] Task B\n- [x] Task C\n',
      },
    ]
    const tasks = parseVault(files)
    const ids = tasks.map((t) => t.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

// ─── parseVault — zero files ──────────────────────────────────────────────────

describe('parseVault — empty input', () => {
  it('empty files array → empty task array', () => {
    const tasks = parseVault([])
    expect(tasks).toHaveLength(0)
  })
})
