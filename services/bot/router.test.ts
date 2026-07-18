import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchIntent, handleIncomingMessage, NOT_YET_SUPPORTED, RETYPE_PROMPT, type RouterDeps } from './router'
import type { BotContext } from './intents/types'
import { createFakeVaultTransport } from './testUtils/fakeVaultTransport'
import type { ClaudeClient } from './nlu'
import type { TelegramClient } from './telegramClient'
import type { Transcriber } from './transcription'
import { setPending as setConfirmPending, getPending as getConfirmPending, clearPending as clearConfirmPending } from './confirm/store'
import type { MatchedTask } from './taskMatch'

function fakeClaudeClient(payload: unknown): ClaudeClient {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(payload) }] }),
    },
  }
}

function fakeTelegramClient(): TelegramClient & {
  sendMessage: ReturnType<typeof vi.fn>
  downloadPhoto: ReturnType<typeof vi.fn>
  downloadVoiceFile: ReturnType<typeof vi.fn>
} {
  return {
    pollUpdates: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    downloadPhoto: vi.fn().mockResolvedValue({ data: Buffer.from('fake-jpeg-bytes'), mediaType: 'image/jpeg' }),
    downloadVoiceFile: vi.fn().mockResolvedValue(Buffer.from('fake-ogg-bytes')),
  }
}

function fakeTranscriber(result: { text: string; confident: boolean }): Transcriber & {
  transcribe: ReturnType<typeof vi.fn>
} {
  return {
    transcribe: vi.fn().mockResolvedValue(result),
  }
}

describe('dispatchIntent', () => {
  it('dispatches a registered "create" intent to the create handler', async () => {
    const transport = createFakeVaultTransport()
    const ctx: BotContext = { vaultTransport: transport, chatId: 'owner-123' }

    const reply = await dispatchIntent('create', { title: 'Do the thing', domain: 'Growth' }, ctx)

    expect(transport.writeFileCalls).toHaveLength(1)
    expect(transport.writeFileCalls[0]!.path).toBe('Growth/Inbox.md')
    expect(reply).toBe("✓ added 'Do the thing' · Growth")
  })

  it('returns "not yet supported" for an unregistered intent name and never touches the vault', async () => {
    const transport = createFakeVaultTransport()
    const readSpy = vi.spyOn(transport, 'readFiles')
    const writeSpy = vi.spyOn(transport, 'writeFile')
    const ctx: BotContext = { vaultTransport: transport, chatId: 'owner-123' }

    // 'update'/'delete' are real registered intents as of S17 — 'photo' is
    // still handled inline in router.ts rather than through the registry
    // (ADR-0012 Decision 4), so it remains a genuinely unregistered name.
    const reply = await dispatchIntent('photo', { id: 'whatever' }, ctx)

    expect(reply).toBe(NOT_YET_SUPPORTED)
    expect(readSpy).not.toHaveBeenCalled()
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('returns "not yet supported" for Claude\'s "other" classification', async () => {
    const transport = createFakeVaultTransport()
    const ctx: BotContext = { vaultTransport: transport, chatId: 'owner-123' }

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
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: 'owner-123' }

    await handleIncomingMessage({ chatId: 'stranger-999', text: 'add a task' }, deps)

    expect(claudeClient.messages.create).not.toHaveBeenCalled()
    expect(vaultTransport.writeFileCalls).toHaveLength(0)
    expect(telegramClient.sendMessage).not.toHaveBeenCalled()
  })

  it('proceeds through Claude, the vault write, and the reply for the owner chat id', async () => {
    const claudeClient = fakeClaudeClient({ intent: 'create', title: 'Call the CA about GST', domain: 'Finance' })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: 'owner-123' }

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
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: 'owner-123' }

    await handleIncomingMessage({ chatId: 'owner-123', text: 'delete my last task' }, deps)

    expect(vaultTransport.writeFileCalls).toHaveLength(0)
    expect(telegramClient.sendMessage).toHaveBeenCalledWith('owner-123', NOT_YET_SUPPORTED)
  })

  it('is a complete no-op for a voice message from a non-owner chat id (no download, no transcribe, no send)', async () => {
    const claudeClient = fakeClaudeClient({ intent: 'create', title: 'sneaky task' })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const transcriber = fakeTranscriber({ text: 'sneaky task', confident: true })
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber, ownerChatId: 'owner-123' }

    await handleIncomingMessage({ chatId: 'stranger-999', text: '', voice: { fileId: 'voice-1' } }, deps)

    expect(telegramClient.downloadVoiceFile).not.toHaveBeenCalled()
    expect(transcriber.transcribe).not.toHaveBeenCalled()
    expect(claudeClient.messages.create).not.toHaveBeenCalled()
    expect(vaultTransport.writeFileCalls).toHaveLength(0)
    expect(telegramClient.sendMessage).not.toHaveBeenCalled()
  })
})

describe('handleIncomingMessage — voice (S18, ADR-0014)', () => {
  it('a confident transcript downloads, transcribes, classifies, writes to the vault once, and echoes the transcript in the reply', async () => {
    const chatId = 'owner-voice-1'
    const claudeClient = fakeClaudeClient({ intent: 'create', title: 'Call the CA about GST', domain: 'Finance' })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const transcriber = fakeTranscriber({ text: 'call the CA about GST', confident: true })
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber, ownerChatId: chatId }

    await handleIncomingMessage({ chatId, text: '', voice: { fileId: 'voice-2' } }, deps)

    expect(telegramClient.downloadVoiceFile).toHaveBeenCalledWith('voice-2')
    expect(transcriber.transcribe).toHaveBeenCalledWith(Buffer.from('fake-ogg-bytes'), 'audio/ogg')
    expect(claudeClient.messages.create).toHaveBeenCalledTimes(1)
    expect(vaultTransport.writeFileCalls).toHaveLength(1)
    expect(telegramClient.sendMessage).toHaveBeenCalledWith(
      chatId,
      "heard: 'call the CA about GST' → ✓ added 'Call the CA about GST' · Finance",
    )
  })

  it('a non-confident transcript replies with RETYPE_PROMPT and never reaches classifyAndExtract or the vault', async () => {
    const chatId = 'owner-voice-2'
    const claudeClient = fakeClaudeClient({ intent: 'create', title: 'should not be reached' })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const transcriber = fakeTranscriber({ text: 'garbled mumble', confident: false })
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber, ownerChatId: chatId }

    await handleIncomingMessage({ chatId, text: '', voice: { fileId: 'voice-3' } }, deps)

    expect(telegramClient.downloadVoiceFile).toHaveBeenCalledWith('voice-3')
    expect(transcriber.transcribe).toHaveBeenCalledTimes(1)
    expect(claudeClient.messages.create).not.toHaveBeenCalled()
    expect(vaultTransport.writeFileCalls).toHaveLength(0)
    expect(telegramClient.sendMessage).toHaveBeenCalledWith(chatId, RETYPE_PROMPT)
  })
})

describe('handleIncomingMessage — photo branch (S19b, ADR-0012)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('downloads, extracts, and sends a numbered batch-confirm prompt listing every task + the instruction line', async () => {
    const chatId = 'owner-photo-1'
    const claudeClient = fakeClaudeClient({
      tasks: [
        { title: 'Renew passport', domain: 'Life Admin', priority: 2 },
        { title: 'Call plumber', domain: 'Life Admin' },
        { title: 'Book dentist', priority: 1 },
      ],
    })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }

    await handleIncomingMessage({ chatId, text: '', photoFileId: 'file-1' }, deps)

    expect(telegramClient.downloadPhoto).toHaveBeenCalledWith('file-1')
    expect(vaultTransport.writeFileCalls).toHaveLength(0)
    expect(telegramClient.sendMessage).toHaveBeenCalledWith(
      chatId,
      [
        '1. Renew passport · Life Admin · P2',
        '2. Call plumber · Life Admin',
        '3. Book dentist · Inbox · P1',
        `Reply 'all' to create all 3, 'none' to cancel, or numbers (e.g. '1,3') for a subset.`,
      ].join('\n'),
    )
  })

  it('a zero-task photo replies "no tasks found" and sets no pending state', async () => {
    const chatId = 'owner-photo-2'
    const claudeClient = fakeClaudeClient({ tasks: [] })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }

    await handleIncomingMessage({ chatId, text: '', photoFileId: 'file-2' }, deps)

    expect(telegramClient.sendMessage).toHaveBeenCalledWith(
      chatId,
      "Couldn't find any tasks in that photo.",
    )

    // A subsequent unrelated text message is not treated as a confirm reply
    // — it flows through the normal NLU path instead.
    const nluClaudeClient = fakeClaudeClient({ intent: 'other' })
    const deps2: RouterDeps = { ...deps, claudeClient: nluClaudeClient }
    await handleIncomingMessage({ chatId, text: 'good morning' }, deps2)

    expect(nluClaudeClient.messages.create).toHaveBeenCalledTimes(1)
    expect(telegramClient.sendMessage).toHaveBeenCalledWith(chatId, NOT_YET_SUPPORTED)
  })

  it('replies with a download-failed message and sets no pending when downloadPhoto rejects', async () => {
    const chatId = 'owner-photo-3'
    const claudeClient = fakeClaudeClient({ tasks: [] })
    const telegramClient = fakeTelegramClient()
    telegramClient.downloadPhoto.mockRejectedValue(new Error('network error'))
    const vaultTransport = createFakeVaultTransport()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }

    await handleIncomingMessage({ chatId, text: '', photoFileId: 'file-3' }, deps)

    expect(claudeClient.messages.create).not.toHaveBeenCalled()
    expect(telegramClient.sendMessage).toHaveBeenCalledWith(
      chatId,
      "Couldn't download that photo — try sending it again.",
    )
  })

  it('a non-owner chat id sending a photo is a complete no-op', async () => {
    const claudeClient = fakeClaudeClient({ tasks: [{ title: 'sneaky task' }] })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: 'owner-photo-4' }

    await handleIncomingMessage({ chatId: 'stranger-999', text: '', photoFileId: 'file-4' }, deps)

    expect(telegramClient.downloadPhoto).not.toHaveBeenCalled()
    expect(claudeClient.messages.create).not.toHaveBeenCalled()
    expect(vaultTransport.writeFileCalls).toHaveLength(0)
    expect(telegramClient.sendMessage).not.toHaveBeenCalled()
  })
})

describe('handleIncomingMessage — confirm-check branch (S19b, ADR-0012)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  async function sendPhoto(
    chatId: string,
    photoFileId: string,
    telegramClient: TelegramClient & { sendMessage: ReturnType<typeof vi.fn>; downloadPhoto: ReturnType<typeof vi.fn> },
    vaultTransport: ReturnType<typeof createFakeVaultTransport>,
    tasks: unknown[],
  ): Promise<void> {
    const visionClient = fakeClaudeClient({ tasks })
    const deps: RouterDeps = { claudeClient: visionClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }
    await handleIncomingMessage({ chatId, text: '', photoFileId }, deps)
  }

  it("'all' creates every task via handleCreate (one vault write per task) and clears pending", async () => {
    const chatId = 'owner-confirm-1'
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const tasks = [
      { title: 'Renew passport', domain: 'Life Admin', priority: 2 },
      { title: 'Call plumber', domain: 'Life Admin' },
    ]
    await sendPhoto(chatId, 'file-5', telegramClient, vaultTransport, tasks)

    const nluClaudeClient = fakeClaudeClient({ intent: 'other' })
    const deps: RouterDeps = { claudeClient: nluClaudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }
    await handleIncomingMessage({ chatId, text: 'all' }, deps)

    expect(vaultTransport.writeFileCalls).toHaveLength(2)
    expect(nluClaudeClient.messages.create).not.toHaveBeenCalled()
    expect(telegramClient.sendMessage).toHaveBeenLastCalledWith(
      chatId,
      [
        '✓ added 2 tasks:',
        "✓ added 'Renew passport' · Life Admin · P2",
        "✓ added 'Call plumber' · Life Admin",
      ].join('\n'),
    )

    // Pending is cleared — a follow-up 'all' now falls through to NLU.
    await handleIncomingMessage({ chatId, text: 'all' }, deps)
    expect(nluClaudeClient.messages.create).toHaveBeenCalledTimes(1)
  })

  it("'y' behaves like 'all' for a single-task batch, with no summary prefix", async () => {
    const chatId = 'owner-confirm-2'
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    await sendPhoto(chatId, 'file-6', telegramClient, vaultTransport, [{ title: 'Book dentist' }])

    const deps: RouterDeps = { claudeClient: fakeClaudeClient({}), telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }
    await handleIncomingMessage({ chatId, text: 'y' }, deps)

    expect(vaultTransport.writeFileCalls).toHaveLength(1)
    expect(telegramClient.sendMessage).toHaveBeenLastCalledWith(chatId, "✓ added 'Book dentist' · Inbox")
  })

  it("'none' cancels the batch with no vault write", async () => {
    const chatId = 'owner-confirm-3'
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    await sendPhoto(chatId, 'file-7', telegramClient, vaultTransport, [{ title: 'Renew passport' }])

    const deps: RouterDeps = { claudeClient: fakeClaudeClient({}), telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }
    await handleIncomingMessage({ chatId, text: 'none' }, deps)

    expect(vaultTransport.writeFileCalls).toHaveLength(0)
    expect(telegramClient.sendMessage).toHaveBeenLastCalledWith(chatId, 'Cancelled.')
  })

  it("'n' cancels the batch just like 'none'", async () => {
    const chatId = 'owner-confirm-4'
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    await sendPhoto(chatId, 'file-8', telegramClient, vaultTransport, [{ title: 'Renew passport' }])

    const deps: RouterDeps = { claudeClient: fakeClaudeClient({}), telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }
    await handleIncomingMessage({ chatId, text: 'N' }, deps)

    expect(vaultTransport.writeFileCalls).toHaveLength(0)
    expect(telegramClient.sendMessage).toHaveBeenLastCalledWith(chatId, 'Cancelled.')
  })

  it("a subset reply (e.g. '1,3') creates only the selected tasks, in the given order", async () => {
    const chatId = 'owner-confirm-5'
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const tasks = [
      { title: 'Renew passport', domain: 'Life Admin' },
      { title: 'Call plumber', domain: 'Life Admin' },
      { title: 'Book dentist', domain: 'Body & Mind' },
    ]
    await sendPhoto(chatId, 'file-9', telegramClient, vaultTransport, tasks)

    const deps: RouterDeps = { claudeClient: fakeClaudeClient({}), telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }
    await handleIncomingMessage({ chatId, text: '1,3' }, deps)

    expect(vaultTransport.writeFileCalls).toHaveLength(2)
    expect(telegramClient.sendMessage).toHaveBeenLastCalledWith(
      chatId,
      [
        '✓ added 2 tasks:',
        "✓ added 'Renew passport' · Life Admin",
        "✓ added 'Book dentist' · Body & Mind",
      ].join('\n'),
    )
  })

  it('an invalid reply leaves the pending batch intact and re-sends the instruction; a following "all" still resolves it', async () => {
    const chatId = 'owner-confirm-6'
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const tasks = [{ title: 'Renew passport' }, { title: 'Call plumber' }]
    await sendPhoto(chatId, 'file-10', telegramClient, vaultTransport, tasks)

    const deps: RouterDeps = { claudeClient: fakeClaudeClient({}), telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }
    await handleIncomingMessage({ chatId, text: 'maybe' }, deps)

    expect(vaultTransport.writeFileCalls).toHaveLength(0)
    expect(telegramClient.sendMessage).toHaveBeenLastCalledWith(
      chatId,
      `Reply 'all' to create all 2, 'none' to cancel, or numbers (e.g. '1,3') for a subset.`,
    )

    await handleIncomingMessage({ chatId, text: 'all' }, deps)
    expect(vaultTransport.writeFileCalls).toHaveLength(2)
  })

  it('an expired pending batch is not treated as a confirm reply — the message flows into the normal NLU path', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0))

    const chatId = 'owner-confirm-7'
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    await sendPhoto(chatId, 'file-11', telegramClient, vaultTransport, [{ title: 'Renew passport' }])

    vi.setSystemTime(new Date(2026, 0, 1, 0, 11, 0)) // 11 minutes later — past the 10-minute TTL

    const nluClaudeClient = fakeClaudeClient({ intent: 'other' })
    const deps: RouterDeps = { claudeClient: nluClaudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }
    await handleIncomingMessage({ chatId, text: 'all' }, deps)

    expect(nluClaudeClient.messages.create).toHaveBeenCalledTimes(1)
    expect(vaultTransport.writeFileCalls).toHaveLength(0)
    expect(telegramClient.sendMessage).toHaveBeenLastCalledWith(chatId, NOT_YET_SUPPORTED)
  })
})

describe('handleIncomingMessage — confirm-destructive gate (S17, ADR-0013)', () => {
  function pendingMatch(): MatchedTask {
    return {
      task: { id: 'task-1', title: 'Call the CA about GST', done: false, created_at: 1000, domain: 'Finance' },
      path: 'Finance/Inbox.md',
      rawLine: '- [ ] Call the CA about GST id:: task-1',
    }
  }

  afterEach(() => {
    clearConfirmPending('owner-gate-1')
    clearConfirmPending('owner-gate-2')
    clearConfirmPending('owner-gate-3')
  })

  it('a "y" reply while a delete confirm is pending commits WITHOUT ever calling classifyAndExtract', async () => {
    const chatId = 'owner-gate-1'
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport([
      { path: 'Finance/Inbox.md', content: '- [ ] Call the CA about GST id:: task-1\n' },
    ])
    setConfirmPending(chatId, {
      kind: 'confirm',
      intent: 'delete',
      match: pendingMatch(),
      promptedAt: Date.now(),
    })

    const nluClaudeClient = fakeClaudeClient({ intent: 'other' })
    const deps: RouterDeps = { claudeClient: nluClaudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }
    await handleIncomingMessage({ chatId, text: 'y' }, deps)

    expect(nluClaudeClient.messages.create).not.toHaveBeenCalled()
    expect(vaultTransport.writeFileCalls).toHaveLength(1)
    expect(telegramClient.sendMessage).toHaveBeenCalledWith(chatId, "✓ deleted 'Call the CA about GST'")
    expect(getConfirmPending(chatId)).toBeUndefined()
  })

  it('an "n" reply cancels the pending update WITHOUT touching the vault or calling classifyAndExtract', async () => {
    const chatId = 'owner-gate-2'
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport([
      { path: 'Finance/Inbox.md', content: '- [ ] Call the CA about GST id:: task-1\n' },
    ])
    setConfirmPending(chatId, {
      kind: 'confirm',
      intent: 'update',
      match: pendingMatch(),
      patch: { priority: 3 },
      promptedAt: Date.now(),
    })

    const nluClaudeClient = fakeClaudeClient({ intent: 'other' })
    const deps: RouterDeps = { claudeClient: nluClaudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }
    await handleIncomingMessage({ chatId, text: 'n' }, deps)

    expect(nluClaudeClient.messages.create).not.toHaveBeenCalled()
    expect(vaultTransport.writeFileCalls).toHaveLength(0)
    expect(telegramClient.sendMessage).toHaveBeenCalledWith(chatId, 'Cancelled.')
  })

  it('create regression: with no confirm-store pending state, a message still fires create instantly', async () => {
    const chatId = 'owner-gate-3'
    const claudeClient = fakeClaudeClient({ intent: 'create', title: 'Water the plants' })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }

    await handleIncomingMessage({ chatId, text: 'water the plants' }, deps)

    expect(claudeClient.messages.create).toHaveBeenCalledTimes(1)
    expect(vaultTransport.writeFileCalls).toHaveLength(1)
    expect(telegramClient.sendMessage).toHaveBeenCalledWith(chatId, "✓ added 'Water the plants' · Inbox")
  })
})

describe('handleIncomingMessage — onAction seam (S51)', () => {
  afterEach(() => {
    clearConfirmPending('owner-action-2')
    clearConfirmPending('owner-action-3')
  })

  it('a successful create fires onAction once with ok:true and note "create: <title>"', async () => {
    const chatId = 'owner-action-1'
    const claudeClient = fakeClaudeClient({ intent: 'create', title: 'Buy milk', domain: 'Growth' })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const onAction = vi.fn()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId, onAction }

    await handleIncomingMessage({ chatId, text: 'buy milk' }, deps)

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith({ ok: true, note: 'create: Buy milk' })
  })

  it('an update confirmed with "y" fires onAction on the confirming message (the commit-time message)', async () => {
    const chatId = 'owner-action-2'
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport([
      { path: 'Finance/Inbox.md', content: '- [ ] Call the CA about GST id:: task-1\n' },
    ])
    const onAction = vi.fn()
    setConfirmPending(chatId, {
      kind: 'confirm',
      intent: 'update',
      match: {
        task: { id: 'task-1', title: 'Call the CA about GST', done: false, created_at: 1000, domain: 'Finance' },
        path: 'Finance/Inbox.md',
        rawLine: '- [ ] Call the CA about GST id:: task-1',
      },
      patch: { priority: 3 },
      promptedAt: Date.now(),
    })
    const deps: RouterDeps = { claudeClient: fakeClaudeClient({}), telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId, onAction }

    await handleIncomingMessage({ chatId, text: 'y' }, deps)

    expect(vaultTransport.writeFileCalls).toHaveLength(1)
    // update flows through confirm/gate.ts, not router's own dispatchIntent
    // branch — router's onAction seam only wraps the classify+dispatch path,
    // so the confirm-destructive gate's "y" reply does not itself fire it.
    expect(onAction).not.toHaveBeenCalled()
  })

  it('a delete confirmed with "y" commits but does not fire router\'s onAction (gate path, not classify+dispatch)', async () => {
    const chatId = 'owner-action-3'
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport([
      { path: 'Finance/Inbox.md', content: '- [ ] Call the CA about GST id:: task-1\n' },
    ])
    const onAction = vi.fn()
    setConfirmPending(chatId, {
      kind: 'confirm',
      intent: 'delete',
      match: {
        task: { id: 'task-1', title: 'Call the CA about GST', done: false, created_at: 1000, domain: 'Finance' },
        path: 'Finance/Inbox.md',
        rawLine: '- [ ] Call the CA about GST id:: task-1',
      },
      promptedAt: Date.now(),
    })
    const deps: RouterDeps = { claudeClient: fakeClaudeClient({}), telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId, onAction }

    await handleIncomingMessage({ chatId, text: 'y' }, deps)

    expect(vaultTransport.writeFileCalls).toHaveLength(1)
    expect(onAction).not.toHaveBeenCalled()
  })

  it('a handled photo batch-confirm ("all") fires onAction once with note "photo: created <n>"', async () => {
    const chatId = 'owner-action-4'
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const onAction = vi.fn()
    const visionClient = fakeClaudeClient({
      tasks: [{ title: 'Renew passport' }, { title: 'Call plumber' }],
    })
    const photoDeps: RouterDeps = { claudeClient: visionClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId, onAction }
    await handleIncomingMessage({ chatId, text: '', photoFileId: 'file-action-1' }, photoDeps)
    expect(onAction).not.toHaveBeenCalled() // the batch prompt itself is not a handled action yet

    const nluClaudeClient = fakeClaudeClient({ intent: 'other' })
    const confirmDeps: RouterDeps = { ...photoDeps, claudeClient: nluClaudeClient }
    await handleIncomingMessage({ chatId, text: 'all' }, confirmDeps)

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith({ ok: true, note: 'photo: created 2' })
  })

  it('a confident voice create fires onAction once with note "voice create: <title>"', async () => {
    const chatId = 'owner-action-5'
    const claudeClient = fakeClaudeClient({ intent: 'create', title: 'Call the CA about GST', domain: 'Finance' })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const transcriber = fakeTranscriber({ text: 'call the CA about GST', confident: true })
    const onAction = vi.fn()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber, ownerChatId: chatId, onAction }

    await handleIncomingMessage({ chatId, text: '', voice: { fileId: 'voice-action-1' } }, deps)

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith({ ok: true, note: 'voice create: Call the CA about GST' })
  })

  it('a non-confident voice message never fires onAction (retype prompt, no dispatch)', async () => {
    const chatId = 'owner-action-6'
    const claudeClient = fakeClaudeClient({ intent: 'create', title: 'should not be reached' })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const transcriber = fakeTranscriber({ text: 'garbled', confident: false })
    const onAction = vi.fn()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber, ownerChatId: chatId, onAction }

    await handleIncomingMessage({ chatId, text: '', voice: { fileId: 'voice-action-2' } }, deps)

    expect(onAction).not.toHaveBeenCalled()
  })

  it('a "not yet supported" text reply never fires onAction', async () => {
    const chatId = 'owner-action-7'
    const claudeClient = fakeClaudeClient({ intent: 'other' })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const onAction = vi.fn()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId, onAction }

    await handleIncomingMessage({ chatId, text: 'good morning' }, deps)

    expect(onAction).not.toHaveBeenCalled()
  })

  it('omitting onAction entirely is a no-op — no throw, message handling unaffected', async () => {
    const chatId = 'owner-action-8'
    const claudeClient = fakeClaudeClient({ intent: 'create', title: 'Buy eggs' })
    const telegramClient = fakeTelegramClient()
    const vaultTransport = createFakeVaultTransport()
    const deps: RouterDeps = { claudeClient, telegramClient, vaultTransport, transcriber: fakeTranscriber({ text: '', confident: false }), ownerChatId: chatId }

    await expect(handleIncomingMessage({ chatId, text: 'buy eggs' }, deps)).resolves.toBeUndefined()
    expect(telegramClient.sendMessage).toHaveBeenCalledWith(chatId, "✓ added 'Buy eggs' · Inbox")
  })
})
