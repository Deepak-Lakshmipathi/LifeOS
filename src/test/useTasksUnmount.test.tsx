/**
 * Issue #120 — useTasks must not run its async continuations after unmount.
 *
 * The bug: the initial-load effect (and refresh()) fired provider.list() and
 * called setTasks/setLoading/setError with no unmount guard, so a load that
 * resolved after unmount touched a torn-down jsdom window (ReferenceError →
 * whole vitest run red).
 *
 * Why this test asserts on console.error, not result.current: React 18
 * silently no-ops a setState on an already-unmounted fiber, so a leaked
 * setState is invisible through result.current — the assertion would pass with
 * OR without the guard (vacuous). Instead we spy on the `console.error` that
 * lives AFTER the guard on the .catch path: with the guard it never runs; strip
 * the guard and it fires. This test fails if the guard is removed.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTasks } from '../hooks/useTasks'
import type { SyncProvider } from '../sync/SyncProvider'

function deferredProvider() {
  let resolve!: (v: never[]) => void
  let reject!: (e: unknown) => void
  const p = new Promise<never[]>((res, rej) => { resolve = res as never; reject = rej })
  const list = vi.fn(() => p)
  const provider = { list } as unknown as SyncProvider
  return { provider, resolve: () => resolve([]), reject: () => reject(new Error('boom')) }
}

afterEach(() => vi.restoreAllMocks())

describe('useTasks unmount guard (#120)', () => {
  it('does not log (does not run the .catch continuation) when list() rejects after unmount', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { provider, reject } = deferredProvider()
    const { unmount } = renderHook(() => useTasks(provider))

    unmount()
    // Reject AFTER unmount — the guard must short-circuit before console.error.
    await act(async () => { reject() })

    // Guard present → the continuation returns early → no error logged.
    // (Remove the `if (!mountedRef.current) return` line and this fails.)
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not throw when list() resolves after unmount', async () => {
    const { provider, resolve } = deferredProvider()
    const { unmount } = renderHook(() => useTasks(provider))
    unmount()
    // A settled-after-unmount resolve must not throw an unhandled rejection.
    await expect(act(async () => { resolve() })).resolves.not.toThrow()
  })
})
