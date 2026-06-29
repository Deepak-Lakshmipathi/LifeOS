import { describe, it, expect } from 'vitest'
import { groupByDomain, domainForProject, NO_DOMAIN_LABEL } from '../lib/groupByDomain'
import { DOMAINS } from '../data/domains'
import type { Task } from '../types'

function makeTask(overrides: Partial<Task> & { title: string }): Task {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    title: overrides.title,
    done: overrides.done ?? false,
    created_at: overrides.created_at ?? Date.now(),
    done_when: overrides.done_when,
    priority: overrides.priority,
    project: overrides.project,
    domain: overrides.domain,
  }
}

describe('groupByDomain', () => {
  it('returns [] for empty input', () => {
    expect(groupByDomain([])).toEqual([])
  })

  it('puts tasks with no domain into the Inbox bucket (key null, label NO_DOMAIN_LABEL, sorts first)', () => {
    const t1 = makeTask({ title: 'No domain 1' })
    const t2 = makeTask({ title: 'No domain 2' })
    const groups = groupByDomain([t1, t2])

    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBeNull()
    expect(groups[0].label).toBe(NO_DOMAIN_LABEL)
    expect(groups[0].projects.flatMap((p) => p.tasks)).toHaveLength(2)
  })

  it('puts tasks with an invalid domain into the Inbox bucket', () => {
    const t = makeTask({ title: 'Bad domain', domain: 'NotADomain' })
    const groups = groupByDomain([t])

    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBeNull()
    expect(groups[0].label).toBe(NO_DOMAIN_LABEL)
  })

  it('Inbox bucket sorts first even when named domain tasks also exist', () => {
    const inbox = makeTask({ title: 'Inbox task' })
    const named = makeTask({ title: 'Career task', domain: 'Career' })
    const groups = groupByDomain([named, inbox])

    expect(groups[0].key).toBeNull()
    expect(groups[1].key).toBe('Career')
  })

  it('present domains follow DOMAINS array order (not alphabetical)', () => {
    // Add tasks in reverse DOMAINS order to confirm sort is by DOMAINS, not alpha
    const tasks = [
      makeTask({ title: 'Relationship task', domain: 'Relationship' }),
      makeTask({ title: 'Finance task', domain: 'Finance' }),
      makeTask({ title: 'Building task', domain: 'Building Things' }),
    ]
    const groups = groupByDomain(tasks)
    const keys = groups.map((g) => g.key)

    // Building Things comes before Finance which comes before Relationship (per DOMAINS)
    expect(keys.indexOf('Building Things')).toBeLessThan(keys.indexOf('Finance'))
    expect(keys.indexOf('Finance')).toBeLessThan(keys.indexOf('Relationship'))
  })

  it('only domains that have tasks appear in output', () => {
    const t = makeTask({ title: 'Only career', domain: 'Career' })
    const groups = groupByDomain([t])

    const keys = groups.map((g) => g.key)
    expect(keys).toContain('Career')
    // Other domains should NOT appear
    for (const domain of DOMAINS) {
      if (domain !== 'Career') {
        expect(keys).not.toContain(domain)
      }
    }
  })

  it('within a domain, projects come from groupByProject (Inbox-first, then alphabetical)', () => {
    const tasks = [
      makeTask({ title: 'Named project task', domain: 'Growth', project: 'Alpha' }),
      makeTask({ title: 'Inbox task', domain: 'Growth' }), // no project — goes to project Inbox
    ]
    const groups = groupByDomain(tasks)

    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('Growth')

    const projectGroups = groups[0].projects
    expect(projectGroups[0].key).toBeNull() // project Inbox first
    expect(projectGroups[1].key).toBe('Alpha')
  })

  it('all 7 DOMAINS are in correct order relative to each other when all present', () => {
    const tasks = DOMAINS.map((d) => makeTask({ title: `Task for ${d}`, domain: d }))
    // Shuffle input
    const shuffled = [...tasks].reverse()
    const groups = groupByDomain(shuffled)

    const keys = groups.map((g) => g.key)
    DOMAINS.forEach((domain, i) => {
      expect(keys[i]).toBe(domain)
    })
  })

  it('nested project groups have correct tasks', () => {
    const t1 = makeTask({ title: 'Task A', domain: 'Finance', project: 'Investing' })
    const t2 = makeTask({ title: 'Task B', domain: 'Finance', project: 'Investing' })
    const t3 = makeTask({ title: 'Task C', domain: 'Finance' })
    const groups = groupByDomain([t1, t2, t3])

    expect(groups).toHaveLength(1)
    const finance = groups[0]
    expect(finance.key).toBe('Finance')

    // Inbox project (no project) first, then Investing
    expect(finance.projects[0].key).toBeNull()
    expect(finance.projects[0].tasks).toHaveLength(1)
    expect(finance.projects[1].key).toBe('Investing')
    expect(finance.projects[1].tasks).toHaveLength(2)
  })
})

describe('domainForProject', () => {
  it('returns domain of the first task whose project matches (exact)', () => {
    const tasks = [
      makeTask({ title: 'T1', project: 'LifeOS', domain: 'Building Things' }),
    ]
    expect(domainForProject(tasks, 'LifeOS')).toBe('Building Things')
  })

  it('matches case-insensitively', () => {
    const tasks = [
      makeTask({ title: 'T1', project: 'LifeOS', domain: 'Building Things' }),
    ]
    expect(domainForProject(tasks, 'lifeos')).toBe('Building Things')
    expect(domainForProject(tasks, 'LIFEOS')).toBe('Building Things')
  })

  it('returns undefined when no task matches', () => {
    const tasks = [
      makeTask({ title: 'T1', project: 'Other', domain: 'Career' }),
    ]
    expect(domainForProject(tasks, 'LifeOS')).toBeUndefined()
  })

  it('returns undefined for empty tasks array', () => {
    expect(domainForProject([], 'LifeOS')).toBeUndefined()
  })

  it('returns undefined when matching task has no domain', () => {
    const tasks = [
      makeTask({ title: 'T1', project: 'LifeOS' }), // no domain
    ]
    expect(domainForProject(tasks, 'LifeOS')).toBeUndefined()
  })

  it('returns undefined for empty project string', () => {
    const tasks = [
      makeTask({ title: 'T1', project: 'LifeOS', domain: 'Building Things' }),
    ]
    expect(domainForProject(tasks, '')).toBeUndefined()
  })
})
