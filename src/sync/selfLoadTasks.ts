import { LocalOnly } from './LocalOnly'
import { VaultSync } from './VaultSync'
import type { SyncProvider } from './SyncProvider'
import type { Task } from '../types'

/**
 * selfLoadTasks — the ONE shared self-load of the full task list off the
 * ADR-0002 provider seam, for chrome that reads tasks without owning them.
 *
 * `VitalsRow` (Completion tile) and `Aurora` (warmth tint) each used to
 * instantiate their own provider and call `.list()` independently. Both
 * mount together under `<App/>`, so that was two concurrent Dexie reads
 * against the same store on every app load — harmless in production, but
 * under full-suite test load it was enough to tip `cockpitShell.test.tsx`'s
 * default `findByText` wait over (issue #165). Memoizing the in-flight
 * promise here means both components share the same read: exactly one
 * `.list()` call per mount cycle, not two.
 *
 * Both call sites keep their own tests-inject-`tasks` short-circuit exactly
 * as before — this module is only ever reached from the self-load path, so
 * no test touches it.
 *
 * #167: `??=` alone would memoize the *promise*, so a rejected first read
 * stays cached forever — no caller ever retries. The `.catch` below clears
 * `inFlight` before rethrowing, so a rejection un-poisons the memo for the
 * next call while a successful read still resolves to the one shared
 * promise every concurrent caller in that window received (the property
 * this module exists for — see above).
 */
const provider: SyncProvider =
  import.meta.env.VITE_VAULT === '1' ? new VaultSync() : new LocalOnly()

let inFlight: Promise<Task[]> | null = null

export function selfLoadTasks(): Promise<Task[]> {
  return (inFlight ??= provider.list().catch((err: unknown) => {
    inFlight = null
    throw err
  }))
}

/**
 * #168: test-only reset seam. The module-scoped `inFlight` memo has no
 * other way to be cleared between tests — call this from `beforeEach` in
 * any test that exercises the real load path (i.e. does NOT inject `tasks`
 * directly into VitalsRow/Aurora), so it doesn't silently inherit whatever
 * a prior test in the same file left in `inFlight`.
 */
export function __resetSelfLoadTasksCache(): void {
  inFlight = null
}
