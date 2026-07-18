/**
 * index.test — S51 DoD #2: heartbeat writes status at the interval under
 * fake timers. Exercises the real `setInterval(…, HEARTBEAT_MS)` wiring in
 * index.ts's main() (run as an import-time side effect — index.ts has no
 * exports, mirroring its "long-poll worker entrypoint" shape) by mocking
 * every collaborator (config, RealTelegramClient, Claude/transcriber
 * factories, NodeVaultTransport, runLog) so main() runs with no live
 * network/IO, then advancing fake timers and asserting logHeartbeat fires.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const HEARTBEAT_MS = 15 * 60 * 1000

const fakeConfig = {
  telegramBotToken: 'fake-token',
  botVaultPat: 'fake-pat',
  botVaultRepoUrl: 'https://example.invalid/vault.git',
  anthropicApiKey: 'fake-anthropic-key',
  groqApiKey: 'fake-groq-key',
  ownerTelegramChatId: 'owner-1',
  botVaultCloneDir: '.vault-clone',
}

/** Mocks every index.ts collaborator so importing it (main() runs at import time) does no live IO. */
function mockCollaborators(): void {
  vi.doMock('./config', () => ({ loadConfig: vi.fn().mockReturnValue(fakeConfig) }))
  vi.doMock('./telegramClient', () => ({
    RealTelegramClient: vi.fn().mockImplementation(() => ({ pollUpdates: vi.fn() })),
  }))
  vi.doMock('./nlu', () => ({ createClaudeClient: vi.fn().mockReturnValue({}) }))
  vi.doMock('./transcription', () => ({ createTranscriber: vi.fn().mockReturnValue({}) }))
  vi.doMock('./vaultTransport', () => ({ NodeVaultTransport: vi.fn().mockImplementation(() => ({})) }))
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('index main() heartbeat wiring (S51 DoD #2)', () => {
  it('does not call logHeartbeat until HEARTBEAT_MS elapses, then once per interval tick', async () => {
    mockCollaborators()
    vi.doMock('./runLog', () => ({
      logBotAction: vi.fn(),
      logHeartbeat: vi.fn().mockResolvedValue(undefined),
    }))

    const { logHeartbeat } = await import('./runLog')
    await import('./index') // side effect: main() runs, sets up the unref'd interval

    expect(logHeartbeat).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS)
    expect(logHeartbeat).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS)
    expect(logHeartbeat).toHaveBeenCalledTimes(2)
  })

  it('passes the same vaultTransport instance main() constructed through to logHeartbeat', async () => {
    mockCollaborators()
    const fakeTransportInstance = { marker: 'the-one-transport' }
    vi.doMock('./vaultTransport', () => ({
      NodeVaultTransport: vi.fn().mockImplementation(() => fakeTransportInstance),
    }))
    vi.doMock('./runLog', () => ({
      logBotAction: vi.fn(),
      logHeartbeat: vi.fn().mockResolvedValue(undefined),
    }))

    const { logHeartbeat } = await import('./runLog')
    await import('./index')

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS)
    expect(logHeartbeat).toHaveBeenCalledWith(fakeTransportInstance)
  })
})
