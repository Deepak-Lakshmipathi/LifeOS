/**
 * intents/types — shared shapes for the intent-router seam (S16b, ADR-0011
 * Decision 4). Written once in this ticket; not touched again by S18-S19 —
 * each future intent slice's only shared touchpoint is one new import line
 * in intents/index.ts. Widened additively for 'update'/'delete' + chatId
 * (S17, ADR-0013 Decision 4).
 */

import type { VaultTransport } from '../../../src/vault/transport'

/** Grows: 'voice' (S18), 'photo' (S19). */
export type IntentName = 'create' | 'update' | 'delete'

/** Per-message context every intent handler needs. */
export interface BotContext {
  vaultTransport: VaultTransport
  /** Telegram chat id — S17: destructive handlers need it to register a pending confirmation. */
  chatId: string
}

export interface IntentHandler {
  name: IntentName
  /** Returns the reply text to send back to the owner. */
  handle(params: unknown, ctx: BotContext): Promise<string>
}
