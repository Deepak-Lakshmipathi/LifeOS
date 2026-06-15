# PWA Emulation Testing Protocol

Goal: verify Slice B's PWA acceptance (installable + offline on Windows + Android) **without two physical devices**, by emulation. Replaces most of the manual HITL checklist; only the literal install *gesture* stays human-ish, and Tier 3 emulates even that.

Layered — run cheapest first, stop where confidence is enough.

| Tier | Tool | Emulates | Automatable | CI |
|------|------|----------|-------------|----|
| 0 | Vitest build-output | artifacts emitted (SW + manifest) | yes | yes (exists) |
| 1 | Playwright + Chromium | SW registration, offline reload, IndexedDB persistence, manifest | yes | yes |
| 2 | Lighthouse CLI | "installable" criteria (the install button) | yes | yes |
| 3 | Android emulator (AVD) + adb | real install to home screen + airplane-mode offline | partly | no (local/manual) |

---

## Tier 0 — Build artifacts (have it)
`src/test/pwa-build.test.ts` already asserts `dist/sw.js` + `dist/manifest.webmanifest` exist and the manifest shape. Runs in CI. No change.

## Tier 1 — Playwright Chromium (the workhorse)

Headless Chromium. Serve the production build, drive it, toggle network. Proves everything except the OS install dialog.

### Setup
```
npm i -D @playwright/test
npx playwright install chromium
```
Serve `dist/` for the test (build first): `npm run build && npm run preview -- --port 4173`
(or start it from the Playwright config `webServer`).

### Cases + pass criteria
1. **SW registers.** Load `/`, wait for `navigator.serviceWorker.ready`; assert `navigator.serviceWorker.controller` is non-null after one reload. PASS = controller present.
2. **Manifest linked + valid.** Assert `<link rel="manifest">` resolves; fetch it; assert `name`, `start_url`, `display: "standalone"`, icons include 192 + 512. PASS = all fields present.
3. **Offline app shell.** Load `/` online (let SW cache). `context.setOffline(true)`. Reload. Assert the app heading renders (not the browser offline page). PASS = UI visible offline.
4. **Offline persistence.** Online: add a task ("emu-test"), confirm it lists. `setOffline(true)`, reload. Assert "emu-test" still listed. PASS = IndexedDB survives offline cold start.
5. **No-regression.** Slice A interactions (add/complete/delete) still work in this build.

### Skeleton
```ts
import { test, expect } from '@playwright/test';

test('service worker controls the page', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  expect(controlled).toBe(true);
});

test('app + tasks survive an offline cold reload', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByPlaceholder(/add/i).fill('emu-test');
  await page.keyboard.press('Enter');
  await expect(page.getByText('emu-test')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('emu-test')).toBeVisible(); // SW shell + IndexedDB
});
```
(adjust selectors to the actual Slice A markup)

## Tier 2 — Lighthouse installability

The one thing Playwright doesn't assert cleanly: "is this installable per Chrome's bar." Lighthouse's PWA category does.

```
npm i -D lighthouse
npm run build && npm run preview -- --port 4173 &
npx lighthouse http://localhost:4173 \
  --only-categories=pwa --chrome-flags="--headless" \
  --output=json --output-path=./lh.json
```
PASS = the installability audits (`installable-manifest`, `service-worker`) score 1. Parse `lh.json` in a script; fail the job if either audit < 1.

## Tier 3 — Android emulator (true install + airplane mode)

Only when Tier 1+2 pass and you want the real device behavior without a phone.

### Setup
- Android Studio → AVD Manager → create e.g. `Pixel_7_API_34` (Google Play image, has Chrome).
- Start headless: `emulator -avd Pixel_7_API_34 -no-window -gpu swiftshader_indirect`
- Host dev server reachable from emulator at `http://10.0.2.2:4173` (the AVD's alias for host loopback).

### Steps
1. `npm run build && npm run preview -- --host --port 4173`
2. Open Chrome in the emulator to `http://10.0.2.2:4173`:
   `adb shell am start -a android.intent.action.VIEW -d "http://10.0.2.2:4173" com.android.chrome`
3. Install gesture (the semi-manual bit): Chrome ⋮ → "Add to Home screen" / "Install app". Confirm the LifeOS icon lands on the launcher. (Scriptable installs need extra tooling; the tap is fastest.)
4. **Offline:** `adb shell cmd connectivity airplane-mode enable` (or `svc wifi disable && svc data disable`).
5. Launch the installed PWA from the launcher. PASS = it opens standalone (no URL bar) and previously added tasks render.
6. Restore: `adb shell cmd connectivity airplane-mode disable`.

### Windows desktop equivalent
No emulator needed — Edge/Chrome on the dev machine:
1. `npm run preview`, open in Edge.
2. Address-bar install icon → Install. PASS = opens in its own window.
3. DevTools → Network → Offline, reload the installed window. PASS = app + tasks render.

---

## What maps to the HITL checklist

| HITL item | Covered by |
|-----------|------------|
| Installs on Android | Tier 2 (installable) + Tier 3 (real install) |
| Installs on Windows | Tier 2 + Windows desktop step |
| Offline cold start shows tasks | Tier 1 case 3 + 4 (definitive) |

Tier 1 + 2 are CI-able and cover the substance. Tier 3 is the belt-and-suspenders real-install check, run locally before declaring Slice B done.

## Recommended gate for merging #6
- Required (CI): Tier 0 + Tier 1 + Tier 2 green.
- Nice-to-have (local, once): Tier 3 Android install + Windows install.
