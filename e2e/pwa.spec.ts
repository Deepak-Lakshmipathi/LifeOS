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
 *   - Tab bar: data-testid "tab-bar" (TabBar.tsx); tab buttons are labeled per tab
 *   - Task title text: rendered as <span> containing task.title (TaskItem.tsx)
 *   - Shell-loaded signal: the tab bar (data-testid "tab-bar"). S24 replaced the
 *     v1 <h1>Tasks</h1> with the cockpit header, so the tab bar is now the stable
 *     "app rendered, not an error page" anchor.
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

  // Confirm the UI loaded correctly first (tab bar = shell-rendered signal)
  await expect(page.getByTestId('tab-bar')).toBeVisible()

  // Go offline and reload — SW should serve the cached shell
  await context.setOffline(true)
  await page.reload()

  // The shell must still render (tab bar visible), not a browser error page
  await expect(page.getByTestId('tab-bar')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 4. Offline persistence (IndexedDB survives offline cold reload)
// ---------------------------------------------------------------------------
test('tasks added online persist after going offline and reloading', async ({ page, context }) => {
  // --- Online: add a task from the Tasks tab ---
  await page.goto('/?noseed')
  await page.evaluate(() => navigator.serviceWorker.ready)

  // Capture opens a bottom sheet. #183 moved that affordance off Home (the
  // check-in surface) onto the Tasks tab, so navigate there first — Home no
  // longer has an "Add task" button at all.
  await page.getByTestId('tab-bar').getByText('Tasks').click()
  await page.getByRole('button', { name: 'Add task' }).click()

  const input = page.getByLabel('Capture task')
  await input.fill('emu-test')
  await input.press('Enter')

  // Sheet closes and the task is visible in NowView on the Tasks tab.
  await expect(page.getByText('emu-test')).toBeVisible()

  // --- Go offline and cold-reload ---
  await context.setOffline(true)
  await page.reload()

  // App shell must render (tab bar = shell-rendered signal)
  await expect(page.getByTestId('tab-bar')).toBeVisible()

  // Task data from IndexedDB must still be listed. The reload lands on Home
  // (the default tab), where the task shows in MissionCard's picks — this
  // assertion read Home before #183 too, so the surface under test here is
  // unchanged by that move.
  await expect(page.getByText('emu-test')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 5. Domains sub-nav (inside Tasks tab) shows warmth tiles (Slice S9, replaces
//    grouped task list; S58 re-parented Domains from a top-level tab into
//    Tasks's Segmented sub-nav — see docs/slices/slice-S58-tasks-tab.md)
// ---------------------------------------------------------------------------
test('Domains sub-nav renders one warmth tile per domain after seed import', async ({ page }) => {
  // Load WITHOUT ?noseed so seedIfEmpty fires on an empty DB
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)

  // S58: navigate to the Tasks tab, then the Domains segment of its sub-nav.
  await page.getByRole('button', { name: 'Tasks' }).click()
  await page.getByRole('tab', { name: 'Domains' }).click()

  // S9: the Domains segment shows DomainsMap — 7 warmth tiles, one per domain.
  // Wait for tiles to appear (seed data may still be loading).
  await expect(page.locator('[data-testid="domain-tile"]').first()).toBeVisible({ timeout: 10000 })

  // Exactly 7 tiles — one per canonical domain.
  await expect(page.locator('[data-testid="domain-tile"]')).toHaveCount(7)

  // The "Building Things" tile must be present (first domain in DOMAINS order).
  await expect(
    page.locator('[data-testid="domain-tile"][data-domain="Building Things"]'),
  ).toBeVisible()
})

// ---------------------------------------------------------------------------
// 5b. Domains sub-nav does not trap main-nav navigation (Slice S63, closes
//     #173). Acceptance evidence that a real browser is fixed — NOT the DoD
//     anchor for the bug. This red is real but incidental: it depends on seed
//     size, seed timing and self-loader latency, none of which are stated
//     invariants, so any of them shifting would turn it green with the defect
//     still present. The invariant itself is pinned deterministically in
//     src/test/shellNavigation.test.tsx (Test A).
//
//     Uses the seeded `/` + `serviceWorker.ready` idiom of case 5 above: the
//     107-row seed is exactly what made #173 reproduce.
// ---------------------------------------------------------------------------
test.describe('S63 — nav exit trap', () => {
  // Pinned, not merely inherited. Headless Chromium was measured reporting
  // `prefers-reduced-motion: no-preference` (Chrome 149, Desktop Chrome), so
  // this is today's default — but it is an unpinned dependency on Playwright's
  // device profile, the Chromium build and runner OS settings. This whole bug
  // class exists ONLY on the motion branch (TAB_STATIC has never declared a
  // leaving state), so a silent flip to `reduce` would convert this into a
  // permanently-green vacuous test, undetectably. One line removes the class.
  test.use({ reducedMotion: 'no-preference' })

  test('leaving the Domains sub-tab for a main tab unmounts it completely', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)

    const tiles = page.locator('[data-testid="domain-tile"]')

    // Get into the trapping state: Tasks → Domains, with the seed loaded.
    await page.getByRole('button', { name: 'Tasks' }).click()
    await page.getByRole('tab', { name: 'Domains' }).click()
    await expect(tiles.first()).toBeVisible({ timeout: 10000 })
    await expect(tiles).toHaveCount(7)

    // Navigate to a main tab. Pre-S63 the nav pill moved and `aria-current`
    // followed, but the incoming panel never mounted.
    await page.getByRole('button', { name: 'Home' }).click()
    await expect(page.getByRole('button', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // 1. The outgoing panel is gone from the DOM — not merely faded out.
    await expect(tiles).toHaveCount(0)

    // 2. And nothing invisible-but-clickable is left behind. #173 was not a
    //    cosmetic blank: the stale panel sat at `opacity: 0` and
    //    `document.elementFromPoint()` still resolved into the domain tiles.
    //    Real hit-testing is the whole point of asserting this in Chromium —
    //    jsdom has none and would hand back a vacuous pass.
    const hit = await page.evaluate(() => {
      const main = document.querySelector('main')
      if (!main) return { probed: false, reason: 'no <main>', insideTile: null }
      const box = main.getBoundingClientRect()
      // Clamp the probe to main's visible slice: elementFromPoint takes
      // VIEWPORT coordinates, and main's true centre can sit below the fold on
      // a seeded Home, where it would return null and pass vacuously.
      const top = Math.max(box.top, 0)
      const bottom = Math.min(box.bottom, window.innerHeight)
      const left = Math.max(box.left, 0)
      const right = Math.min(box.right, window.innerWidth)
      if (bottom <= top || right <= left) {
        return { probed: false, reason: 'main not in viewport', insideTile: null }
      }
      const el = document.elementFromPoint((left + right) / 2, (top + bottom) / 2)
      if (!el) return { probed: false, reason: 'elementFromPoint returned null', insideTile: null }
      return {
        probed: true,
        reason: '',
        insideTile: el.closest('[data-testid="domain-tile"]') !== null,
      }
    })
    // The probe must have actually landed on something, or the check below
    // asserts nothing at all.
    expect(hit.probed, `hit-test probe did not run: ${hit.reason}`).toBe(true)
    expect(hit.insideTile).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 6. Tab bar fits every width without clipping (Slice S59, DoD 1) — the real
//    computed-layout check. TabBar.test.tsx guards the same property with a
//    box model in jsdom (which has no layout engine and drops clamp() from its
//    CSSOM); this measures the actual rendered pill in Chromium.
// ---------------------------------------------------------------------------
test('tab bar fits every width without clipping', async ({ page }) => {
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/?noseed')

    const bar = page.getByTestId('tab-bar')
    await expect(bar).toBeVisible()

    // The pill never scrolls internally...
    expect(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    // ...and never pushes the page into a horizontal scroll.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true)

    // Same five words at every width — no abbreviation, no icon fallback (DoD 4).
    await expect(bar.getByRole('button')).toHaveText([
      'Home',
      'Tasks',
      'Money',
      'Career',
      'Agents',
    ])
  }
})
