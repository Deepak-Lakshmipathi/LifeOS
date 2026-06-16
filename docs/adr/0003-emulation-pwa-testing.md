# CI-gated emulation testing for PWA acceptance

Slice B's acceptance ("installs + works offline on Windows and Android") was originally a manual device checklist (HITL). We replaced the substance of it with CI-gated emulation rather than relying on hand testing.

What we run in CI (`.github/workflows/ci.yml`, job `pwa-e2e`):
- **Playwright (Chromium)** — `e2e/pwa.spec.ts`: service worker controls the page after reload; manifest linked + valid; app shell renders with `context.setOffline(true)`; a previously-added task survives an offline cold reload (proves SW precache + IndexedDB).
- **Installability audit** — `scripts/lh-pwa.mjs`. Note: Lighthouse v10+ dropped its PWA category and the `installable-manifest`/`service-worker` audit IDs, so the script implements equivalent checks directly via Playwright/CDP. It does not actually use Lighthouse despite the dependency name.

The full protocol (Tiers 0–3) lives in `docs/testing/pwa-emulation-protocol.md`. Tier 3 (Android AVD + Windows desktop install) stays an optional local check, not in CI.

Trade-off accepted: emulation cannot replicate every real-device install nuance (OS-level "Add to Home screen" gesture, vendor browser quirks). We accept that gap in exchange for a deterministic, fast, automated merge gate, and keep Tier 3 available for belt-and-suspenders before declaring a slice done on real hardware.
