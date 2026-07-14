# S35 — calendar-sync agent (GH Actions → Calendar/today.md) [AGENT]

Phase 4 · Wave 4 · Deps: S33 (contract) · Blocks: —

## Context
First producer agent. Runs on GitHub Actions (placement rule: pure API + cron),
reads Google Calendar for today, writes `Calendar/today.md` in the vault repo
(`Deepak-Lakshmipathi/LiveOS-VaultRepo`, branch `main`) in the exact S33
contract format. Path-partition: this agent owns `Calendar/**` and nothing else.
CI tests mock the GCal response — NEVER call live APIs or require secrets in
tests (afk-pipeline test policy).

## Write-set (new dir — fully disjoint)
- NEW `agents/calendar-sync/sync.mjs` — fetch today's events (Google Calendar
  API v3, OAuth refresh-token flow via env `GCAL_CLIENT_ID/SECRET/REFRESH_TOKEN`)
  → map to S33 lines (event type from a keyword map, default `other`) →
  write `Calendar/today.md` → commit+push via `agents/lib` push wrapper if it
  exists, else plain git commands (shallow clone, single-file commit, push).
- NEW `agents/calendar-sync/sync.test.mjs` — node --test or vitest: mocked API
  response fixture → exact expected markdown out (assert byte-equal to an
  expected string that itself parses cleanly with `src/vault/calendar.ts`).
- NEW `.github/workflows/agent-calendar-sync.yml` — cron (every 30min, 05:00–
  23:00 IST) + workflow_dispatch; secrets from repo Actions secrets; also
  appends a status line per S47 contract IF S47's helper exists (optional —
  do not block on it; leave a TODO otherwise).
- NEW `agents/calendar-sync/README.md` — secrets setup (which console, which
  scopes: `calendar.readonly`), rotation, how to run locally.

## Subtasks
1. Mapper: GCal JSON → contract markdown (pure, tested). 2. Vault write+push
(BOT-style PAT via secret `AGENT_VAULT_PAT_CALENDAR` — its OWN fine-grained
token, contents-write on LiveOS-VaultRepo only). 3. Workflow yml. 4. README.

## Definition of Done
1. Mapper test: committed GCal-response fixture → markdown that `parseCalendar` (S33) parses back to the same events (roundtrip through the real parser).
2. Writes ONLY `Calendar/today.md`; commit author `lifeos-calendar-sync`.
3. Workflow yml lints (actionlint if available; else valid YAML + correct secret refs) and is cron+dispatch triggered.
4. Zero live-network in tests; zero secrets in repo (grep diff for token-like strings).
5. README documents the 4 secrets + scopes.
6. Tests green.

## Tests
Mocked-API mapper roundtrip; no e2e.

## Design refs
None (no UI).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Fully parallel-safe (own dir).
