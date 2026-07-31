/**
 * selfLoadTasks memo — #167 (retry after a rejected first read) and #168
 * (test reset seam).
 *
 * `LocalOnly.prototype.list` is spied/mocked directly (the established
 * pattern in Aurora.test.tsx) rather than exercising real IndexedDB, so
 * these tests can deterministically control resolve/reject timing and
 * count invocations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalOnly } from './LocalOnly'
import { selfLoadTasks, __resetSelfLoadTasksCache } from './selfLoadTasks'
import type { Task } from '../types'

beforeEach(() => {
  __resetSelfLoadTasksCache()
  vi.restoreAllMocks()
})

const TASKS: Task[] = [{ id: 't1', title: 'Task one', done: false, created_at: 1 }]

describe('selfLoadTasks — #167 retry after rejection', () => {
  it('a rejected first load does not poison the memo — the next call retries and can succeed', async () => {
    const listSpy = vi
      .spyOn(LocalOnly.prototype, 'list')
      .mockRejectedValueOnce(new Error('transient IndexedDB error'))
      .mockResolvedValueOnce(TASKS)

    await expect(selfLoadTasks()).rejects.toThrow('transient IndexedDB error')

    // Second call must actually retry (call the provider again), not return
    // the same cached rejection.
    await expect(selfLoadTasks()).resolves.toEqual(TASKS)
    expect(listSpy).toHaveBeenCalledTimes(2)
  })

  it('a successful load still resolves to a single shared read for concurrent callers', async () => {
    const listSpy = vi.spyOn(LocalOnly.prototype, 'list').mockResolvedValue(TASKS)

    const [a, b, c] = await Promise.all([selfLoadTasks(), selfLoadTasks(), selfLoadTasks()])

    expect(a).toEqual(TASKS)
    expect(b).toEqual(TASKS)
    expect(c).toEqual(TASKS)
    expect(listSpy).toHaveBeenCalledTimes(1)
  })

  it('after a successful load, a later call still shares the same memoized read (no needless re-fetch)', async () => {
    const listSpy = vi.spyOn(LocalOnly.prototype, 'list').mockResolvedValue(TASKS)

    await selfLoadTasks()
    await selfLoadTasks()

    expect(listSpy).toHaveBeenCalledTimes(1)
  })
})

describe('selfLoadTasks — #168 test reset seam', () => {
  it('__resetSelfLoadTasksCache() forces the next call to re-invoke the provider', async () => {
    const listSpy = vi.spyOn(LocalOnly.prototype, 'list').mockResolvedValue(TASKS)

    await selfLoadTasks()
    expect(listSpy).toHaveBeenCalledTimes(1)

    __resetSelfLoadTasksCache()

    await selfLoadTasks()
    expect(listSpy).toHaveBeenCalledTimes(2)
  })
})
