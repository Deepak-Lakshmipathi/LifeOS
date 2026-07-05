/**
 * config — env-only secret loading for the bot (S16b, ADR-0011 Decision 2;
 * repo URL + clone dir added S16c for the real Node git transport).
 *
 * All bot secrets load from process.env at boot and are never logged.
 * `.env` is gitignored; `.env.example` documents the required shape.
 */

export interface BotConfig {
  /** Telegram Bot API token (from BotFather). */
  telegramBotToken: string
  /** Fine-grained GitHub PAT scoped to the vault repo — separate from the PWA's VITE_VAULT_PAT. */
  botVaultPat: string
  /** Vault repo remote URL — same repo the PWA's VITE_VAULT_REPO_URL points at. */
  botVaultRepoUrl: string
  /** Anthropic API key for Claude NLU. */
  anthropicApiKey: string
  /** Groq API key for Whisper voice-note transcription (S18, ADR-0014 Decision 1). */
  groqApiKey: string
  /** The single Telegram chat id the bot serves; every other chat id is ignored. */
  ownerTelegramChatId: string
  /**
   * Local working-copy directory the Node git transport clones into and
   * reuses across messages (ADR-0011 Decision 1 — stays warm, not
   * re-cloned per message). Optional; defaults to `.vault-clone` under the
   * bot's own directory.
   */
  botVaultCloneDir: string
}

const REQUIRED_VARS = [
  'TELEGRAM_BOT_TOKEN',
  'BOT_VAULT_PAT',
  'BOT_VAULT_REPO_URL',
  'ANTHROPIC_API_KEY',
  'GROQ_API_KEY',
  'OWNER_TELEGRAM_CHAT_ID',
] as const

const DEFAULT_VAULT_CLONE_DIR = '.vault-clone'

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
    botVaultRepoUrl: env.BOT_VAULT_REPO_URL!,
    anthropicApiKey: env.ANTHROPIC_API_KEY!,
    groqApiKey: env.GROQ_API_KEY!,
    ownerTelegramChatId: env.OWNER_TELEGRAM_CHAT_ID!,
    botVaultCloneDir: env.BOT_VAULT_CLONE_DIR || DEFAULT_VAULT_CLONE_DIR,
  }
}
