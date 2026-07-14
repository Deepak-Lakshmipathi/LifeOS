# S57 — Per-agent scoped tokens + shared push wrapper [hardening]

Phase 10 · Wave 5 · Deps: none (agents adopt as they land) · Blocks: —

## Context
Security + reliability floor for the fleet: every agent gets its OWN
fine-grained PAT (revoke one, rest untouched — pattern set by v1
`BOT_VAULT_PAT`), and all agent pushes go through one wrapper that survives
concurrent writers: `pull --rebase → push → retry on reject` (path-
partitioning makes rebases trivial, but rejects still happen on timing).

## Write-set
- NEW `agents/lib/push.mjs` — `commitAndPush(repoDir, {files, message,
  author})`: stage listed files only → commit → `pull --rebase` → push →
  on reject retry up to 3 with jittered backoff → throw loud after (caller's
  runLog records ok:false).
- NEW `agents/lib/push.test.mjs` — simulated reject (mock git exec: first
  push rejected, rebase, second succeeds) + retry-exhaustion path.
- NEW `docs/agents/vault-tokens.md` — token inventory table: agent → secret
  name → scope (contents-write on LiveOS-VaultRepo only) → where stored
  (GH Actions secret / PC credential manager / VPS .env) → rotation steps.
  Lists: AGENT_VAULT_PAT_{CALENDAR,MAIL,CAREER,BRIEFS,SUPERVISOR,FINANCE},
  BOT_VAULT_PAT (existing), PWA runtime PAT (existing, browser-only).
- MODIFY `agents/lib/runLog.mjs` — none expected; only if push integration
  needs a hook (keep diff minimal).

## Subtasks
1. Wrapper (git via child_process, injectable exec for tests). 2. Retry/
backoff. 3. Reject simulation tests. 4. Token doc.

## Definition of Done
1. Wrapper stages ONLY the listed files (stray-file test: unlisted dirty file not committed).
2. Simulated rejected push → rebase → retry succeeds (tested); 3 rejects → throws with clear message (tested).
3. Author string per agent flows through to the commit.
4. `docs/agents/vault-tokens.md` covers every planned agent secret with scope + rotation.
5. Tests green; no live git/network in tests.

## Tests
Mock-exec: staging isolation, retry, exhaustion.

## Design refs
None.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Parallel-safe (new files; existing agents adopt in their own slices).
