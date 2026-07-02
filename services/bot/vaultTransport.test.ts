import { describe, expect, it } from 'vitest'
import { NodeVaultTransport } from './vaultTransport'

describe('NodeVaultTransport (S16b throwing stub)', () => {
  it('readFiles throws a clear "not implemented — see S16c" error', async () => {
    const transport = new NodeVaultTransport()
    await expect(transport.readFiles()).rejects.toThrowError(/not implemented — see S16c/)
  })

  it('writeFile throws a clear "not implemented — see S16c" error', async () => {
    const transport = new NodeVaultTransport()
    await expect(transport.writeFile('Inbox/Inbox.md', 'content', 'msg')).rejects.toThrowError(
      /not implemented — see S16c/,
    )
  })
})
