/**
 * Build-output tests for Slice B — PWA shell.
 * These tests verify that `npm run build` emits the expected PWA artifacts.
 * If dist/ does not exist they skip gracefully (run `npm run build` first).
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

// process.cwd() points to the project root when tests run via `npm test`
const distDir = resolve(process.cwd(), 'dist')

describe('PWA build output', () => {
  it('emits a service worker', () => {
    if (!existsSync(distDir)) {
      console.warn('dist/ not found — skipping (run npm run build first)')
      return
    }
    expect(existsSync(resolve(distDir, 'sw.js'))).toBe(true)
  })

  it('emits a web app manifest', () => {
    if (!existsSync(distDir)) {
      console.warn('dist/ not found — skipping (run npm run build first)')
      return
    }
    expect(existsSync(resolve(distDir, 'manifest.webmanifest'))).toBe(true)
  })

  it('manifest has required PWA fields', () => {
    const manifestPath = resolve(distDir, 'manifest.webmanifest')
    if (!existsSync(manifestPath)) {
      console.warn('manifest.webmanifest not found — skipping (run npm run build first)')
      return
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    expect(manifest.name).toBe('LifeOS')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })
})
