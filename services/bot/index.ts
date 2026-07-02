/**
 * index — long-poll worker entrypoint (S16b runtime shape, ADR-0011 Decision
 * 1; S16c wires the real Telegram loop + real Node git transport).
 *
 * A long-running Node process, not a serverless webhook — keeps the local
 * git clone warm across messages (NodeVaultTransport clones once at boot
 * into `config.botVaultCloneDir` and reuses that working copy for every
 * subsequent message). Not exercised in CI (no live Telegram token / vault
 * remote / Claude key in CI) — `npm start` runs it against real Telegram +
 * real Anthropic + the real vault repo; see README.md for the owner
 * hand-verify checklist.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config'
import { RealTelegramClient } from './telegramClient'
import { createClaudeClient } from './nlu'
import { NodeVaultTransport } from './vaultTransport'
import { handleIncomingMessage } from './router'

const BOT_DIR = path.dirname(fileURLToPath(import.meta.url))

function main(): void {
  const config = loadConfig()

  const telegramClient = new RealTelegramClient(config.telegramBotToken)
  const claudeClient = createClaudeClient(config.anthropicApiKey)
  const vaultTransport = new NodeVaultTransport({
    repoUrl: config.botVaultRepoUrl,
    pat: config.botVaultPat,
    dir: path.isAbsolute(config.botVaultCloneDir)
      ? config.botVaultCloneDir
      : path.join(BOT_DIR, config.botVaultCloneDir),
  })

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
