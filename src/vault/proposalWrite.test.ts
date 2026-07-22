/**
 * proposalWrite.test.ts — S54 coverage for src/vault/proposalWrite.ts.
 *
 * DoD #3: flipProposal writes the byte-surgical S52 transform through the
 * transport seam — no direct fs/git in this module. Verified with a FAKE
 * transport (mirrors src/sync/VaultSync.test.ts's own FakeTransport), payload
 * asserted: readFiles() feeds the current content in, setProposalStatus does
 * the surgical flip, writeFile() receives the flipped content and nothing
 * else changes.
 */
import { describe, it, expect } from 'vitest'
import type { VaultTransport } from './transport'
import { flipProposal } from './proposalWrite'
import { setProposalStatus } from './supervisor'

const PENDING_MD = `---
agent: email-triage
date: 2026-07-13
status: pending # pending | approved | rejected
---
## Change
Lower draft threshold: also draft for label bill when amount > ₹5,000.
## Diff
\`\`\`
- draft when: label in {urgent, reply-needed}
+ draft when: label in {urgent, reply-needed} OR (label == bill AND amount > 5000)
\`\`\`
## Why
3 bill emails last week needed manual replies.
`

// ─── FakeTransport (mirrors src/sync/VaultSync.test.ts) ─────────────────────

interface WriteCall {
  path: string
  content: string
  message: string
}

class FakeTransport implements VaultTransport {
  readonly writeCalls: WriteCall[] = []
  private readonly files: { path: string; content: string }[]

  constructor(files: { path: string; content: string }[] = []) {
    this.files = files.map((f) => ({ ...f }))
  }

  readFiles() {
    return Promise.resolve(this.files.map((f) => ({ ...f })))
  }

  writeFile(path: string, content: string, message: string) {
    this.writeCalls.push({ path, content, message })
    const existing = this.files.find((f) => f.path === path)
    if (existing) existing.content = content
    else this.files.push({ path, content })
    return Promise.resolve()
  }
}

describe('flipProposal (DoD #3)', () => {
  const PATH = 'proposals/email-triage-2026-07-13.md'

  it('reads via transport.readFiles(), flips via setProposalStatus, writes via transport.writeFile()', async () => {
    const transport = new FakeTransport([{ path: PATH, content: PENDING_MD }])

    await flipProposal(transport, PATH, 'approved')

    expect(transport.writeCalls).toHaveLength(1)
    const call = transport.writeCalls[0]!
    expect(call.path).toBe(PATH)

    // The payload written is EXACTLY the pure S52 transform's output —
    // no re-serialization, no extra mutation layered on top.
    expect(call.content).toBe(setProposalStatus(PENDING_MD, 'approved'))
  })

  it('flips ONLY the status line — every other byte is byte-identical', async () => {
    const transport = new FakeTransport([{ path: PATH, content: PENDING_MD }])
    await flipProposal(transport, PATH, 'approved')

    const written = transport.writeCalls[0]!.content
    const before = PENDING_MD.split(/\r?\n/)
    const after = written.split(/\r?\n/)
    expect(after).toHaveLength(before.length)

    const diffLines = before
      .map((line, i) => ({ line, i }))
      .filter(({ line, i }) => line !== after[i])

    expect(diffLines).toHaveLength(1)
    expect(diffLines[0]!.line).toBe('status: pending # pending | approved | rejected')
    expect(after[diffLines[0]!.i]).toBe('status: approved # pending | approved | rejected')
  })

  it('rejects flips to "rejected" identically to approve', async () => {
    const transport = new FakeTransport([{ path: PATH, content: PENDING_MD }])
    await flipProposal(transport, PATH, 'rejected')

    expect(transport.writeCalls[0]!.content).toBe(setProposalStatus(PENDING_MD, 'rejected'))
    expect(transport.writeCalls[0]!.content).toContain('status: rejected')
  })

  it('commits the flipped content back to the SAME path it read from', async () => {
    const transport = new FakeTransport([
      { path: PATH, content: PENDING_MD },
      { path: 'proposals/other-agent-2026-07-01.md', content: PENDING_MD },
    ])

    await flipProposal(transport, PATH, 'approved')

    expect(transport.writeCalls).toHaveLength(1)
    expect(transport.writeCalls[0]!.path).toBe(PATH)
  })

  it('throws (not a no-op) when the target path is not in the transport snapshot', async () => {
    const transport = new FakeTransport([])
    await expect(flipProposal(transport, 'proposals/missing.md', 'approved')).rejects.toThrow()
    expect(transport.writeCalls).toHaveLength(0)
  })
})
