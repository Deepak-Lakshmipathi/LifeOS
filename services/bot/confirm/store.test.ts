import { afterEach, describe, expect, it, vi } from 'vitest'
import { setPending, getPending, clearPending, CONFIRM_TTL_MS } from './store'
import type { MatchedTask } from '../taskMatch'

const MATCH: MatchedTask = {
  task: { id: 'task-1', title: 'Call the CA about GST', done: false, created_at: 1_000 },
  path: 'Finance/Inbox.md',
  rawLine: '- [ ] Call the CA about GST id:: task-1',
}

describe('confirm/store', () => {
  afterEach(() => {
    vi.useRealTimers()
    clearPending('chat-a')
    clearPending('chat-b')
    clearPending('chat-c')
    clearPending('chat-never-set')
  })

  it('getPending returns undefined when nothing is pending for a chat', () => {
    expect(getPending('chat-never-set')).toBeUndefined()
  })

  it('setPending then getPending round-trips a confirm action with a 2-minute expiry', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)

    setPending('chat-a', { kind: 'confirm', intent: 'delete', match: MATCH, promptedAt: 1_000_000 })

    const entry = getPending('chat-a')
    expect(entry).toEqual({
      kind: 'confirm',
      intent: 'delete',
      match: MATCH,
      promptedAt: 1_000_000,
      expiresAt: 1_000_000 + CONFIRM_TTL_MS,
    })
  })

  it('setPending then getPending round-trips a disambiguate action', () => {
    vi.useFakeTimers()
    vi.setSystemTime(2_000_000)

    setPending('chat-b', { kind: 'disambiguate', intent: 'update', candidates: [MATCH], patch: { priority: 3 } })

    const entry = getPending('chat-b')
    expect(entry).toEqual({
      kind: 'disambiguate',
      intent: 'update',
      candidates: [MATCH],
      patch: { priority: 3 },
      expiresAt: 2_000_000 + CONFIRM_TTL_MS,
    })
  })

  it('getPending returns undefined once the clock passes expiresAt, and deletes the stale entry', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    setPending('chat-c', { kind: 'confirm', intent: 'delete', match: MATCH, promptedAt: 1_000_000 })

    vi.setSystemTime(1_000_000 + CONFIRM_TTL_MS + 1)
    expect(getPending('chat-c')).toBeUndefined()

    // Confirms lazy deletion — a second read at any time still finds nothing.
    vi.setSystemTime(1_000_000)
    expect(getPending('chat-c')).toBeUndefined()
  })

  it('setPending overwrites any existing pending action for the same chat', () => {
    setPending('chat-c', { kind: 'confirm', intent: 'delete', match: MATCH, promptedAt: Date.now() })
    setPending('chat-c', { kind: 'disambiguate', intent: 'update', candidates: [MATCH] })

    const entry = getPending('chat-c')
    expect(entry?.kind).toBe('disambiguate')
  })

  it('clearPending removes the entry so a subsequent getPending is undefined', () => {
    setPending('chat-c', { kind: 'confirm', intent: 'delete', match: MATCH, promptedAt: Date.now() })
    clearPending('chat-c')

    expect(getPending('chat-c')).toBeUndefined()
  })

  it('clearPending is a no-op when nothing is pending', () => {
    expect(() => clearPending('chat-never-set')).not.toThrow()
  })

  it('is per-chat: state set for one chatId is invisible to another', () => {
    setPending('chat-a', { kind: 'confirm', intent: 'delete', match: MATCH, promptedAt: Date.now() })

    expect(getPending('chat-b')).toBeUndefined()
  })
})
