# S62 — Config-check before the dynamic import; drop card short-circuits (closes #155)

Post-v2 · Wave 13 · Deps: S61 (transport.ts hotspot — rebase on its merge) · Blocks: —

Source: GitHub issue **#155**. Read it before starting. Perf/architecture, not
correctness — the smallest card of the wave.

## Context
`AttentionCard` carries a component-local short-circuit: no `transport` prop AND
`VITE_VAULT_REPO_URL` unset → skip the self-load entirely, because otherwise the
`isomorphic-git` / `lightning-fs` dynamic `import()` is paid before `loadGit()`
throws on the missing url (it pushed `cockpitShell.test.tsx` over its render
budget). `FleetStrip` and `HomeView`'s brief load copied the same guard;
`TodayCard`/`HabitsCard` never got it and still pay the cost.

It works, but it bakes GitTransport's private config contract
(`VITE_VAULT_REPO_URL`) into components whose only dependency should be the
`VaultTransport` interface. Fix it at the seam: do the **synchronous** `if (!url)`
check in `GitTransport` BEFORE the dynamic `import()` (#153's reorder moved it
before `new LightningFS()`, but the imports still run first). Then every
self-loading card gets the fast empty path for free and the component-local
guards delete.

Decide and document: with no url, does `readFiles()` **throw** (current
behavior after the import) or **return `[]`**? Every call site already
`try`/`catch`es into an empty state, so keeping the throw is the smaller diff
and the fewer behavior changes — take that unless a call site proves otherwise.

## Write-set
- MODIFY `src/vault/transport.ts` — hoist the config check above the dynamic
  `import()` in `loadGit()`.
- MODIFY `src/vault/transport.test.ts` — assert the unconfigured path resolves
  without ever reaching the import.
- MODIFY `src/components/home/AttentionCard.tsx`, `FleetStrip.tsx`,
  `HomeView.tsx` — delete the `import.meta.env.VITE_VAULT_REPO_URL` reads from
  each self-load effect (grep for that symbol under `src/components/` and clear
  every hit — root-cause across siblings, not just the one #155 names).

## Subtasks
1. Hoist the check + test it. 2. Delete every component-side env read.
3. Confirm `cockpitShell.test.tsx` render budget still passes.

## Definition of Done
1. `import.meta.env.VITE_VAULT_REPO_URL` appears in ZERO files under `src/components/` after this PR (grep-verifiable).
2. With no url configured, a `GitTransport` self-load settles without loading `isomorphic-git`/`lightning-fs` (tested — assert the import is not reached, e.g. via a mocked module that records instantiation).
3. Every self-loading card (`AttentionCard`, `FleetStrip`, `TodayCard`, `HabitsCard`, HomeView's brief) still renders its honest empty state with no vault configured (tested).
4. `cockpitShell.test.tsx` passes within its existing render budget — no new timeout or budget bump.
5. No test constructs a real lightning-fs backend.
6. `npm run build` + `npm test` green incl. pwa-e2e; issue #155 closed by the PR.

## Tests
Unconfigured path skips the import; all 5 cards' empty states; shell budget.

## Design refs
None (no UI change; empty states must look identical to today).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Rebase onto S61's merge
BEFORE starting — both edit `src/vault/transport.ts`.
