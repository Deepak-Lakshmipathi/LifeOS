/**
 * Tier 2 — PWA installability audit
 *
 * Builds the production bundle, serves dist/ on a local port, then uses
 * Playwright's Chromium (already installed for Tier 1) to run headless Chrome
 * and verify both installability signals:
 *
 *   1. installable-manifest — manifest linked, name present, start_url present,
 *      display is "standalone", icons include both 192 and 512 sizes, and the
 *      icons actually load (HTTP 200).
 *   2. service-worker — SW registered, active, and controls the page after one
 *      reload.
 *
 * This approach works with the current tool chain without requiring a legacy
 * Lighthouse version, since Lighthouse v10+ dropped the PWA category.
 *
 * Exit 0 → both checks pass.
 * Exit 1 → at least one check failed (see summary).
 */

import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')
const PORT = 4174 // different port from Vite preview (4173)

// ---------------------------------------------------------------------------
// 1. Build
// ---------------------------------------------------------------------------
console.log('[lh-pwa] Building production bundle…')
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' })
console.log('[lh-pwa] Build complete.\n')

// ---------------------------------------------------------------------------
// 2. Serve dist/ with a minimal static file server
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
}

const server = createServer((req, res) => {
  let urlPath = req.url.split('?')[0]
  if (urlPath === '/') urlPath = '/index.html'
  const filePath = join(DIST, urlPath)

  if (existsSync(filePath)) {
    const ext = extname(filePath)
    const mime = MIME[ext] ?? 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': mime })
    res.end(readFileSync(filePath))
  } else {
    // SPA fallback — serve index.html
    const index = join(DIST, 'index.html')
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(readFileSync(index))
  }
})

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve))
const BASE_URL = `http://127.0.0.1:${PORT}`
console.log(`[lh-pwa] Static server running at ${BASE_URL}\n`)

// ---------------------------------------------------------------------------
// 3. Audit with Playwright / Chromium
// ---------------------------------------------------------------------------
const results = []
let browser

try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(BASE_URL, { waitUntil: 'networkidle' })

  // --- Audit 1: installable-manifest ---
  const manifestCheck = await page.evaluate(async (baseUrl) => {
    const link = document.querySelector('link[rel="manifest"]')
    if (!link) return { pass: false, reason: 'No <link rel="manifest"> found' }

    const href = link.href
    let manifest
    try {
      const res = await fetch(href)
      if (!res.ok) return { pass: false, reason: `Manifest fetch failed: HTTP ${res.status}` }
      manifest = await res.json()
    } catch (e) {
      return { pass: false, reason: `Manifest fetch error: ${e.message}` }
    }

    if (!manifest.name) return { pass: false, reason: 'manifest.name missing' }
    if (!manifest.start_url) return { pass: false, reason: 'manifest.start_url missing' }
    if (manifest.display !== 'standalone') {
      return { pass: false, reason: `manifest.display is "${manifest.display}", expected "standalone"` }
    }

    const icons = manifest.icons ?? []
    const has192 = icons.some((i) => (i.sizes ?? '').includes('192'))
    const has512 = icons.some((i) => (i.sizes ?? '').includes('512'))
    if (!has192) return { pass: false, reason: 'No 192×192 icon in manifest' }
    if (!has512) return { pass: false, reason: 'No 512×512 icon in manifest' }

    // Verify icons actually load
    for (const icon of icons) {
      const iconUrl = new URL(icon.src, baseUrl).href
      try {
        const r = await fetch(iconUrl)
        if (!r.ok) return { pass: false, reason: `Icon not loadable: ${iconUrl} (HTTP ${r.status})` }
      } catch (e) {
        return { pass: false, reason: `Icon fetch error: ${iconUrl} — ${e.message}` }
      }
    }

    return { pass: true, reason: `name="${manifest.name}", start_url="${manifest.start_url}", display="${manifest.display}", icons OK` }
  }, BASE_URL)

  results.push({ id: 'installable-manifest', ...manifestCheck })

  // --- Audit 2: service-worker ---
  const swCheck = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      return { pass: false, reason: 'navigator.serviceWorker not available' }
    }
    try {
      const reg = await navigator.serviceWorker.ready
      if (!reg.active) return { pass: false, reason: 'SW registration has no active worker' }
    } catch (e) {
      return { pass: false, reason: `navigator.serviceWorker.ready rejected: ${e.message}` }
    }
    return { pass: true, reason: 'SW registered and active' }
  })

  // Reload to confirm the SW controls the page
  if (swCheck.pass) {
    await page.reload({ waitUntil: 'networkidle' })
    const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller)
    if (!controlled) {
      results.push({
        id: 'service-worker',
        pass: false,
        reason: 'SW registered but does not control the page after reload',
      })
    } else {
      results.push({ id: 'service-worker', pass: true, reason: 'SW registered, active, and controls page' })
    }
  } else {
    results.push({ id: 'service-worker', ...swCheck })
  }
} finally {
  if (browser) await browser.close()
  server.close()
}

// ---------------------------------------------------------------------------
// 4. Report
// ---------------------------------------------------------------------------
console.log('[lh-pwa] --- PWA Installability Audit Results ---')
let exitCode = 0
for (const r of results) {
  const status = r.pass ? 'PASS' : 'FAIL'
  console.log(`  ${r.id}: ${status}${r.reason ? ' — ' + r.reason : ''}`)
  if (!r.pass) exitCode = 1
}
console.log('[lh-pwa] ------------------------------------------------\n')

if (exitCode === 0) {
  console.log('[lh-pwa] All PWA installability audits PASSED.')
} else {
  console.error('[lh-pwa] One or more PWA installability audits FAILED.')
}

process.exit(exitCode)
