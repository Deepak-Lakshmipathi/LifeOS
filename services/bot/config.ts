/**
 * config — env-only secret loading for the bot (S16b, ADR-0011 Decision 2).
 *
 * All bot secrets load from process.env at boot and are never logged.
 * `.env` is gitignored; `.env.example` documents the required shape.
 */

export interface BotConfig {
  /** Telegram Bot API token (from BotFather). */
  telegramBotToken: string
  /** Fine-grained GitHub PAT scoped to the vault repo — separate from the PWA's VITE_VAULT_PAT. */
  botVaultPat: string
  /** Anthropic API key for Claude NLU. */
  anthropicApiKey: string
  /** The single Telegram chat id the bot serves; every other chat id is ignored. */
  ownerTelegramChatId: string
}

const REQUIRED_VARS = [
  'TELEGRAM_BOT_TOKEN',
  'BOT_VAULT_PAT',
  'ANTHROPIC_API_KEY',
  'OWNER_TELEGRAM_CHAT_ID',
] as const

/**
 * Load and validate bot config from environment variables.
 * Throws a single error naming every missing variable (never partial —
 * fail loud at boot rather than partway through a message handler).
 *
 * @param env - Defaults to process.env; injectable for tests.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const missing = REQUIRED_VARS.filter((key) => !env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required env var(s): ${missing.join(', ')}`)
  }

  return {
    telegramBotToken: env.TELEGRAM_BOT_TOKEN!,
    botVaultPat: env.BOT_VAULT_PAT!,
    anthropicApiKey: env.ANTHROPIC_API_KEY!,
    ownerTelegramChatId: env.OWNER_TELEGRAM_CHAT_ID!,
  }
}
