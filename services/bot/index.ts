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
import { createTranscriber } from './transcription'
import { NodeVaultTransport } from './vaultTransport'
import { handleIncomingMessage } from './router'
import { logBotAction, logHeartbeat } from './runLog'

const BOT_DIR = path.dirname(fileURLToPath(import.meta.url))

/** Heartbeat cadence (ms): status.json refresh so an idle-but-alive bot reads healthy. */
const HEARTBEAT_MS = 15 * 60 * 1000

function main(): void {
  const config = loadConfig()

  const telegramClient = new RealTelegramClient(config.telegramBotToken)
  const claudeClient = createClaudeClient(config.anthropicApiKey)
  const transcriber = createTranscriber(config.groqApiKey)
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
      transcriber,
      ownerChatId: config.ownerTelegramChatId,
      // S51: each handled action logs a run (fire-and-forget; runLog swallows
      // its own errors so a vault-write failure never breaks handling).
      onAction: (info) => {
        void logBotAction(vaultTransport, info)
      },
    }).catch((err: unknown) => {
      console.error('Failed to handle message:', err instanceof Error ? err.message : err)
    })
  })

  // S51 heartbeat: the bot is always-on, so an absence of actions is NOT a
  // failure — refresh status.json every 15min so the health board reads it as
  // alive. unref'd so it never keeps the process up on its own.
  const heartbeat = setInterval(() => {
    void logHeartbeat(vaultTransport)
  }, HEARTBEAT_MS)
  heartbeat.unref()

  console.log('LifeOS bot worker started (long-poll).')
}

main()
