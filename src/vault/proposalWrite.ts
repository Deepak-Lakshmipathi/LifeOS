/**
 * proposalWrite — the S54 write seam for flipping a proposal's approval
 * status (owner-gated, confirm-destructive per ADR-0013's spirit).
 *
 * `flipProposal` is the single function allowed to commit an approve/reject
 * decision to the vault. It goes through the SAME transport seam every other
 * vault mutation uses (`src/sync/VaultSync.ts`'s add/update/toggleDone/delete):
 * read the current file content via `transport.readFiles()`, apply the pure
 * S52 byte-surgical transform (`setProposalStatus`), then commit the result
 * via `transport.writeFile()`. No direct fs/git access — this module (and the
 * UI that calls it) never imports isomorphic-git or touches the filesystem.
 *
 * `readFiles()` returns the whole vault snapshot (there is no single-file
 * read on `VaultTransport` — see `src/vault/transport.ts`), so the target
 * proposal is located by exact `path` match within it, mirroring how
 * `VaultSync` locates the file it's about to splice.
 */

import type { VaultTransport } from './transport'
import { setProposalStatus, type ProposalStatus } from './supervisor'

/**
 * Flip a proposal file's `status:` line and commit the change.
 *
 * @param transport - the injected write seam (git-backed in prod, fake in tests).
 * @param path      - vault-relative path of the proposal file, e.g.
 *                    `proposals/email-triage-2026-07-13.md`.
 * @param status    - the new status (`approved` | `rejected` | `pending`).
 * @throws if no file at `path` is found in the transport's current snapshot.
 */
export async function flipProposal(
  transport: VaultTransport,
  path: string,
  status: ProposalStatus,
): Promise<void> {
  const files = await transport.readFiles()
  const entry = files.find((f) => f.path === path)
  if (!entry) {
    throw new Error(`flipProposal: no vault file found at "${path}"`)
  }

  const newContent = setProposalStatus(entry.content, status)
  await transport.writeFile(path, newContent, `${status} proposal: ${path}`)
}
