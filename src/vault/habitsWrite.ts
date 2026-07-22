/**
 * habitsWrite — appendHabitHit (S32): the write half of the Habits vault
 * contract. src/vault/habits.ts (S30) is the pure, I/O-free read/parse half
 * (parseHabits, parseHabitLog, serializeHabitHit, weekGrid, streak); this
 * file is the one place a hit actually gets committed to disk.
 *
 * appendHabitHit reads the current `Habits/log.md` content, appends exactly
 * one S30-serialized hit line (serializeHabitHit — the exact inverse
 * parseHabitLog expects back, DoD 1 round-trip), and writes the file back
 * through the injected VaultTransport. This mirrors VaultSync.add()'s own
 * read-modify-write idiom for task lines (src/sync/VaultSync.ts): resolve
 * current content from transport.readFiles(), append with the same
 * trailing-newline discipline, transport.writeFile(). No direct fs/git calls
 * here — every byte of I/O goes through the transport seam (ADR-0009), which
 * is how the caller can hand this a fake transport in tests and a real
 * GitTransport live.
 *
 * Known gap (out of this slice's write-set to fix): GitTransport.readFiles()
 * (src/vault/transport.ts) only walks the 7 canonical domain folders plus
 * Inbox — `Habits` is not one of them, so the live git transport never
 * actually surfaces Habits/log.md's existing content today. appendHabitHit
 * degrades gracefully (treats the file as empty, so the write still lands
 * as valid content — it just doesn't yet see prior hits) rather than
 * throwing; wiring `Habits` into that read loop belongs to transport.ts's
 * own hotspot, not this one.
 */

import type { VaultTransport } from './transport'
import { serializeHabitHit, type HabitHit } from './habits'

/** The single append-only hit log every habit hit is written to. */
const LOG_PATH = 'Habits/log.md'

/**
 * Append one hit to Habits/log.md via `transport`. Read-modify-write: fetch
 * the current file set, find the log (missing → treated as empty), append
 * the serialized line (adding a separating newline only when the existing
 * content doesn't already end in one), then write the whole file back.
 */
export async function appendHabitHit(transport: VaultTransport, hit: HabitHit): Promise<void> {
  const files = await transport.readFiles()
  const current = files.find((f) => f.path === LOG_PATH)?.content ?? ''

  const newLine = serializeHabitHit(hit)
  const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : ''
  const newContent = current + separator + newLine + '\n'

  await transport.writeFile(LOG_PATH, newContent, `habit hit: ${hit.habit} (${hit.date})`)
}
