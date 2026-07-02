import { describe, expect, it } from 'vitest'
import { getIntentHandler, registerIntentHandler } from './registry'
import type { IntentHandler } from './types'

describe('intents/registry', () => {
  it('getIntentHandler returns undefined for a name nothing has registered', () => {
    expect(getIntentHandler('nonexistent-intent-xyz')).toBeUndefined()
  })

  it('round-trips a registered handler', () => {
    const handler: IntentHandler = {
      // Cast: this test registers a throwaway name outside the real IntentName
      // union to avoid colliding with 'create' (registered globally via
      // intents/index.ts side effects elsewhere in the suite).
      name: 'test-only-registry-roundtrip' as unknown as IntentHandler['name'],
      handle: async () => 'ok',
    }

    registerIntentHandler(handler)

    expect(getIntentHandler('test-only-registry-roundtrip')).toBe(handler)
  })
})
