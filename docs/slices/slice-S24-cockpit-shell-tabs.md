# S24 — Cockpit shell: 6-tab IA restructure [UI] — App.tsx HOTSPOT, DISPATCH ALONE

Phase 1 · Wave 2 · Deps: S21 (+ mounts S22) · Blocks: nearly everything

## Context
Restructures the app shell to `docs/DESIGN_LANGUAGE.md` §5: aurora canvas (z0)
+ `.shell` (1180px, z1) with header slot, vitals slot, centered pill tab bar —
**Home · Money · Career · Agents · Domains · Pulse** — and one section per tab.
Domains + Pulse embed the already-shipped `DomainsMap`/`PulseView` unchanged.
CRITICAL JOB: this is the ONLY v2 slice allowed to edit `src/App.tsx`. It must
leave stub mount points so every later slice edits only its own file.

## Write-set
- MODIFY `src/App.tsx` — new shell layout; mounts Aurora (S22), `<Header/>`
  stub, `<VitalsRow/>` stub, pill tabs, tab sections.
- MODIFY `src/components/TabBar.tsx` — pill tab bar per §4.1 nav.tabs spec
  (or replace usage with glass `Segmented` at nav size), tab fade §2.3.
- NEW STUBS (each renders a placeholder Card; later slices fill them, App
  never changes again):
  `src/components/cockpit/Header.tsx` (S25 fills)
  `src/components/cockpit/VitalsRow.tsx` (S26 fills)
  `src/components/home/HomeView.tsx` (S27+ fill; v1 NOW content lives here for now)
  `src/components/money/MoneyView.tsx` (S40)
  `src/components/career/CareerView.tsx` (S44)
  `src/components/agents/AgentsView.tsx` (S49)
- Tests: tab-switch test; existing Domains/Pulse render tests stay green.

## Subtasks
1. Shell per §5 (max-width, padding, z-stack). 2. Six pill tabs + fade
transition. 3. Stub files. 4. Domains/Pulse embedded unchanged. 5. Keep v1
task flow reachable on Home (capture sheet + NOW list render inside HomeView).
6. Tests.

## Definition of Done
1. Six tabs render in order Home/Money/Career/Agents/Domains/Pulse; switching shows exactly one section, with §2.3 fade.
2. Domains tab = existing DomainsMap; Pulse tab = existing PulseView; their tests untouched and green.
3. All six stub/component files above exist; App.tsx contains mount points only — no mission/vitals-data/money logic inline in App.tsx.
4. Aurora mounted at z0; shell content above it per §2.3 Z table.
5. v1 capture + task list still usable on Home (no functionality lost).
6. Tab-switch test green; full suite green; `npm run build` green.

## Tests
Vitest: tab switch shows/hides; stubs render.

## Design refs
§4.1 (nav.tabs), §5 (layout table), §2.3 (Z, motion).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Do NOT batch with any other slice.
