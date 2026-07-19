/**
 * Issue #120 — useTasks must not set state after unmount.
 *
 * The bug: the initial-load effect fired provider.list() and called
 * setTasks/setLoading in .then/.catch with no unmount guard, so a load that
 * resolved after the component unmounted touched a torn-down jsdom window
 * (ReferenceError → whole vitest run red). This pins the cancelled-flag guard.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTasks } from '../hooks/useTasks'
import type { SyncProvider } from '../sync/SyncProvider'

function deferredProvider() {
  let resolve!: (v: never[]) => void
  let reject!: (e: unknown) => void
  const list = vi.fn(() => new Promise<never[]>((res, rej) => { resolve = res as never; reject = rej }))
  const provider = { list } as unknown as SyncProvider
  return { provider, resolve: () => resolve([]), reject: () => reject(new Error('boom')) }
}

describe('useTasks unmount guard (#120)', () => {
  it('does not setState when list() resolves after unmount', async () => {
    const { provider, resolve } = deferredProvider()
    const { result, unmount } = renderHook(() => useTasks(provider))
    expect(result.current.loading).toBe(true)

    unmount()
    // Resolve AFTER unmount — the guard must swallow the setState.
    await act(async () => { resolve() })

    // loading was true at mount; a leaked setState would have flipped it.
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('does not setError when list() rejects after unmount', async () => {
    const { provider, reject } = deferredProvider()
    const { result, unmount } = renderHook(() => useTasks(provider))
    unmount()
    await act(async () => { reject() })
    expect(result.current.error).toBeNull()
  })
})
