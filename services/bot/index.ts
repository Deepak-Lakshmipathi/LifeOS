/**
 * index — long-poll worker entrypoint (S16b, ADR-0011 Decision 1).
 *
 * A long-running Node process, not a serverless webhook — keeps the local
 * git clone warm across messages once S16c wires in the real transport.
 * Not exercised in CI (this is the live-wiring path S16c hand-verifies);
 * `npm start` runs it against real Telegram + real Anthropic + the still-stub
 * NodeVaultTransport.
 */

import { loadConfig } from './config'
import { RealTelegramClient } from './telegramClient'
import { createClaudeClient } from './nlu'
import { NodeVaultTransport } from './vaultTransport'
import { handleIncomingMessage } from './router'

function main(): void {
  const config = loadConfig()

  const telegramClient = new RealTelegramClient(config.telegramBotToken)
  const claudeClient = createClaudeClient(config.anthropicApiKey)
  const vaultTransport = new NodeVaultTransport()

  telegramClient.pollUpdates((msg) => {
    handleIncomingMessage(msg, {
      claudeClient,
      telegramClient,
      vaultTransport,
      ownerChatId: config.ownerTelegramChatId,
    }).catch((err: unknown) => {
      console.error('Failed to handle message:', err instanceof Error ? err.message : err)
    })
  })

  console.log('LifeOS bot worker started (long-poll).')
}

main()
