/**
 * vaultTransport — Node-side VaultTransport stub (S16b).
 *
 * Implements the existing VaultTransport interface (src/vault/transport.ts —
 * unmodified; the interface is reused, not the browser-facing GitTransport
 * class, which is IndexedDB/lightning-fs-backed and doesn't exist in Node).
 *
 * Both methods throw "not implemented" — the real isomorphic-git + Node `fs`
 * implementation is S16c's job (HITL, needs an owner hand-verify: this repo
 * has no git remote/network access in CI, mirroring GitTransport's real
 * implementation from S15b). All S16b tests inject a fake in-memory
 * VaultTransport instead (see testUtils/fakeVaultTransport.ts).
 */

import type { VaultTransport } from '../../src/vault/transport'

export class NodeVaultTransport implements VaultTransport {
  async readFiles(): Promise<{ path: string; content: string }[]> {
    throw new Error('NodeVaultTransport.readFiles is not implemented — see S16c')
  }

  async writeFile(_path: string, _content: string, _message: string): Promise<void> {
    throw new Error('NodeVaultTransport.writeFile is not implemented — see S16c')
  }
}
