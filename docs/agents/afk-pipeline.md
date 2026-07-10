# AFK pipeline — per-repo config

Loaded by the `afk-pipeline` skill at P0. Per-repo facts live here, not in the skill body (spec-kit "constitution" pattern). If this file is missing and no target-repo override is given, the pipeline aborts.

## Target repo

`Deepak-Lakshmipathi/LifeOS`. The vault data repo (`LiveOS-VaultRepo`) is data-only — never a pipeline target.

## Stack + test policy

TS/React PWA: Vite, React 18, Tailwind, Dexie/isomorphic-git vault layer. Deployed to GitHub Pages.

Acceptance criteria in slices target **Vitest unit/component tests** (jsdom + Testing Library, `npm test`) — fast, CI-runnable. Playwright e2e (`npm run test:e2e`) exists but is NOT a slice acceptance target: too slow/flaky for the merge gate. Never require an emulator, live external service, or manual verification in AFK slice criteria.

## CI flake fingerprints

Treat any red NOT matching an entry below as real until proven otherwise (inspect `--log-failed` first). A fingerprint entry needs: failing step name, error signature, typical run duration, and rerun-to-green evidence.

- **pwa-e2e offline-persistence flake** — job `pwa-e2e` (Tier 1 Playwright), test `e2e/pwa.spec.ts:94 tasks added online persist after going offline and reloading`; signature `expect(getByText('emu-test')).toBeVisible()` timeout 8000ms, element(s) not found; run ~1m30s; rerun-to-green evidence: runs 29077750317 (PR #96) and 29078008134 (PR #97), both 2026-07-10, both docs-only diffs — failed first attempt, rerun passed. **High frequency (2/2 first attempts that day): the test itself needs a stabilization fix (likely offline-reload timing), not just reruns.**

## Labels

Canonical vocabulary in [triage-labels.md](triage-labels.md): `ready-for-agent`, `needs-triage`, `needs-info`, `ready-for-human`, `wontfix`, `bug`, `enhancement`, plus kanban states `status:ready`, `status:blocked`, `status:in-progress`, `status:done`. No new labels, no `wave-N`; token lacks `project` scope (no Projects board).

## Model tiers (P5 dispatch routing)

- **Haiku** — mechanical PRs: kanban board flips, docs-only sync commits.
- **Sonnet** — feature/bug slices (pre-resolved baseline, unchanged).
- **Opus** — escalation tier: a slice's 2nd review reject re-dispatches one tier up instead of burning a 3rd same-model attempt.

## Known hotspots

`src/router.ts` — nav registration; any two slices touching it must serialize (see S17/18/19b run).
