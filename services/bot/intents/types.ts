/**
 * intents/types — shared shapes for the intent-router seam (S16b, ADR-0011
 * Decision 4). Written once in this ticket; not touched again by S17-S19 —
 * each future intent slice's only shared touchpoint is one new import line
 * in intents/index.ts.
 */

import type { VaultTransport } from '../../../src/vault/transport'

/** Grows: 'update' | 'delete' (S17), 'voice' (S18), 'photo' (S19). */
export type IntentName = 'create'

/** Per-message context every intent handler needs. */
export interface BotContext {
  vaultTransport: VaultTransport
}

export interface IntentHandler {
  name: IntentName
  /** Returns the reply text to send back to the owner. */
  handle(params: unknown, ctx: BotContext): Promise<string>
}
