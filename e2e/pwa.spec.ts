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
 *   - Add-task input: aria-label "New task title" (AddTaskInput.tsx)
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

  // Go offline and reload — SW should serve the cached shell
  await context.setOffline(true)
  await page.reload()

  // The <h1>Tasks</h1> heading must still be visible, not a browser error page
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()
})

// ---------------------------------------------------------------------------
// 4. Offline persistence (IndexedDB survives offline cold reload)
// ---------------------------------------------------------------------------
test('tasks added online persist after going offline and reloading', async ({ page, context }) => {
  // --- Online: add a task ---
  await page.goto('/?noseed')
  await page.evaluate(() => navigator.serviceWorker.ready)

  const input = page.getByLabel('New task title')
  await input.fill('emu-test')
  await input.press('Enter')

  // Confirm the task is visible in the list
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
// 5. Seeded Domain → Project grouping (Slice S5)
// ---------------------------------------------------------------------------
test('seed import runs on empty DB and renders Domain → Project grouping', async ({ page }) => {
  // Load WITHOUT ?noseed so seedIfEmpty fires on an empty DB
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)

  // S6: the default view is the flat NOW list; the nested Domain → Project
  // grouping lives under the "All" view. Switch to it before asserting.
  await page.getByRole('button', { name: 'All' }).click()

  // Wait for the seeded tasks to render — domain headers use data-testid="domain-header".
  // "Building Things" is the first domain in DOMAINS order and must appear as a visible header.
  await expect(
    page.locator('[data-testid="domain-header"]').filter({ hasText: 'Building Things' }),
  ).toBeVisible({ timeout: 10000 })

  // A seeded task title proves that the Startup project was imported correctly.
  await expect(page.getByText('Finalize company structure (OPC vs Pvt Ltd)')).toBeVisible()
})
