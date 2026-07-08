/**
 * Vault PAT resolution (hosted-build safe).
 *
 * The PAT must NOT be baked into a public bundle. So it is read at RUNTIME
 * from localStorage, prompting once on first use. `VITE_VAULT_PAT` remains a
 * dev-only fallback — never set it in the hosted (Pages) build, or Vite will
 * inline it into the shipped JS.
 *
 * Single-user personal tool: a window.prompt is enough (no settings UI yet).
 */
const KEY = 'lifeos_vault_pat'

export function getVaultPat(): string | undefined {
  const stored = localStorage.getItem(KEY)
  if (stored) return stored

  // Dev convenience only. The `import.meta.env.DEV` guard is load-bearing:
  // in a production build it folds to `if (false)` and the minifier strips
  // this whole block — so `VITE_VAULT_PAT` is never inlined into a hosted
  // bundle even if a `.env` is present at build time.
  if (import.meta.env.DEV) {
    const env = import.meta.env.VITE_VAULT_PAT
    if (env) return env
  }

  const entered = window.prompt(
    'Vault access token\n\nPaste your GitHub fine-grained PAT (vault repo, Contents: Read + Write). Stored in this browser only.',
  )
  if (entered && entered.trim()) {
    localStorage.setItem(KEY, entered.trim())
    return entered.trim()
  }
  return undefined
}

/** Clear the stored PAT (e.g. after rotating the token). */
export function clearVaultPat(): void {
  localStorage.removeItem(KEY)
}
