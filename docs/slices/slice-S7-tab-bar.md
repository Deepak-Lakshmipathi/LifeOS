# Slice S7 — Tab bar navigation

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** B · **Depends on:** S6 · **Status:** planned

## Why
The app needs its navigation shape: a bottom tab bar (Now / Domains / Pulse / +), thumb-reachable, Apple-native. This is the frame every later screen plugs into.

## Scope — this slice only
- Bottom tab bar with 4 tabs: **Now**, **Domains**, **Pulse**, **+**.
- **Now** → `NowView` (S6). **Domains** → the Domain→Project→Task grouped list (from S5, moved here). **Pulse** → placeholder ("coming soon"). **+** → the add flow (current `AddTaskInput`, modal or sheet).
- Active-tab state; mobile-first layout, safe-area aware.

## Out of scope
- Warmth tiles on Domains (S9), Pulse content (S13), smart capture (S12), glass styling (S11).

## Data / model change
- None.

## Vertical
- UI: `TabBar` component + view switching in `App.tsx` (simple state or a light router; no new heavy dep preferred).
- PWA: tabs must work offline; no regression to install/offline.

## Acceptance criteria (done_when)
- [ ] Four tabs render; tapping switches views; active state visible.
- [ ] Now/Domains/+ are functional; Pulse is a labeled placeholder.
- [ ] Layout respects mobile safe areas; tab bar fixed at bottom.
- [ ] PWA install/offline e2e green; e2e updated to navigate via tabs.

## Relevant files
New `src/components/TabBar.tsx`, `src/App.tsx`, existing views (`NowView`, the grouped list), `e2e/pwa.spec.ts`.

## Notes for executor
Prefer simple local state over adding a router unless deep-linking is needed. Keep each tab's view a standalone component so later slices edit one screen without touching navigation.
