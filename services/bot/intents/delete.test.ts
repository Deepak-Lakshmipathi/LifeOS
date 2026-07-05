import { describe, expect, it } from 'vitest'
import { handleDelete } from './delete'
import { getPending, clearPending } from '../confirm/store'
import { createFakeVaultTransport } from '../testUtils/fakeVaultTransport'
import type { BotContext } from './types'

function ctxFor(chatId: string, transport: ReturnType<typeof createFakeVaultTransport>): BotContext {
  return { vaultTransport: transport, chatId }
}

describe('handleDelete', () => {
  it('a confident single match sets a confirm PendingAction and returns the delete-confirm prompt', async () => {
    const chatId = 'chat-delete-1'
    const transport = createFakeVaultTransport([
      { path: 'Finance/Inbox.md', content: '- [ ] GST registration id:: task-1\n' },
    ])

    const reply = await handleDelete({ target_reference: 'GST registration' }, ctxFor(chatId, transport))

    expect(reply).toBe("Delete 'GST registration' from Finance? (y/n)")

    const pending = getPending(chatId)
    expect(pending?.kind).toBe('confirm')
    if (pending?.kind === 'confirm') {
      expect(pending.intent).toBe('delete')
      expect(pending.match.task.id).toBe('task-1')
      expect(pending.patch).toBeUndefined()
    }
    expect(transport.writeFileCalls).toHaveLength(0)

    clearPending(chatId)
  })

  it('a task with no domain (Inbox) shows "from Inbox" in the prompt', async () => {
    const chatId = 'chat-delete-2'
    const transport = createFakeVaultTransport([{ path: 'Inbox/Inbox.md', content: '- [ ] Buy milk id:: task-2\n' }])

    const reply = await handleDelete({ target_reference: 'Buy milk' }, ctxFor(chatId, transport))

    expect(reply).toBe("Delete 'Buy milk' from Inbox? (y/n)")

    clearPending(chatId)
  })

  it('an ambiguous reference sets a disambiguate PendingAction, capped at 5, no patch', async () => {
    const chatId = 'chat-delete-3'
    const lines = Array.from({ length: 6 }, (_, i) => `- [ ] Renew passport id:: task-${i}`)
    const transport = createFakeVaultTransport([{ path: 'Inbox/Inbox.md', content: lines.join('\n') + '\n' }])

    const reply = await handleDelete({ target_reference: 'renew passport' }, ctxFor(chatId, transport))

    expect(reply).toContain('5. Renew passport')
    expect(reply).not.toContain('6. Renew passport')

    const pending = getPending(chatId)
    expect(pending?.kind).toBe('disambiguate')
    if (pending?.kind === 'disambiguate') {
      expect(pending.candidates).toHaveLength(5)
      expect(pending.patch).toBeUndefined()
    }

    clearPending(chatId)
  })

  it('no match clears any prior pending state and replies without touching the vault', async () => {
    const chatId = 'chat-delete-4'
    const transport = createFakeVaultTransport([{ path: 'Inbox/Inbox.md', content: '- [ ] Buy milk id:: task-x\n' }])

    const reply = await handleDelete({ target_reference: 'completely unrelated reference' }, ctxFor(chatId, transport))

    expect(reply).toBe("Couldn't find a task matching that.")
    expect(getPending(chatId)).toBeUndefined()
    expect(transport.writeFileCalls).toHaveLength(0)
  })

  it('rejects a missing target_reference without touching the vault', async () => {
    const chatId = 'chat-delete-5'
    const transport = createFakeVaultTransport()

    const reply = await handleDelete({}, ctxFor(chatId, transport))

    expect(reply).toMatch(/couldn't tell which task/i)
    expect(getPending(chatId)).toBeUndefined()
    expect(transport.writeFileCalls).toHaveLength(0)
  })

  it('a domain hint narrows the search pool to the matching domain only', async () => {
    const chatId = 'chat-delete-6'
    const transport = createFakeVaultTransport([
      { path: 'Finance/Inbox.md', content: '- [ ] Call the CA about GST id:: task-fin\n' },
      { path: 'Growth/Inbox.md', content: '- [ ] Call the CA about GST id:: task-growth\n' },
    ])

    await handleDelete({ target_reference: 'call the CA about GST', domain: 'Finance' }, ctxFor(chatId, transport))

    const pending = getPending(chatId)
    if (pending?.kind === 'confirm') {
      expect(pending.match.task.id).toBe('task-fin')
    } else {
      throw new Error('expected a confirm pending action')
    }

    clearPending(chatId)
  })

  it('a done task is a valid delete target (delete may target completed tasks)', async () => {
    const chatId = 'chat-delete-7'
    const transport = createFakeVaultTransport([
      { path: 'Inbox/Inbox.md', content: '- [x] Renew passport id:: task-done\n' },
    ])

    const reply = await handleDelete({ target_reference: 'Renew passport' }, ctxFor(chatId, transport))

    expect(reply).toBe("Delete 'Renew passport' from Inbox? (y/n)")

    clearPending(chatId)
  })
})
