import { describe, expect, it, vi } from 'vitest'
import { resolvePending, buildConfirmPrompt, buildDisambiguatePrompt } from './gate'
import { setPending, getPending } from './store'
import { createFakeVaultTransport } from '../testUtils/fakeVaultTransport'
import type { BotContext } from '../intents/types'
import type { MatchedTask } from '../taskMatch'

const RAW_LINE = '- [ ] Call the CA about GST id:: task-1 priority:: 2'

function seedTransport() {
  return createFakeVaultTransport([{ path: 'Finance/Inbox.md', content: RAW_LINE + '\n' }])
}

function makeMatch(overrides: Partial<MatchedTask['task']> = {}): MatchedTask {
  return {
    task: {
      id: 'task-1',
      title: 'Call the CA about GST',
      done: false,
      created_at: 1000,
      priority: 2,
      domain: 'Finance',
      ...overrides,
    },
    path: 'Finance/Inbox.md',
    rawLine: RAW_LINE,
  }
}

function ctxFor(chatId: string, transport: ReturnType<typeof createFakeVaultTransport>): BotContext {
  return { vaultTransport: transport, chatId }
}

describe('confirm/gate — resolvePending', () => {
  it('returns null (fall through to NLU) when there is no pending action for the chat', async () => {
    const transport = seedTransport()
    const result = await resolvePending('chat-none', 'y', ctxFor('chat-none', transport))
    expect(result).toBeNull()
  })

  describe('confirm kind', () => {
    it('"y" commits an update patch: re-reads, splices the exact rawLine, writes, clears pending', async () => {
      const chatId = 'chat-update-y'
      const transport = seedTransport()
      setPending(chatId, {
        kind: 'confirm',
        intent: 'update',
        match: makeMatch(),
        patch: { priority: 3 },
        promptedAt: Date.now(),
      })

      const reply = await resolvePending(chatId, 'y', ctxFor(chatId, transport))

      expect(transport.writeFileCalls).toHaveLength(1)
      expect(transport.writeFileCalls[0]!.path).toBe('Finance/Inbox.md')
      expect(transport.writeFileCalls[0]!.content).toContain('priority:: 3')
      expect(transport.writeFileCalls[0]!.content).not.toContain('priority:: 2')
      expect(reply).toBe("✓ updated 'Call the CA about GST'")
      expect(getPending(chatId)).toBeUndefined()
    })

    it('"yes" also commits (case-insensitive)', async () => {
      const chatId = 'chat-update-yes'
      const transport = seedTransport()
      setPending(chatId, {
        kind: 'confirm',
        intent: 'update',
        match: makeMatch(),
        patch: { mark_done: true },
        promptedAt: Date.now(),
      })

      const reply = await resolvePending(chatId, 'YES', ctxFor(chatId, transport))

      expect(transport.writeFileCalls).toHaveLength(1)
      expect(reply).toBe("✓ marked 'Call the CA about GST' done")
    })

    it('"n" cancels without touching the vault', async () => {
      const chatId = 'chat-cancel'
      const transport = seedTransport()
      setPending(chatId, {
        kind: 'confirm',
        intent: 'delete',
        match: makeMatch(),
        promptedAt: Date.now(),
      })

      const reply = await resolvePending(chatId, 'n', ctxFor(chatId, transport))

      expect(transport.writeFileCalls).toHaveLength(0)
      expect(reply).toBe('Cancelled.')
      expect(getPending(chatId)).toBeUndefined()
    })

    it('"no"/"cancel" also cancel', async () => {
      const chatId = 'chat-cancel-2'
      const transport = seedTransport()
      setPending(chatId, { kind: 'confirm', intent: 'delete', match: makeMatch(), promptedAt: Date.now() })
      expect(await resolvePending(chatId, 'no', ctxFor(chatId, transport))).toBe('Cancelled.')

      setPending(chatId, { kind: 'confirm', intent: 'delete', match: makeMatch(), promptedAt: Date.now() })
      expect(await resolvePending(chatId, 'cancel', ctxFor(chatId, transport))).toBe('Cancelled.')
    })

    it('an unrecognized reply re-prompts with the exact-change text WITHOUT clearing pending state', async () => {
      const chatId = 'chat-unrecognized'
      const transport = seedTransport()
      const match = makeMatch()
      setPending(chatId, { kind: 'confirm', intent: 'delete', match, promptedAt: Date.now() })

      const reply = await resolvePending(chatId, 'maybe later', ctxFor(chatId, transport))

      expect(reply).toBe(buildConfirmPrompt('delete', match))
      expect(transport.writeFileCalls).toHaveLength(0)
      expect(getPending(chatId)).toBeDefined()
      expect(getPending(chatId)!.kind).toBe('confirm')
    })

    it('commits a delete by removing the exact line', async () => {
      const chatId = 'chat-delete-y'
      const transport = seedTransport()
      setPending(chatId, { kind: 'confirm', intent: 'delete', match: makeMatch(), promptedAt: Date.now() })

      const reply = await resolvePending(chatId, 'y', ctxFor(chatId, transport))

      expect(transport.writeFileCalls[0]!.content).not.toContain('Call the CA about GST')
      expect(reply).toBe("✓ deleted 'Call the CA about GST'")
    })

    it('stale rawLine at commit time (0 matches) cancels with the "changed since" reply', async () => {
      const chatId = 'chat-stale-0'
      // File content no longer contains the rawLine the prompt was built from.
      const transport = createFakeVaultTransport([{ path: 'Finance/Inbox.md', content: '- [ ] A different task\n' }])
      setPending(chatId, { kind: 'confirm', intent: 'delete', match: makeMatch(), promptedAt: Date.now() })

      const reply = await resolvePending(chatId, 'y', ctxFor(chatId, transport))

      expect(reply).toBe('That task changed since I asked — please try again.')
      expect(transport.writeFileCalls).toHaveLength(0)
      expect(getPending(chatId)).toBeUndefined()
    })

    it('stale rawLine at commit time (duplicate matches) cancels with the "changed since" reply', async () => {
      const chatId = 'chat-stale-dup'
      const transport = createFakeVaultTransport([{ path: 'Finance/Inbox.md', content: `${RAW_LINE}\n${RAW_LINE}\n` }])
      setPending(chatId, { kind: 'confirm', intent: 'delete', match: makeMatch(), promptedAt: Date.now() })

      const reply = await resolvePending(chatId, 'y', ctxFor(chatId, transport))

      expect(reply).toBe('That task changed since I asked — please try again.')
      expect(transport.writeFileCalls).toHaveLength(0)
      expect(getPending(chatId)).toBeUndefined()
    })
  })

  describe('onCommit callback (#136 — bot run-log seam)', () => {
    it('fires once with note "update: <title>" on a successful update commit', async () => {
      const chatId = 'chat-oncommit-update'
      const transport = seedTransport()
      const onCommit = vi.fn()
      setPending(chatId, {
        kind: 'confirm',
        intent: 'update',
        match: makeMatch(),
        patch: { priority: 3 },
        promptedAt: Date.now(),
      })

      await resolvePending(chatId, 'y', ctxFor(chatId, transport), onCommit)

      expect(onCommit).toHaveBeenCalledTimes(1)
      expect(onCommit).toHaveBeenCalledWith('update: Call the CA about GST')
    })

    it('fires once with note "update: <title>" for a mark-done commit (mark-done is an update intent)', async () => {
      const chatId = 'chat-oncommit-markdone'
      const transport = seedTransport()
      const onCommit = vi.fn()
      setPending(chatId, {
        kind: 'confirm',
        intent: 'update',
        match: makeMatch(),
        patch: { mark_done: true },
        promptedAt: Date.now(),
      })

      await resolvePending(chatId, 'yes', ctxFor(chatId, transport), onCommit)

      expect(onCommit).toHaveBeenCalledTimes(1)
      expect(onCommit).toHaveBeenCalledWith('update: Call the CA about GST')
    })

    it('fires once with note "delete: <title>" on a successful delete commit', async () => {
      const chatId = 'chat-oncommit-delete'
      const transport = seedTransport()
      const onCommit = vi.fn()
      setPending(chatId, { kind: 'confirm', intent: 'delete', match: makeMatch(), promptedAt: Date.now() })

      await resolvePending(chatId, 'y', ctxFor(chatId, transport), onCommit)

      expect(onCommit).toHaveBeenCalledTimes(1)
      expect(onCommit).toHaveBeenCalledWith('delete: Call the CA about GST')
    })

    it('never fires on "n"/cancel', async () => {
      const chatId = 'chat-oncommit-cancel'
      const transport = seedTransport()
      const onCommit = vi.fn()
      setPending(chatId, { kind: 'confirm', intent: 'delete', match: makeMatch(), promptedAt: Date.now() })

      await resolvePending(chatId, 'n', ctxFor(chatId, transport), onCommit)

      expect(onCommit).not.toHaveBeenCalled()
    })

    it('never fires on an unrecognized reply (state left pending)', async () => {
      const chatId = 'chat-oncommit-unrecognized'
      const transport = seedTransport()
      const onCommit = vi.fn()
      setPending(chatId, { kind: 'confirm', intent: 'delete', match: makeMatch(), promptedAt: Date.now() })

      await resolvePending(chatId, 'maybe later', ctxFor(chatId, transport), onCommit)

      expect(onCommit).not.toHaveBeenCalled()
    })

    it('never fires on a stale commit (rawLine no longer matches — STALE_REPLY, no write)', async () => {
      const chatId = 'chat-oncommit-stale'
      const transport = createFakeVaultTransport([{ path: 'Finance/Inbox.md', content: '- [ ] A different task\n' }])
      const onCommit = vi.fn()
      setPending(chatId, { kind: 'confirm', intent: 'delete', match: makeMatch(), promptedAt: Date.now() })

      const reply = await resolvePending(chatId, 'y', ctxFor(chatId, transport), onCommit)

      expect(reply).toBe('That task changed since I asked — please try again.')
      expect(transport.writeFileCalls).toHaveLength(0)
      expect(onCommit).not.toHaveBeenCalled()
    })

    it('is safe to omit — commit proceeds and returns normally with no onCommit arg', async () => {
      const chatId = 'chat-oncommit-omitted'
      const transport = seedTransport()
      setPending(chatId, { kind: 'confirm', intent: 'delete', match: makeMatch(), promptedAt: Date.now() })

      const reply = await resolvePending(chatId, 'y', ctxFor(chatId, transport))

      expect(reply).toBe("✓ deleted 'Call the CA about GST'")
      expect(transport.writeFileCalls).toHaveLength(1)
    })
  })

  describe('disambiguate kind', () => {
    const candidates: MatchedTask[] = [
      makeMatch({ id: 'task-1', title: 'Call the CA about GST' }),
      { ...makeMatch({ id: 'task-2', title: 'Call the CA about VAT' }), path: 'Finance/Inbox.md', rawLine: '- [ ] Call the CA about VAT id:: task-2' },
    ]

    it('a valid number picks a candidate and transitions to confirm, re-prompting with the exact-change text', async () => {
      const chatId = 'chat-disambig-pick'
      const transport = seedTransport()
      setPending(chatId, { kind: 'disambiguate', intent: 'delete', candidates })

      const reply = await resolvePending(chatId, '2', ctxFor(chatId, transport))

      expect(reply).toBe(buildConfirmPrompt('delete', candidates[1]!))
      const pending = getPending(chatId)
      expect(pending?.kind).toBe('confirm')
      if (pending?.kind === 'confirm') {
        expect(pending.match).toBe(candidates[1])
      }
    })

    it('two-step flow: disambiguate pick then "y" commits the picked candidate', async () => {
      const chatId = 'chat-disambig-then-confirm'
      const transport = createFakeVaultTransport([
        { path: 'Finance/Inbox.md', content: '- [ ] Call the CA about VAT id:: task-2\n' },
      ])
      setPending(chatId, { kind: 'disambiguate', intent: 'delete', candidates })

      await resolvePending(chatId, '2', ctxFor(chatId, transport))
      const reply = await resolvePending(chatId, 'y', ctxFor(chatId, transport))

      expect(transport.writeFileCalls).toHaveLength(1)
      expect(reply).toBe("✓ deleted 'Call the CA about VAT'")
      expect(getPending(chatId)).toBeUndefined()
    })

    it('an out-of-range or non-numeric reply re-prompts the candidate list WITHOUT clearing state', async () => {
      const chatId = 'chat-disambig-invalid'
      const transport = seedTransport()
      setPending(chatId, { kind: 'disambiguate', intent: 'delete', candidates })

      const reply = await resolvePending(chatId, '99', ctxFor(chatId, transport))

      expect(reply).toBe(buildDisambiguatePrompt(candidates))
      expect(getPending(chatId)?.kind).toBe('disambiguate')

      const reply2 = await resolvePending(chatId, 'not a number', ctxFor(chatId, transport))
      expect(reply2).toBe(buildDisambiguatePrompt(candidates))
      expect(getPending(chatId)?.kind).toBe('disambiguate')
    })
  })
})
