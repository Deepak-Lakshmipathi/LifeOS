import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Base path. GitHub Pages serves at /<repo>/ — set VITE_BASE=/LifeOS/ in the
// Pages build. Defaults to '/' for local dev and custom-domain hosting.
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'LifeOS',
        short_name: 'LifeOS',
        description: 'A personal life tracker — local-first, offline-capable.',
        theme_color: '#6366f1',
        background_color: '#0f0f23',
        display: 'standalone',
        // Relative so they resolve under `base` (both '/' and '/LifeOS/').
        start_url: '.',
        scope: base,
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // services/** is excluded: services/bot (S16b) is its own standalone
    // Node/TS project with its own vitest config, deps, and test runner —
    // not part of the Vite/React PWA this config builds.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'services/**'],
  },
})
