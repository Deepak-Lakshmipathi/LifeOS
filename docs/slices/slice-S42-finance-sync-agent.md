# S42 — finance-sync agent (THIS PC: Kite + Groww CSV → Finance/**) [AGENT]

Phase 6 · Wave 4 · Deps: S39 (contract) · Blocks: —

## Context
The one agent that runs on the owner's PC (placement rule: Kite Connect needs
a daily interactive login; Groww arrives as CSV downloads). Watches a local
drop folder for Groww CSVs + pulls Kite holdings, then writes ALL of
`Finance/**` (S39 contracts) in ONE atomic commit — partial money data is
worse than stale money data. Owns `Finance/**` only.

## Write-set (new dir)
- NEW `agents/finance-sync/sync.mjs` — Kite Connect holdings+margins (API key
  + access token from local env; token refreshed by the daily login helper),
  Groww CSV parse (latest file in `FINANCE_DROP_DIR`), compute: networth
  append (if month changed or value moved >1%), portfolio buckets, burn
  month-to-date, bills passthrough (bills stay manual/gmail-fed — do NOT
  overwrite `Finance/bills.md`) → single commit "finance-sync: <date>" → push.
- NEW `agents/finance-sync/login.mjs` — interactive Kite login helper
  (opens browser, captures request token, exchanges + stores access token in
  local user dir, NEVER in the repo).
- NEW `agents/finance-sync/sync.test.mjs` — Kite response fixture + sample CSV
  → all three files byte-expected + parse back via `src/vault/finance.ts`.
- NEW `agents/finance-sync/README.md` — Windows Task Scheduler setup (daily
  post-login), env vars, CSV drop-folder convention.

## Subtasks
1. Kite mapper. 2. CSV parser (Groww export columns; malformed rows skipped).
3. Atomic multi-file commit (stage all, one commit; abort ALL on any failure).
4. login helper. 5. README + tests.

## Definition of Done
1. Fixture Kite JSON + fixture CSV → networth-history append, portfolio.md, burn.md all matching expected output AND roundtripping through S39 parsers (tested).
2. `Finance/bills.md` never written by this agent (test asserts untouched).
3. Write is atomic: injected failure mid-write → no commit, vault clean (tested with fake transport/fs).
4. No credentials in repo; access token path is user-local; README documents rotation.
5. Tests green; zero live API calls in tests.

## Tests
Fixtures → files roundtrip; atomicity; bills untouched.

## Design refs
None.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Fully parallel-safe (own dir).
