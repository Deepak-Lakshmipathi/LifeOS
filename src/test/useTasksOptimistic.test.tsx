/**
 * S64 (#174) — optimistic task writes.
 *
 * Root cause on master: every write path in useTasks.ts does
 * `await provider.X(...)` then `await refresh()` — two serialized round
 * trips before React ever sees a state change. VaultSync already IS the
 * cache (it returns the persisted Task and updates its own snapshot), so
 * the re-read buys nothing; it just sits in the user-visible latency path.
 *
 * Anti-vacuity harness rule (the #120 lesson, restated by S64's ticket):
 * clicks are driven with the SYNCHRONOUS `act(() => { void promise })`,
 * never `await act(async () => ...)`. The async form drains microtasks and
 * would let a master-shaped implementation reach its `setTasks`, passing
 * the test for the wrong reason. Every assertion that must hold BEFORE the
 * provider settles is therefore taken immediately after a sync `act`, with
 * no `await` in between.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTasks } from '../hooks/useTasks'
import type { SyncProvider } from '../sync/SyncProvider'
import type { Task } from '../types'

// ─── deferred<T>() — load-bearing mock shape ───────────────────────────────
// Exposes isSettled() so test (a) can mechanically prove an assertion is
// taken pre-settle rather than relying on timing.

function deferred<T>() {
  let resolveFn!: (v: T) => void
  let rejectFn!: (e: unknown) => void
  let settled = false
  const promise = new Promise<T>((res, rej) => {
    resolveFn = (v: T) => {
      settled = true
      res(v)
    }
    rejectFn = (e: unknown) => {
      settled = true
      rej(e)
    }
  })
  return {
    promise,
    resolve: resolveFn,
    reject: rejectFn,
    isSettled: () => settled,
  }
}

// ─── fixtures ───────────────────────────────────────────────────────────────
// Distinct created_at and domain so newest-first ordering and rollback
// scoping are both observable.

const A: Task = { id: 'a', title: 'Task A', done: false, created_at: 2000, domain: 'Growth' }
const B: Task = { id: 'b', title: 'Task B', done: false, created_at: 1000, domain: 'Career' }

// ─── provider mock ──────────────────────────────────────────────────────────
// `list` resolves via a controllable deferred (mount, or a manually-held
// stale call). `toggleDone` hands back a fresh per-call deferred so a
// caller can resolve/reject a specific call (e.g. the follow-up call
// issued by the deferred-inversion latch) independently of earlier ones.

function makeDeferredProvider() {
  const listDeferred = deferred<Task[]>()
  const list = vi.fn(() => listDeferred.promise)

  const calls: Array<{ id: string; d: ReturnType<typeof deferred<Task>> }> = []
  const toggleDone = vi.fn((id: string) => {
    const d = deferred<Task>()
    calls.push({ id, d })
    return d.promise
  })

  const deleteCalls: Array<{ id: string; d: ReturnType<typeof deferred<void>> }> = []
  const del = vi.fn((id: string) => {
    const d = deferred<void>()
    deleteCalls.push({ id, d })
    return d.promise
  })

  const provider = { list, toggleDone, delete: del } as unknown as SyncProvider

  return {
    provider,
    list,
    toggleDone,
    del,
    listDeferred,
    /** The deferred for the nth (0-based) toggleDone(id) call. */
    callFor: (id: string, n = 0) => calls.filter((c) => c.id === id)[n]!.d,
    /** The deferred for the nth (0-based) delete(id) call. */
    deleteFor: (id: string, n = 0) => deleteCalls.filter((c) => c.id === id)[n]!.d,
  }
}

async function mountWith(provider: SyncProvider, listDeferred: ReturnType<typeof deferred<Task[]>>) {
  const rendered = renderHook(() => useTasks(provider))
  await act(async () => {
    listDeferred.resolve([A, B])
  })
  return rendered
}

describe('useTasks optimistic writes (S64, #174)', () => {
  it('(a) optimistic flip is visible before the provider settles, and no re-read happens on the write path', async () => {
    const { provider, list, listDeferred, callFor } = makeDeferredProvider()
    const { result } = await mountWith(provider, listDeferred)

    // Drive the click SYNCHRONOUSLY — never `await act(async () => ...)`.
    act(() => {
      void result.current.toggleDone('a').catch(() => {})
    })

    const tgl0 = callFor('a', 0)
    // Red-first check: prove this assertion is genuinely pre-settle.
    expect(tgl0.isSettled()).toBe(false)

    const flipped = result.current.tasks.find((t) => t.id === 'a')!
    expect(flipped.done).toBe(true)
    expect(flipped.completed_at).toEqual(expect.any(Number))

    await act(async () => {
      tgl0.resolve({ ...A, done: true, completed_at: 999 })
    })

    expect(result.current.tasks.find((t) => t.id === 'a')!.completed_at).toBe(999)
    // Pins "no re-read on the write path": list() was called at mount only.
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('(b) rollback on write failure is scoped to the failing id only — control task b', async () => {
    const { provider, listDeferred, callFor } = makeDeferredProvider()
    const { result } = await mountWith(provider, listDeferred)

    act(() => {
      void result.current.toggleDone('a').catch(() => {})
      void result.current.toggleDone('b').catch(() => {})
    })

    expect(result.current.tasks.find((t) => t.id === 'a')!.done).toBe(true)
    expect(result.current.tasks.find((t) => t.id === 'b')!.done).toBe(true)

    const tglA = callFor('a', 0)
    const tglB = callFor('b', 0)
    await act(async () => {
      tglA.reject(new Error('write failed'))
      tglB.resolve({ ...B, done: true, completed_at: 555 })
    })

    const a = result.current.tasks.find((t) => t.id === 'a')!
    const b = result.current.tasks.find((t) => t.id === 'b')!
    expect(a.done).toBe(false)
    expect(a.completed_at).toBeUndefined()
    // The control: b's success proves the machinery genuinely ran and that
    // a's rollback was scoped to a alone, not a whole-list restore.
    expect(b.done).toBe(true)
    expect(b.completed_at).toBe(555)
  })

  it('(c) a committed write survives a later list() rejection', async () => {
    const { provider, listDeferred, callFor, list } = makeDeferredProvider()
    const { result } = await mountWith(provider, listDeferred)

    act(() => {
      void result.current.toggleDone('a').catch(() => {})
    })
    const tglA = callFor('a', 0)
    await act(async () => {
      tglA.resolve({ ...A, done: true, completed_at: 999 })
    })
    expect(result.current.tasks.find((t) => t.id === 'a')!.done).toBe(true)

    list.mockRejectedValueOnce(
      new Error('vault pull failed and local commits are unpushed; refusing to wipe'),
    )
    await act(async () => {
      await result.current.refresh().catch(() => {})
    })

    expect(result.current.tasks.find((t) => t.id === 'a')!.done).toBe(true)
    expect(result.current.tasks).toHaveLength(2)
    expect(result.current.error).toBeNull()
  })

  it('(d) refresh() discards a late-resolving list() that predates a settled toggle (stale-list clobber guard)', async () => {
    const { provider, listDeferred, callFor, list } = makeDeferredProvider()
    const { result } = await mountWith(provider, listDeferred)

    // A second, slow list() call races the toggle below — the shape of the
    // seedIfEmpty().then(refresh) race at App.tsx:67-71. Hold it pending.
    const staleList = deferred<Task[]>()
    list.mockReturnValueOnce(staleList.promise)
    let refreshDone!: Promise<void>
    act(() => {
      refreshDone = result.current.refresh()
    })

    act(() => {
      void result.current.toggleDone('a').catch(() => {})
    })
    const tglA = callFor('a', 0)
    await act(async () => {
      tglA.resolve({ ...A, done: true, completed_at: 999 })
    })
    expect(result.current.tasks.find((t) => t.id === 'a')!.done).toBe(true)

    // The late list() resolves with PRE-toggle data — must be discarded,
    // not applied on top of the settled toggle.
    await act(async () => {
      staleList.resolve([A, B])
      await refreshDone
    })

    expect(result.current.tasks.find((t) => t.id === 'a')!.done).toBe(true)
  })

  it('(e) a second toggleDone while in flight defers instead of double-calling the provider', async () => {
    const { provider, listDeferred, callFor, toggleDone } = makeDeferredProvider()
    const { result } = await mountWith(provider, listDeferred)

    let p2!: Promise<void>
    act(() => {
      void result.current.toggleDone('a').catch(() => {})
      p2 = result.current.toggleDone('a')
    })

    expect(toggleDone).toHaveBeenCalledTimes(1)
    // The deferred flip is visible pre-settle — the discriminator between a
    // deferred inversion and both a dropped no-op and an eager double-write.
    expect(result.current.tasks.find((t) => t.id === 'a')!.done).toBe(false)
    // Neither call threw (the guard returns, it does not throw — MissionCard
    // awaits onToggle uncaught).
    await expect(p2).resolves.toBeUndefined()

    const tgl0 = callFor('a', 0)
    await act(async () => {
      tgl0.resolve({ ...A, done: true, completed_at: 999 })
    })

    expect(toggleDone).toHaveBeenCalledTimes(2)
    expect(toggleDone.mock.calls[1]![0]).toBe('a')
    expect(result.current.tasks.find((t) => t.id === 'a')!.done).toBe(false)
  })

  it('(e2) three synchronous toggles cancel out to NO follow-up call (XOR latch)', async () => {
    const { provider, listDeferred, callFor, toggleDone } = makeDeferredProvider()
    const { result } = await mountWith(provider, listDeferred)

    act(() => {
      void result.current.toggleDone('a').catch(() => {})
      void result.current.toggleDone('a').catch(() => {})
      void result.current.toggleDone('a').catch(() => {})
    })

    expect(toggleDone).toHaveBeenCalledTimes(1)

    const tgl0 = callFor('a', 0)
    await act(async () => {
      tgl0.resolve({ ...A, done: true, completed_at: 999 })
    })

    // XOR: click 2 set the bit, click 3 cleared it. The two deferred flips
    // cancel, so the in-flight op's own result is already the right answer —
    // reconcile it and issue NO follow-up. Three taps from done=false are a
    // net single toggle, and the server must land on done=true to match.
    expect(toggleDone).toHaveBeenCalledTimes(1)
    expect(result.current.tasks.find((t) => t.id === 'a')!.done).toBe(true)
    expect(result.current.tasks.find((t) => t.id === 'a')!.completed_at).toBe(999)
  })

  it('(e3) a rejected first op with the bit set issues no follow-up and still rejects the first caller', async () => {
    const { provider, listDeferred, callFor, toggleDone } = makeDeferredProvider()
    const { result } = await mountWith(provider, listDeferred)

    let p1!: Promise<void>
    act(() => {
      p1 = result.current.toggleDone('a')
      void result.current.toggleDone('a').catch(() => {})
    })

    let rejected = false
    p1.catch(() => {
      rejected = true
    })

    const tgl0 = callFor('a', 0)
    await act(async () => {
      tgl0.reject(new Error('write failed'))
      await p1.catch(() => {})
    })

    expect(toggleDone).toHaveBeenCalledTimes(1)
    expect(rejected).toBe(true)
    expect(result.current.tasks.find((t) => t.id === 'a')!.done).toBe(false)
  })

  // (f)/(f2) — deleteTask. DoD #4 requires BOTH halves proven by test: the
  // synchronous removal, and the newest-first re-insert on failure. The
  // re-insert must not restore by index — the list can change shape while the
  // delete is in flight — so (f2) removes the NEWEST task and checks it comes
  // back at the front, which an index-restore would also satisfy... hence
  // (f2) mutates the list mid-flight to tell the two apart.
  it('(f) deleteTask removes the row synchronously, before the provider settles', async () => {
    const { provider, listDeferred, deleteFor } = makeDeferredProvider()
    const { result } = await mountWith(provider, listDeferred)

    act(() => {
      void result.current.deleteTask('a').catch(() => {})
    })

    const del0 = deleteFor('a')
    // Red-first check: prove the assertion is genuinely pre-settle.
    expect(del0.isSettled()).toBe(false)
    expect(result.current.tasks.map((t) => t.id)).toEqual(['b'])

    await act(async () => {
      del0.resolve(undefined)
    })
    expect(result.current.tasks.map((t) => t.id)).toEqual(['b'])
  })

  it('(f2) a failed delete re-inserts newest-first — by sort, not by append', async () => {
    const { provider, listDeferred, deleteFor } = makeDeferredProvider()
    const { result } = await mountWith(provider, listDeferred)

    // Delete A — the NEWEST task, so the naive `[...prev, before]` restore and
    // the sorted one disagree: append would land ['b','a'], the sort ['a','b'].
    let p!: Promise<void>
    act(() => {
      p = result.current.deleteTask('a')
      void p.catch(() => {})
    })
    expect(result.current.tasks.map((t) => t.id)).toEqual(['b'])

    let rejected = false
    await act(async () => {
      deleteFor('a').reject(new Error('vault write failed'))
      await p.catch(() => {
        rejected = true
      })
    })

    // Newest-first by created_at (A=2000, B=1000) — matches VaultSync.list().
    expect(result.current.tasks.map((t) => t.id)).toEqual(['a', 'b'])
    expect(result.current.tasks.map((t) => t.created_at)).toEqual([2000, 1000])
    // DoD #6: deleteTask still rejects, so S72 keeps its failure signal.
    expect(rejected).toBe(true)
  })

  // (e4) — the convergence check. (e)/(e2)/(e3) all stop at the FIRST op's
  // settle, so none of them can see where the row finally lands once a
  // follow-up also resolves. That blind spot hid a real defect: a sticky
  // (non-XOR) latch passes (e), (e2) and (e3) while leaving three rapid taps
  // on a not-done row settled back to not-done, with a visible bounce on the
  // way. This provider is STATEFUL — each toggleDone flips server-side truth
  // and returns it — so UI and server can be compared at rest.
  it('(e4) UI and server converge on net click parity once every call settles', async () => {
    const cases = [
      { clicks: 2, expected: false, calls: 2 },
      { clicks: 3, expected: true, calls: 1 },
    ]

    for (const { clicks, expected, calls } of cases) {
      const listDeferred = deferred<Task[]>()
      let server: Task = { ...A }
      const pending: Array<() => void> = []
      const toggleDone = vi.fn(() => {
        const d = deferred<Task>()
        pending.push(() => {
          const completing = !server.done
          server = { ...server, done: completing }
          if (completing) server.completed_at = 999
          else delete server.completed_at
          d.resolve({ ...server })
        })
        return d.promise
      })
      const provider = { list: () => listDeferred.promise, toggleDone } as unknown as SyncProvider

      const { result } = renderHook(() => useTasks(provider))
      await act(async () => {
        listDeferred.resolve([A])
      })

      act(() => {
        for (let i = 0; i < clicks; i++) void result.current.toggleDone('a').catch(() => {})
      })

      // Settle every call, including any follow-up the latch issues.
      for (let i = 0; i < pending.length; i++) {
        await act(async () => {
          pending[i]()
        })
      }

      expect(toggleDone, `${clicks} clicks → provider calls`).toHaveBeenCalledTimes(calls)
      expect(server.done, `${clicks} clicks → server`).toBe(expected)
      expect(result.current.tasks.find((t) => t.id === 'a')!.done, `${clicks} clicks → UI`).toBe(expected)
    }
  })
})
