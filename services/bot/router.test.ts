import { describe, expect, it, vi } from 'vitest'
import { dispatchIntent, handleIncomingMessage, NOT_YET_SUPPORTED, type RouterDeps } from './router'
import type { BotContext } from './intents/types'
import { createFakeVaultTransport } from './testUtils/fakeVaultTransport'
import type { ClaudeClient } from './nlu'
import type { TelegramClient } from './telegramClient'

function fakeClaudeClient(payload: unknown): ClaudeClient {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(payload) }] }),
    },
  }
}

function fakeTelegramClient(): TelegramClient & { sendMessage: ReturnType<typeof vi.fn> } {
  return {
    pollUpdates: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    downloadPhoto: vi.fn(),
  }
}

describe('dispatchIntent', () => {
  it('dispatches a registered "create" intent to the create handler', async () => {
    const transport = createFakeVaultTransport()
    const ctx: BotContext = { vaultTransport: transport }

    const reply = await dispatchIntent('create', { title: 'Do the thing', domain: 'Growth' }, ctx)

    expect(transport.writeFileCalls).toHaveLength(1)
    expect(transport.writeFileCalls[0]!.path).toBe('Growth/Inbox.md')
    expect(reply).toBe("✓ added 'Do the thing' · Growth")
  })

  it('returns "not yet supported" for an unregistered intent name and never touches the vault', async () => {
    const transport = createFakeVaultTransport()
    const readSpy = vi.spyOn(transport, 'readFiles')
    const writeSpy = vi.spyOn(transport, 'writeFile')
    const ctx: BotContext = { vaultTransport: transport }

    const reply = await dispatchIntent('update', { id: 'whatever' }, ctx)

    expect(reply).toBe(NOT_YET_SUPPORTED)
    expect(readSpy).not.toHaveBeenCalled()
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('returns "not yet supported" for Claude\'s "other" classification', async () => {
    const transport = createFakeVaultTransport()
    const ctx: BotContext = { vaultTransport: transport }

    const reply = await dispatchIntent('other', {}, ctx)

    expect(reply).toBe(NOT_YET_SUPPORTED)
    expect(transport.writeFileCalls).toHaveLength(0)
  })
})

describe('handleIncomingMessage — owner guard', () => {
  it('is a complete no-op for a message from a non-owner chat id', async () => {
    const claudeClient = fakeClaudeClient({ intent: 'create', title: 'sneaky task' })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, ownerChatId: 'owner-123' }

    await handleIncomingMessage({ chatId: 'stranger-999', text: 'add a task' }, deps)

    expect(claudeClient.messages.create).not.toHaveBeenCalled()
    expect(vaultTransport.writeFileCalls).toHaveLength(0)
    expect(telegramClient.sendMessage).not.toHaveBeenCalled()
  })

  it('proceeds through Claude, the vault write, and the reply for the owner chat id', async () => {
    const claudeClient = fakeClaudeClient({ intent: 'create', title: 'Call the CA about GST', domain: 'Finance' })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, ownerChatId: 'owner-123' }

    await handleIncomingMessage({ chatId: 'owner-123', text: 'call the CA about GST' }, deps)

    expect(claudeClient.messages.create).toHaveBeenCalledTimes(1)
    expect(vaultTransport.writeFileCalls).toHaveLength(1)
    expect(telegramClient.sendMessage).toHaveBeenCalledWith(
      'owner-123',
      "✓ added 'Call the CA about GST' · Finance",
    )
  })

  it('replies "not yet supported" for the owner with no vault write on a non-create message', async () => {
    const claudeClient = fakeClaudeClient({ intent: 'other' })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, ownerChatId: 'owner-123' }

    await handleIncomingMessage({ chatId: 'owner-123', text: 'delete my last task' }, deps)

    expect(vaultTransport.writeFileCalls).toHaveLength(0)
    expect(telegramClient.sendMessage).toHaveBeenCalledWith('owner-123', NOT_YET_SUPPORTED)
  })
})
