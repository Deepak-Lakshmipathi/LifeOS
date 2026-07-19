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
- **~~vitest post-teardown `window is not defined` flake~~ — FIXED (issue #120, 2026-07-19).** Root cause was `useTasks.ts`'s initial async `list()` load and `TaskItem.tsx`'s 600ms ring-pulse `setTimeout` setting state after unmount → `ReferenceError: window is not defined` "caught after the test environment was torn down" (originating in `cockpitShell.test.tsx`, siblings `tapDotComplete.test.tsx`). Both now guard: `useTasks` uses a `cancelled` flag + effect cleanup; `TaskItem` clears the timer via a ref on unmount (`src/test/useTasksUnmount.test.tsx` pins it). Signature did not recur across 5+ post-fix full-suite runs. **If `window is not defined` reappears, it is a NEW leak site — do not rerun-to-green; find the unguarded async setState.**
- **vitest `syncProvider` "Seam isolation" 5000ms timeout under parallel load** — job `build-test`, test `src/test/syncProvider.test.ts` "Seam isolation > only LocalOnly and LifeOSDb import Dexie — verified by static analysis"; a filesystem-walking static-analysis test that exceeds the 5s default when many suites run concurrently on a slow box (`cockpitShell.test.tsx` also times out alongside it). Passes in isolation (~1.7s). Distinct from the fixed teardown leak above — this is test slowness, not a state-after-unmount bug. Load/timing dependent; trust CI on a clean runner. Rerun-to-green if it fires; a proper fix would raise this one test's timeout or cache the import scan.

## Labels

Canonical vocabulary in [triage-labels.md](triage-labels.md): `ready-for-agent`, `needs-triage`, `needs-info`, `ready-for-human`, `wontfix`, `bug`, `enhancement`, plus kanban states `status:ready`, `status:blocked`, `status:in-progress`, `status:done`. No new labels, no `wave-N`; token lacks `project` scope (no Projects board).

## Model tiers (P5 dispatch routing)

- **Haiku** — mechanical PRs: kanban board flips, docs-only sync commits.
- **Sonnet** — feature/bug slices (pre-resolved baseline, unchanged).
- **Opus** — escalation tier: a slice's 2nd review reject re-dispatches one tier up instead of burning a 3rd same-model attempt.

## Known hotspots

- `services/bot/router.ts` — message-ingest dispatch; any two slices touching it must serialize (see S17/18/19b run).
- **v2 (S20–S57):** `src/App.tsx` — S24 ONLY, dispatched alone, ever. `src/components/home/HomeView.tsx` — chain s27→s28→s29→s32→s34→s37→s48→s50, serialize + rebase. `src/components/cockpit/VitalsRow.tsx` — s26→s41→s45. `src/components/agents/AgentsView.tsx` — s49→s53→s54. All other v2 slices are pairwise-disjoint (vault parsers = one `src/vault/*.ts` file each; agents = one `agents/<name>/` dir each; tab views = one dir each).

## Eval gate (v2 — the third green, MANDATORY before merge)

Every v2 slice PR merges only on **triple-green**:

1. **CI green** (build-test; bot-test when `services/bot` touched).
2. **Review green** (ponytail-review).
3. **Eval green** — dispatch a FRESH read-only eval subagent (Sonnet; not the implementer, no shared context) with exactly three inputs: (a) the slice ticket `docs/slices/slice-S##-*.md`, (b) `gh pr diff <N>`, (c) the CI run result. It must:
   - verify each numbered **Definition of Done** item against the diff, one row per item: `#N — PASS/FAIL — evidence (file:line or test name)`;
   - check the diff stays inside the ticket's **Write-set** (out-of-scope files = FAIL unless the PR body carries a one-line justified deviation);
   - for **[UI]** slices, check design-language conformance: tokens only (no new raw colors/radii/blurs), reduced-motion honored, §8 Do/Don't not violated;
   - end with `VERDICT: PASS` or `VERDICT: FAIL` + the table, posted as a PR comment.
   FAIL → back to the implementer with the table; a 2nd FAIL escalates the implementer one model tier (standard escalation rule). No human override recorded in the ticket = no merge on FAIL.
