import { defineConfig } from 'vitest/config'

// Bot's own Vitest config (S16b) — separate from the root PWA's vite.config.ts.
// Node environment (not jsdom): this is a server-side long-poll worker, not
// browser code. Runs standalone via `cd services/bot && npm install && npm test`.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
})
