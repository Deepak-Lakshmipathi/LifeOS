import { beforeEach, describe, expect, it } from 'vitest'
import { setPending, getPending, clearPending } from './photoConfirm'
import type { ExtractedTask } from './visionExtract'

const TASKS: ExtractedTask[] = [{ title: 'Renew passport', domain: 'Life Admin', priority: 2 }]

describe('photoConfirm', () => {
  beforeEach(() => {
    // Each chatId used below is unique to the test, so no explicit
    // clearPending is needed between tests — but do it anyway for hygiene.
    clearPending('chat-a')
    clearPending('chat-b')
    clearPending('chat-c')
  })

  it('getPending returns undefined when nothing is pending for a chat', () => {
    expect(getPending('chat-never-set')).toBeUndefined()
  })

  it('setPending then getPending returns the stored batch with a 10-minute expiry', () => {
    const now = () => 1_000_000
    setPending('chat-a', TASKS, now)

    const entry = getPending('chat-a', now)
    expect(entry).toBeDefined()
    expect(entry!.chatId).toBe('chat-a')
    expect(entry!.tasks).toEqual(TASKS)
    expect(entry!.expiresAt).toBe(1_000_000 + 10 * 60 * 1000)
  })

  it('getPending returns undefined once the clock passes expiresAt', () => {
    let time = 1_000_000
    const now = () => time
    setPending('chat-b', TASKS, now)

    time = 1_000_000 + 10 * 60 * 1000 // exactly at expiry — treated as expired
    expect(getPending('chat-b', now)).toBeUndefined()

    time = 1_000_000 + 10 * 60 * 1000 - 1 // one ms before expiry — still valid
    expect(getPending('chat-b', () => time)).toBeUndefined() // already deleted by the prior expired read
  })

  it('setPending overwrites any existing pending batch for the same chat', () => {
    const now = () => 0
    setPending('chat-c', TASKS, now)
    const secondBatch: ExtractedTask[] = [{ title: 'Call plumber' }]
    setPending('chat-c', secondBatch, now)

    const entry = getPending('chat-c', now)
    expect(entry!.tasks).toEqual(secondBatch)
  })

  it('clearPending removes the entry so a subsequent getPending is undefined', () => {
    const now = () => 0
    setPending('chat-c', TASKS, now)
    clearPending('chat-c')

    expect(getPending('chat-c', now)).toBeUndefined()
  })

  it('clearPending is a no-op when nothing is pending', () => {
    expect(() => clearPending('chat-never-set')).not.toThrow()
  })
})
