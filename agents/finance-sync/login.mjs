/**
 * login.mjs — interactive Kite Connect login helper for finance-sync (S42).
 *
 * Kite Connect access tokens expire daily and can only be minted via an
 * interactive browser login (no headless/refresh-token flow) — this is why
 * finance-sync runs on the owner's PC, never GitHub Actions (see
 * docs/agents/afk-pipeline.md's agent-placement rule). Run this once per day
 * before `sync.mjs`:
 *
 *   1. Opens the Kite login URL in the default browser.
 *   2. Owner logs in; Kite redirects to a local redirect URL carrying a
 *      `request_token` query param, caught by a short-lived local HTTP
 *      server on `KITE_REDIRECT_PORT` (default 3838).
 *   3. Exchanges the request token for an access token (checksum'd POST to
 *      Kite's session API).
 *   4. Writes the access token to a JSON file in the OS user-config dir
 *      (`%APPDATA%/lifeos/kite-token.json` on Windows, `~/.config/lifeos/
 *      kite-token.json` elsewhere) — NEVER into the repo/vault. `sync.mjs`
 *      reads it from there (or from `KITE_ACCESS_TOKEN` env, e.g. when a
 *      wrapper script exports it after reading the same file).
 *
 * The network/browser/server pieces are impure and injectable so the pure
 * checksum + URL-building logic is unit-testable with zero network — see
 * `computeChecksum`/`buildLoginURL` exercised from sync.test.mjs.
 */

import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { exec } from 'node:child_process'

const KITE_LOGIN_BASE = 'https://kite.zerodha.com/connect/login'
const KITE_SESSION_URL = 'https://api.kite.trade/session/token'

/** Where the access token lives — OS user-config dir, never the repo. */
export function tokenFilePath() {
  const base =
    platform() === 'win32'
      ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      : join(homedir(), '.config')
  return join(base, 'lifeos', 'kite-token.json')
}

/** Build the Kite Connect login URL for a given API key. Pure. */
export function buildLoginURL(apiKey) {
  if (!apiKey) throw new Error('buildLoginURL: apiKey is required')
  return `${KITE_LOGIN_BASE}?v=3&api_key=${encodeURIComponent(apiKey)}`
}

/**
 * Kite's session-exchange checksum: sha256(api_key + request_token +
 * api_secret), hex digest. Pure.
 */
export function computeChecksum(apiKey, requestToken, apiSecret) {
  if (!apiKey || !requestToken || !apiSecret) {
    throw new Error('computeChecksum: apiKey, requestToken, and apiSecret are all required')
  }
  return createHash('sha256').update(apiKey + requestToken + apiSecret).digest('hex')
}

/** Exchange a request token for an access token. Impure (network); `fetchImpl`
 * injectable. */
export async function exchangeRequestToken({ apiKey, apiSecret, requestToken, fetchImpl = fetch }) {
  const checksum = computeChecksum(apiKey, requestToken, apiSecret)
  const body = new URLSearchParams({
    api_key: apiKey,
    request_token: requestToken,
    checksum,
  })
  const res = await fetchImpl(KITE_SESSION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`exchangeRequestToken: session endpoint returned ${res.status}: ${text}`)
  }
  const json = await res.json()
  if (!json?.data?.access_token) {
    throw new Error('exchangeRequestToken: response missing data.access_token')
  }
  return json.data.access_token
}

/** Persist the access token to the user-local token file (mode 0600 on
 * POSIX; Windows ACLs are left to the OS default for the user profile). */
export async function saveAccessToken(accessToken, { path = tokenFilePath(), writeFileImpl = writeFile, mkdirImpl = mkdir } = {}) {
  await mkdirImpl(join(path, '..'), { recursive: true })
  await writeFileImpl(path, JSON.stringify({ access_token: accessToken, saved_at: new Date().toISOString() }, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  })
  return path
}

/**
 * Wait for Kite's redirect to hit a local server and resolve with the
 * `request_token` query param. Impure (opens a real socket); `createServerImpl`
 * injectable for tests. Server closes itself after the first hit.
 */
function waitForRequestToken(port, { createServerImpl = createServer } = {}) {
  return new Promise((resolve, reject) => {
    const server = createServerImpl((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`)
      const token = url.searchParams.get('request_token')
      const status = url.searchParams.get('status')
      res.end(
        token
          ? 'Kite login captured — you can close this tab and return to the terminal.'
          : 'Kite login failed — no request_token in redirect. Close this tab and retry.',
      )
      server.close()
      if (token && status !== 'error') resolve(token)
      else reject(new Error('waitForRequestToken: redirect did not carry a usable request_token'))
    })
    server.on('error', reject)
    server.listen(port)
  })
}

/** Best-effort open of the default browser (Windows/macOS/Linux). Impure;
 * failures are non-fatal — the URL is always printed as a fallback. */
function openBrowser(url) {
  const cmd =
    platform() === 'win32'
      ? `start "" "${url}"`
      : platform() === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`
  exec(cmd, () => {})
}

/**
 * Full interactive login: build URL -> open browser -> capture redirect ->
 * exchange -> save token file. Prints progress to stdout since this is a
 * manual, human-attended CLI step (not a scheduled agent).
 */
export async function login({
  apiKey = process.env.KITE_API_KEY,
  apiSecret = process.env.KITE_API_SECRET,
  port = Number(process.env.KITE_REDIRECT_PORT) || 3838,
  fetchImpl = fetch,
} = {}) {
  if (!apiKey || !apiSecret) {
    throw new Error('login: KITE_API_KEY and KITE_API_SECRET env vars are both required')
  }
  const url = buildLoginURL(apiKey)
  console.log(`finance-sync login: open this URL if your browser doesn't launch automatically:\n${url}`)
  openBrowser(url)

  console.log(`finance-sync login: waiting for the Kite redirect on http://localhost:${port} ...`)
  const requestToken = await waitForRequestToken(port)

  console.log('finance-sync login: exchanging request token for access token ...')
  const accessToken = await exchangeRequestToken({ apiKey, apiSecret, requestToken, fetchImpl })

  const path = await saveAccessToken(accessToken)
  console.log(`finance-sync login: access token saved to ${path}`)
  return { accessToken, path }
}

// Run directly when invoked as a script (`node agents/finance-sync/login.mjs`).
if (import.meta.url === `file://${process.argv[1]}`) {
  login().catch((err) => {
    console.error('finance-sync login: failed:', err)
    process.exit(1)
  })
}
