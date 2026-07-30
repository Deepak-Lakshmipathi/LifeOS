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
 */
const provider: SyncProvider =
  import.meta.env.VITE_VAULT === '1' ? new VaultSync() : new LocalOnly()

let inFlight: Promise<Task[]> | null = null

export function selfLoadTasks(): Promise<Task[]> {
  return (inFlight ??= provider.list())
}
