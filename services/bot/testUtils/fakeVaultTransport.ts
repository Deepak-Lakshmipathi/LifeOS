/**
 * fakeVaultTransport — in-memory VaultTransport for tests (S16b), mirroring
 * src/sync/VaultSync.test.ts's fake-transport pattern. No git/network/IO.
 */

import type { VaultTransport } from '../../../src/vault/transport'

export interface FakeVaultTransport extends VaultTransport {
  files: { path: string; content: string }[]
  writeFileCalls: { path: string; content: string; message: string }[]
}

export function createFakeVaultTransport(
  seed: { path: string; content: string }[] = [],
): FakeVaultTransport {
  const files = seed.map((f) => ({ ...f }))
  const writeFileCalls: { path: string; content: string; message: string }[] = []

  return {
    files,
    writeFileCalls,
    async readFiles() {
      return files.map((f) => ({ ...f }))
    },
    async writeFile(path, content, message) {
      writeFileCalls.push({ path, content, message })
      const existing = files.find((f) => f.path === path)
      if (existing) {
        existing.content = content
      } else {
        files.push({ path, content })
      }
    },
  }
}
