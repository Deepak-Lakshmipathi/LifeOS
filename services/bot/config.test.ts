import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'

describe('loadConfig', () => {
  it('returns a config object when all required vars are set', () => {
    const env = {
      TELEGRAM_BOT_TOKEN: 'tg-token',
      BOT_VAULT_PAT: 'pat-value',
      BOT_VAULT_REPO_URL: 'https://github.com/example/vault.git',
      ANTHROPIC_API_KEY: 'sk-ant-value',
      OWNER_TELEGRAM_CHAT_ID: '12345',
    }

    expect(loadConfig(env)).toEqual({
      telegramBotToken: 'tg-token',
      botVaultPat: 'pat-value',
      botVaultRepoUrl: 'https://github.com/example/vault.git',
      anthropicApiKey: 'sk-ant-value',
      ownerTelegramChatId: '12345',
      botVaultCloneDir: '.vault-clone',
    })
  })

  it('uses BOT_VAULT_CLONE_DIR when explicitly set, overriding the default', () => {
    const env = {
      TELEGRAM_BOT_TOKEN: 'tg-token',
      BOT_VAULT_PAT: 'pat-value',
      BOT_VAULT_REPO_URL: 'https://github.com/example/vault.git',
      ANTHROPIC_API_KEY: 'sk-ant-value',
      OWNER_TELEGRAM_CHAT_ID: '12345',
      BOT_VAULT_CLONE_DIR: '/tmp/custom-clone',
    }

    expect(loadConfig(env).botVaultCloneDir).toBe('/tmp/custom-clone')
  })

  it('throws naming every missing var when some are unset', () => {
    const env = {
      TELEGRAM_BOT_TOKEN: 'tg-token',
      // BOT_VAULT_PAT missing
      // BOT_VAULT_REPO_URL missing
      ANTHROPIC_API_KEY: '',
      // OWNER_TELEGRAM_CHAT_ID missing
    }

    expect(() => loadConfig(env)).toThrowError(
      /Missing required env var\(s\): BOT_VAULT_PAT, BOT_VAULT_REPO_URL, ANTHROPIC_API_KEY, OWNER_TELEGRAM_CHAT_ID/,
    )
  })

  it('throws when all required vars are unset', () => {
    expect(() => loadConfig({})).toThrowError(/Missing required env var/)
  })

  it('never includes actual secret values in the thrown error message', () => {
    const env = { TELEGRAM_BOT_TOKEN: 'super-secret-token-value' }
    try {
      loadConfig(env)
      expect.unreachable('loadConfig should have thrown')
    } catch (err) {
      expect(String(err)).not.toContain('super-secret-token-value')
    }
  })
})
