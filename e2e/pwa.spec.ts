import { test, expect } from '@playwright/test'

/**
 * Tier 1 — Playwright PWA emulation tests.
 *
 * All tests run against the production build served by Vite preview at
 * http://localhost:4173. The webServer in playwright.config.ts builds + starts
 * the server before the suite runs.
 *
 * Legacy tests (1–4) pass ?noseed so they always start with an empty DB and
 * do not depend on seed data being present or absent (ADR-0006 test hook).
 *
 * Selectors are derived from the actual markup:
 *   - Add-task input: aria-label "Capture task" (CaptureSheet.tsx) — inside the + sheet
 *   - Tab bar: aria-label "Main navigation" (TabBar.tsx); tab buttons have aria-label per tab
 *   - Task title text: rendered as <span> containing task.title (TaskItem.tsx)
 *   - App heading: <h1> "Tasks" (App.tsx)
 */

// ---------------------------------------------------------------------------
// 1. Service worker controls the page
// ---------------------------------------------------------------------------
test('service worker controls the page after reload', async ({ page }) => {
  await page.goto('/?noseed')

  // Wait for SW to be registered and active
  await page.evaluate(() => navigator.serviceWorker.ready)

  // Reload so the SW can claim/intercept the page
  await page.reload()

  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller)
  expect(controlled).toBe(true)
})

// ---------------------------------------------------------------------------
// 2. Manifest linked + valid
// ---------------------------------------------------------------------------
test('manifest is linked and contains required PWA fields', async ({ page }) => {
  await page.goto('/?noseed')

  // Assert the <link rel="manifest"> exists and has an href
  const manifestHref = await page.evaluate(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    return link?.href ?? null
  })
  expect(manifestHref).not.toBeNull()

  // Fetch the manifest and inspect its contents
  const response = await page.request.get(manifestHref!)
  expect(response.ok()).toBe(true)

  const manifest = await response.json()

  expect(manifest.name).toBeTruthy()
  expect(manifest.start_url).toBeTruthy()
  expect(manifest.display).toBe('standalone')

  const icons: Array<{ sizes: string }> = manifest.icons ?? []
  const has192 = icons.some((icon) => icon.sizes?.includes('192'))
  const has512 = icons.some((icon) => icon.sizes?.includes('512'))
  expect(has192).toBe(true)
  expect(has512).toBe(true)
})

// ---------------------------------------------------------------------------
// 3. Offline app shell
// ---------------------------------------------------------------------------
test('app shell renders offline after SW caches it', async ({ page, context }) => {
  // Load the page online so the SW can cache the shell
  await page.goto('/?noseed')
  await page.evaluate(() => navigator.serviceWorker.ready)

  // Confirm the UI loaded correctly first
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()

  // Confirm the tab bar is rendered
  await expect(page.getByTestId('tab-bar')).toBeVisible()

  // Go offline and reload — SW should serve the cached shell
  await context.setOffline(true)
  await page.reload()

  // The <h1>Tasks</h1> heading must still be visible, not a browser error page
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()

  // Tab bar must also survive offline
  await expect(page.getByTestId('tab-bar')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 4. Offline persistence (IndexedDB survives offline cold reload)
// ---------------------------------------------------------------------------
test('tasks added online persist after going offline and reloading', async ({ page, context }) => {
  // --- Online: add a task via the + tab ---
  await page.goto('/?noseed')
  await page.evaluate(() => navigator.serviceWorker.ready)

  // S7: tasks are added via the + tab which opens a bottom sheet
  await page.getByRole('button', { name: 'Add task' }).click()

  const input = page.getByLabel('Capture task')
  await input.fill('emu-test')
  await input.press('Enter')

  // Sheet closes and task is visible in the Now view (default tab)
  await expect(page.getByText('emu-test')).toBeVisible()

  // --- Go offline and cold-reload ---
  await context.setOffline(true)
  await page.reload()

  // App shell must render
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()

  // Task data from IndexedDB must still be listed
  await expect(page.getByText('emu-test')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 5. Domains tab shows warmth tiles (Slice S9, replaces grouped task list)
// ---------------------------------------------------------------------------
test('Domains tab renders one warmth tile per domain after seed import', async ({ page }) => {
  // Load WITHOUT ?noseed so seedIfEmpty fires on an empty DB
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)

  // S7: navigate to the Domains tab via the tab bar.
  await page.getByRole('button', { name: 'Domains' }).click()

  // S9: the Domains tab now shows DomainsMap — 7 warmth tiles, one per domain.
  // Wait for tiles to appear (seed data may still be loading).
  await expect(page.locator('[data-testid="domain-tile"]').first()).toBeVisible({ timeout: 10000 })

  // Exactly 7 tiles — one per canonical domain.
  await expect(page.locator('[data-testid="domain-tile"]')).toHaveCount(7)

  // The "Building Things" tile must be present (first domain in DOMAINS order).
  await expect(
    page.locator('[data-testid="domain-tile"][data-domain="Building Things"]'),
  ).toBeVisible()
})
