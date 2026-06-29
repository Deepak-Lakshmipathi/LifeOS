/**
 * Tests for seedIfEmpty (Slice S5, ADR-0006).
 *
 * seedIfEmpty reads location.search for the ?noseed test hook.
 * We use vi.stubGlobal to control the URL in each test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Dexie from 'dexie'
import 'fake-indexeddb/auto'
import { LocalOnly } from '../sync/LocalOnly'
import { seedIfEmpty } from '../data/seed'
import type { SyncProvider } from '../sync/SyncProvider'

function makeProvider(): SyncProvider {
  return new LocalOnly()
}

describe('seedIfEmpty', () => {
  let provider: SyncProvider

  beforeEach(async () => {
    await Dexie.delete('LifeOS')
    provider = makeProvider()
    // Default: no ?noseed in URL
    vi.stubGlobal('location', { search: '' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── Test hook ─────────────────────────────────────────────────────────────

  it('returns 0 immediately when ?noseed is present (test hook)', async () => {
    vi.stubGlobal('location', { search: '?noseed' })
    const count = await seedIfEmpty(provider)
    expect(count).toBe(0)

    // No tasks should have been written
    const tasks = await provider.list()
    expect(tasks).toHaveLength(0)
  })

  // ── Happy-path import ──────────────────────────────────────────────────────

  it('seeds all 107 tasks on an empty DB and returns 107', async () => {
    const count = await seedIfEmpty(provider)
    expect(count).toBe(107)

    const tasks = await provider.list()
    expect(tasks).toHaveLength(107)
  })

  // ── Idempotency ────────────────────────────────────────────────────────────

  it('is idempotent — second call on a non-empty DB returns 0 and adds no tasks', async () => {
    await seedIfEmpty(provider)
    const count2 = await seedIfEmpty(provider)
    expect(count2).toBe(0)

    const tasks = await provider.list()
    expect(tasks).toHaveLength(107) // still exactly 107, not 214
  })

  // ── Field mapping ──────────────────────────────────────────────────────────

  it('maps JSON folder → domain (e.g. Building Things)', async () => {
    await seedIfEmpty(provider)
    const tasks = await provider.list()

    const startupTask = tasks.find((t) => t.project === 'Startup')
    expect(startupTask).toBeDefined()
    expect(startupTask!.domain).toBe('Building Things')
  })

  it('maps JSON name → project (e.g. Startup)', async () => {
    await seedIfEmpty(provider)
    const tasks = await provider.list()

    const startupTasks = tasks.filter((t) => t.project === 'Startup')
    expect(startupTasks.length).toBeGreaterThan(0)
  })

  it('carries priority values correctly (priority 3 on first Startup task)', async () => {
    await seedIfEmpty(provider)
    const tasks = await provider.list()

    const task = tasks.find((t) => t.title === 'Finalize company structure (OPC vs Pvt Ltd)')
    expect(task).toBeDefined()
    expect(task!.priority).toBe(3)
  })

  it('carries done_when values correctly', async () => {
    await seedIfEmpty(provider)
    const tasks = await provider.list()

    const task = tasks.find((t) => t.title === 'Finalize company structure (OPC vs Pvt Ltd)')
    expect(task).toBeDefined()
    expect(task!.done_when).toBe('Written decision in ~/docs/startup/structure.md with rationale')
  })

  it('all 7 canonical domains appear in seeded tasks', async () => {
    await seedIfEmpty(provider)
    const tasks = await provider.list()

    const domains = new Set(tasks.map((t) => t.domain).filter(Boolean))
    expect(domains.has('Building Things')).toBe(true)
    expect(domains.has('Career')).toBe(true)
    expect(domains.has('Growth')).toBe(true)
    expect(domains.has('Life Admin')).toBe(true)
    expect(domains.has('Body & Mind')).toBe(true)
    expect(domains.has('Finance')).toBe(true)
    expect(domains.has('Relationship')).toBe(true)
  })

  it('maps Career domain tasks correctly (Job Hunt project)', async () => {
    await seedIfEmpty(provider)
    const tasks = await provider.list()

    const careerTasks = tasks.filter((t) => t.domain === 'Career')
    expect(careerTasks.length).toBeGreaterThan(0)
    expect(careerTasks.every((t) => t.project === 'Job Hunt')).toBe(true)
  })
})
