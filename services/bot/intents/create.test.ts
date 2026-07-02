import { describe, expect, it } from 'vitest'
import { handleCreate } from './create'
import { createFakeVaultTransport } from '../testUtils/fakeVaultTransport'
import { parseTaskLine } from '../../../src/vault/parseVault'
import type { BotContext } from './types'

function ctxWith(transport: ReturnType<typeof createFakeVaultTransport>): BotContext {
  return { vaultTransport: transport }
}

describe('handleCreate', () => {
  it('writes a task that round-trips through parseTaskLine with all fields intact and a non-empty id', async () => {
    const transport = createFakeVaultTransport()

    const reply = await handleCreate(
      {
        title: 'Call the CA about GST',
        domain: 'Finance',
        project: 'Taxes',
        done_when: 'CA confirms GST filing is done',
        priority: 3,
      },
      ctxWith(transport),
    )

    expect(transport.writeFileCalls).toHaveLength(1)
    const written = transport.writeFileCalls[0]!
    expect(written.path).toBe('Finance/Taxes.md')

    const line = written.content.trim().split('\n').at(-1)!
    const parsed = parseTaskLine(line, { domain: 'Finance', project: 'Taxes' })

    expect(parsed).not.toBeNull()
    expect(parsed!.title).toBe('Call the CA about GST')
    expect(parsed!.domain).toBe('Finance')
    expect(parsed!.project).toBe('Taxes')
    expect(parsed!.done_when).toBe('CA confirms GST filing is done')
    expect(parsed!.priority).toBe(3)
    expect(parsed!.id).toBeTruthy()
    expect(parsed!.id.length).toBeGreaterThan(0)

    expect(reply).toBe("✓ added 'Call the CA about GST' · Finance · P3")
  })

  it('falls back to Inbox/Inbox.md when neither domain nor project is given', async () => {
    const transport = createFakeVaultTransport()

    const reply = await handleCreate({ title: 'Buy filters for the water purifier' }, ctxWith(transport))

    expect(transport.writeFileCalls).toHaveLength(1)
    expect(transport.writeFileCalls[0]!.path).toBe('Inbox/Inbox.md')
    expect(reply).toBe("✓ added 'Buy filters for the water purifier' · Inbox")
  })

  it('appends to existing file content rather than overwriting it', async () => {
    const transport = createFakeVaultTransport([
      { path: 'Growth/Reading.md', content: '- [ ] Finish chapter 3\n' },
    ])

    await handleCreate({ title: 'Start chapter 4', domain: 'Growth', project: 'Reading' }, ctxWith(transport))

    const written = transport.writeFileCalls[0]!
    expect(written.content).toContain('Finish chapter 3')
    expect(written.content).toContain('Start chapter 4')
    expect(written.content.indexOf('Finish chapter 3')).toBeLessThan(written.content.indexOf('Start chapter 4'))
  })

  it('rejects an empty/whitespace-only title without touching the vault', async () => {
    const transport = createFakeVaultTransport()

    const reply = await handleCreate({ title: '   ' }, ctxWith(transport))

    expect(transport.writeFileCalls).toHaveLength(0)
    expect(reply).toMatch(/couldn't tell what to create/i)
  })

  it('rejects a missing title without touching the vault', async () => {
    const transport = createFakeVaultTransport()

    const reply = await handleCreate({}, ctxWith(transport))

    expect(transport.writeFileCalls).toHaveLength(0)
    expect(reply).toMatch(/couldn't tell what to create/i)
  })

  it('rejects an out-of-range priority without touching the vault', async () => {
    const transport = createFakeVaultTransport()

    const reply = await handleCreate({ title: 'Something', priority: 9 }, ctxWith(transport))

    expect(transport.writeFileCalls).toHaveLength(0)
    expect(reply).toMatch(/couldn't tell what to create/i)
  })
})
