import { describe, expect, it } from 'vitest'
import { handleUpdate } from './update'
import { getPending, clearPending } from '../confirm/store'
import { createFakeVaultTransport } from '../testUtils/fakeVaultTransport'
import type { BotContext } from './types'

function ctxFor(chatId: string, transport: ReturnType<typeof createFakeVaultTransport>): BotContext {
  return { vaultTransport: transport, chatId }
}

describe('handleUpdate', () => {
  it('a confident single match sets a confirm PendingAction and returns the priority-patch prompt', async () => {
    const chatId = 'chat-update-1'
    const transport = createFakeVaultTransport([
      { path: 'Finance/Inbox.md', content: '- [ ] Call the CA about GST id:: task-1\n' },
    ])

    const reply = await handleUpdate(
      { target_reference: 'call the CA about GST', priority: 3 },
      ctxFor(chatId, transport),
    )

    expect(reply).toBe("Set 'Call the CA about GST' to P3? (y/n)")

    const pending = getPending(chatId)
    expect(pending?.kind).toBe('confirm')
    if (pending?.kind === 'confirm') {
      expect(pending.intent).toBe('update')
      expect(pending.match.task.id).toBe('task-1')
      expect(pending.patch).toEqual({ priority: 3 })
    }
    expect(transport.writeFileCalls).toHaveLength(0)

    clearPending(chatId)
  })

  it('a mark_done patch produces the "Mark X done?" prompt', async () => {
    const chatId = 'chat-update-2'
    const transport = createFakeVaultTransport([{ path: 'Inbox/Inbox.md', content: '- [ ] call CA id:: task-2\n' }])

    const reply = await handleUpdate({ target_reference: 'call CA', mark_done: true }, ctxFor(chatId, transport))

    expect(reply).toBe("Mark 'call CA' done? (y/n)")
    expect(getPending(chatId)?.kind).toBe('confirm')

    clearPending(chatId)
  })

  it('mark_done: false produces the "Mark X not done?" prompt', async () => {
    const chatId = 'chat-update-2b'
    const transport = createFakeVaultTransport([{ path: 'Inbox/Inbox.md', content: '- [x] call CA id:: task-2\n' }])

    const reply = await handleUpdate({ target_reference: 'call CA', mark_done: false }, ctxFor(chatId, transport))

    expect(reply).toBe("Mark 'call CA' not done? (y/n)")

    clearPending(chatId)
  })

  it('an ambiguous reference sets a disambiguate PendingAction with the patch attached, capped candidates', async () => {
    const chatId = 'chat-update-3'
    const transport = createFakeVaultTransport([
      {
        path: 'Inbox/Inbox.md',
        content: ['- [ ] Call the CA id:: task-a', '- [ ] Call the CA id:: task-b'].join('\n') + '\n',
      },
    ])

    const reply = await handleUpdate({ target_reference: 'call the CA', priority: 1 }, ctxFor(chatId, transport))

    expect(reply).toContain('1. Call the CA')
    expect(reply).toContain('2. Call the CA')
    expect(reply).toContain('Reply with a number to pick.')

    const pending = getPending(chatId)
    expect(pending?.kind).toBe('disambiguate')
    if (pending?.kind === 'disambiguate') {
      expect(pending.candidates).toHaveLength(2)
      expect(pending.patch).toEqual({ priority: 1 })
    }

    clearPending(chatId)
  })

  it('no match clears any prior pending state and replies without touching the vault', async () => {
    const chatId = 'chat-update-4'
    const transport = createFakeVaultTransport([
      { path: 'Inbox/Inbox.md', content: '- [ ] Buy milk id:: task-x\n' },
    ])

    const reply = await handleUpdate(
      { target_reference: 'completely unrelated reference', priority: 2 },
      ctxFor(chatId, transport),
    )

    expect(reply).toBe("Couldn't find a task matching that.")
    expect(getPending(chatId)).toBeUndefined()
    expect(transport.writeFileCalls).toHaveLength(0)
  })

  it('rejects a missing target_reference without touching the vault', async () => {
    const chatId = 'chat-update-5'
    const transport = createFakeVaultTransport()

    const reply = await handleUpdate({ priority: 2 }, ctxFor(chatId, transport))

    expect(reply).toMatch(/couldn't tell which task/i)
    expect(getPending(chatId)).toBeUndefined()
    expect(transport.writeFileCalls).toHaveLength(0)
  })

  it('rejects an empty patch (target given but nothing to change)', async () => {
    const chatId = 'chat-update-6'
    const transport = createFakeVaultTransport([{ path: 'Inbox/Inbox.md', content: '- [ ] call CA id:: task-1\n' }])

    const reply = await handleUpdate({ target_reference: 'call CA' }, ctxFor(chatId, transport))

    expect(reply).toMatch(/couldn't tell which task/i)
    expect(transport.writeFileCalls).toHaveLength(0)
  })

  it('rejects an out-of-range priority without touching the vault', async () => {
    const chatId = 'chat-update-7'
    const transport = createFakeVaultTransport([{ path: 'Inbox/Inbox.md', content: '- [ ] call CA id:: task-1\n' }])

    const reply = await handleUpdate({ target_reference: 'call CA', priority: 9 }, ctxFor(chatId, transport))

    expect(reply).toMatch(/couldn't tell which task/i)
    expect(getPending(chatId)).toBeUndefined()
    expect(transport.writeFileCalls).toHaveLength(0)
  })

  it('a domain hint narrows the search pool', async () => {
    const chatId = 'chat-update-8'
    const transport = createFakeVaultTransport([
      { path: 'Finance/Inbox.md', content: '- [ ] Call the CA about GST id:: task-fin\n' },
      { path: 'Growth/Inbox.md', content: '- [ ] Call the CA about GST id:: task-growth\n' },
    ])

    await handleUpdate(
      { target_reference: 'call the CA about GST', domain: 'Finance', priority: 2 },
      ctxFor(chatId, transport),
    )

    const pending = getPending(chatId)
    if (pending?.kind === 'confirm') {
      expect(pending.match.task.id).toBe('task-fin')
    } else {
      throw new Error('expected a confirm pending action')
    }

    clearPending(chatId)
  })
})
