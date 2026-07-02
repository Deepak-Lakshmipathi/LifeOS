/**
 * router — owner guard + Claude NLU + intent dispatch (S16b, ADR-0011).
 *
 * `dispatchIntent` is the generic seam described in ADR-0011 Decision 4:
 * getIntentHandler(name)?.handle(params, ctx) ?? "not yet supported". It
 * accepts any classified intent name — Claude's own "other", or a future
 * name (e.g. "update") that has no registered handler yet — and never
 * touches the vault when no handler is found.
 *
 * `handleIncomingMessage` is the full per-message pipeline: the owner guard
 * runs first and is a complete no-op for any other chat id (no Claude call,
 * no vault write, no reply) — only then does it call Claude and dispatch.
 */

import './intents/index' // side effect: registers every shipped intent handler
import { getIntentHandler } from './intents/registry'
import type { BotContext } from './intents/types'
import { classifyAndExtract, type ClaudeClient } from './nlu'
import type { TelegramClient, TelegramMessage } from './telegramClient'
import type { VaultTransport } from '../../src/vault/transport'

export const NOT_YET_SUPPORTED = 'not yet supported'

export interface RouterDeps {
  claudeClient: ClaudeClient
  telegramClient: TelegramClient
  vaultTransport: VaultTransport
  ownerChatId: string
}

/** Dispatches a classified intent name to its registered handler, or the fallback reply. */
export async function dispatchIntent(name: string, params: unknown, ctx: BotContext): Promise<string> {
  const handler = getIntentHandler(name)
  if (!handler) return NOT_YET_SUPPORTED
  return handler.handle(params, ctx)
}

/**
 * Owner-guard + Claude NLU + dispatch + reply pipeline for one incoming
 * Telegram message. A message from any chat id other than deps.ownerChatId
 * is a complete no-op (PRD "Owner guard").
 */
export async function handleIncomingMessage(msg: TelegramMessage, deps: RouterDeps): Promise<void> {
  if (msg.chatId !== deps.ownerChatId) return

  const extracted = await classifyAndExtract(deps.claudeClient, msg.text)
  const ctx: BotContext = { vaultTransport: deps.vaultTransport }

  const reply = await dispatchIntent(extracted.intent, extracted, ctx)
  await deps.telegramClient.sendMessage(msg.chatId, reply)
}
