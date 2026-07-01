/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to '1' to enable VaultSync instead of LocalOnly. */
  readonly VITE_VAULT?: string
  /** Git remote URL for the Obsidian vault repo (required when VITE_VAULT=1). */
  readonly VITE_VAULT_REPO_URL?: string
  /** CORS proxy URL for isomorphic-git (optional). */
  readonly VITE_VAULT_CORS_PROXY?: string
  /** Read-only fine-grained PAT — never logged or surfaced in the UI. */
  readonly VITE_VAULT_PAT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
