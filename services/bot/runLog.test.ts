/**
 * runLog.test — S51: the bot's run-logging adapter over the S47 file shapes.
 *
 * Fake-transport only (no git/network/IO), same pattern as every other bot
 * test. Cross-parses the written status.json through the PWA's real
 * agentStatus.ts parser so a shape drift fails here, not silently on the
 * Health board.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logBotAction, logHeartbeat, _resetRunsCache } from './runLog'
import { createFakeVaultTransport } from './testUtils/fakeVaultTransport'
import { parseStatus, parseRuns } from '../../src/vault/agentStatus'

const STATUS_PATH = 'agents/telegram-bot/status.json'
const RUNS_PATH = 'agents/telegram-bot/runs.jsonl'

const find = (t: ReturnType<typeof createFakeVaultTransport>, path: string) =>
  t.files.find((f) => f.path === path)?.content

beforeEach(() => {
  _resetRunsCache()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('logBotAction', () => {
  it('writes one runs.jsonl line + a refreshed status.json; note carries the action (DoD #1)', async () => {
    const t = createFakeVaultTransport()
    await logBotAction(t, { ok: true, note: 'create: Buy milk', ts: '2026-07-18T10:00:00.000Z' })

    const runs = parseRuns(find(t, RUNS_PATH))
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ ok: true, note: 'create: Buy milk', ts: '2026-07-18T10:00:00.000Z' })

    const status = parseStatus(find(t, STATUS_PATH))
    expect(status).not.toBeNull()
    expect(status!.agent).toBe('telegram-bot')
    expect(status!.note).toBe('create: Buy milk')
    expect(status!.ok).toBe(true)
    expect(status!.last_run).toBe('2026-07-18T10:00:00.000Z')
    expect(status!.expected_cadence_min).toBe(15)
  })

  it('appends across calls — runs.jsonl accumulates, status.json is the latest only', async () => {
    const t = createFakeVaultTransport()
    await logBotAction(t, { ok: true, note: 'create: A', ts: '2026-07-18T10:00:00.000Z' })
    await logBotAction(t, { ok: true, note: 'delete: B', ts: '2026-07-18T10:05:00.000Z' })

    const runs = parseRuns(find(t, RUNS_PATH))
    expect(runs).toHaveLength(2)
    expect(runs.map((r) => r.note)).toEqual(['create: A', 'delete: B'])

    const status = parseStatus(find(t, STATUS_PATH))
    expect(status!.note).toBe('delete: B')
    expect(status!.last_run).toBe('2026-07-18T10:05:00.000Z')
  })

  it('never throws when the transport fails — swallows + warns (DoD #2)', async () => {
    const t = createFakeVaultTransport()
    vi.spyOn(t, 'writeFile').mockRejectedValue(new Error('vault push rejected'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(logBotAction(t, { ok: true, note: 'create: X' })).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })
})

describe('logHeartbeat', () => {
  it('writes status.json only (no runs.jsonl entry), note "polling" (DoD #2)', async () => {
    const t = createFakeVaultTransport()
    await logHeartbeat(t)

    expect(find(t, RUNS_PATH)).toBeUndefined()
    const status = parseStatus(find(t, STATUS_PATH))
    expect(status!.agent).toBe('telegram-bot')
    expect(status!.note).toBe('polling')
    expect(status!.ok).toBe(true)
    expect(status!.expected_cadence_min).toBe(15)
  })

  it('never throws when the transport fails (DoD #2)', async () => {
    const t = createFakeVaultTransport()
    vi.spyOn(t, 'writeFile').mockRejectedValue(new Error('offline'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(logHeartbeat(t)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })
})

describe('status.json cross-parses with the PWA agentStatus.ts (DoD #3)', () => {
  it('healthOf reads a fresh heartbeat as ok', async () => {
    const t = createFakeVaultTransport()
    const now = Date.parse('2026-07-18T10:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)
    await logHeartbeat(t)

    const status = parseStatus(find(t, STATUS_PATH))
    // 5 minutes later — well within the 15min cadence, must read healthy.
    const { healthOf } = await import('../../src/vault/agentStatus')
    expect(healthOf(status, now + 5 * 60 * 1000)).toBe('ok')
  })
})
