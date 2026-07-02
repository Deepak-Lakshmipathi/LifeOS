# LifeOS bot — `services/bot/`

A standalone Node/TypeScript process — Telegram text capture over the shared
Obsidian vault. Independent of the Vite/React PWA build (its own
`package.json`, its own `tsconfig.json`, its own `vitest.config.ts`); it
imports only the PWA's *pure* modules (`src/vault/serialize.ts`,
`src/vault/transport.ts`'s `VaultTransport` interface, `src/data/domains.ts`)
and never anything Vite/browser-specific.

See `docs/adr/0011-bot-transport-identity-router.md` for the design
rationale (runtime shape, auth, durable `id::`, intent-router seam) and
PRD #63 / issue #66 for the product/slice spec.

## What it does

A long-running Node process **long-polls** the Telegram Bot API
(`getUpdates`). Every message from the configured owner chat id is classified
by Claude (`create` or "not yet supported" for anything else), extracted into
a structured task, written to the vault via a real `git commit` (best-effort
`git push`), and confirmed back to the owner in Telegram.

Runtime shape is a long-poll worker, not a webhook — see ADR-0011 Decision 1
for why (keeps the local git clone warm across messages; no public HTTPS
endpoint to secure for a single-owner bot).

## Running it

```sh
cd services/bot
npm install
cp .env.example .env   # fill in real values — .env is gitignored
npm start               # tsx index.ts — runs the long-poll loop
```

There is no build step required to run in dev (`tsx` runs the TypeScript
directly). For a compiled deploy, add a `tsc` build step producing
`dist/index.js` and run `node dist/index.js` instead — not set up in this
slice since no hosting target has been chosen yet (see "Deploying" below).

Tests (Node environment, no network, no real secrets):

```sh
cd services/bot
npm test
```

## Required environment variables

All secrets load from `process.env` at boot via `config.ts` (`loadConfig`),
are validated once (fails loud, naming every missing var), and are **never
logged**. See `.env.example` for the authoritative list; summary:

| Variable | Required | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes | Bot API token from `@BotFather`. |
| `BOT_VAULT_PAT` | yes | Fine-grained GitHub PAT, `Contents: Read` + `Write`, scoped to the vault repo only. **Distinct from the PWA's `VITE_VAULT_PAT`** (ADR-0011 §2) so the two surfaces can be rotated/revoked independently. |
| `BOT_VAULT_REPO_URL` | yes | The vault repo's remote URL — the same repo the PWA's `VITE_VAULT_REPO_URL` points at. |
| `ANTHROPIC_API_KEY` | yes | Claude API key for intent classification + extraction (`nlu.ts`, model pinned to `claude-sonnet-5`). |
| `OWNER_TELEGRAM_CHAT_ID` | yes | The single Telegram chat id the bot serves. Every other chat id is a complete no-op — no reply, no Claude call, no vault write. |
| `BOT_VAULT_CLONE_DIR` | no | Local working-copy directory the git transport clones into and reuses across messages. Defaults to `.vault-clone` under `services/bot/` (gitignored — never commit a real clone of the vault). |

## Deploying (operational choice — not part of this slice's code)

Per ADR-0011 Decision 1, the bot needs *some* always-on host — a small VM, an
always-on free-tier container, or a machine the owner already controls. This
is an infrastructure decision, not an architectural one, and is left to the
owner. Whatever the target:

- Run `npm install && npm start` (or a compiled `node dist/index.js`) as a
  long-lived process (e.g. under `systemd`, `pm2`, or a container restart
  policy) — it is a worker loop, not a request handler, and is expected to
  run indefinitely.
- Give it a writable local disk for `BOT_VAULT_CLONE_DIR` — the git clone
  persists there across restarts is not required (a cold start just re-clones
  in a fresh directory), but persisting it avoids paying a full clone on
  every restart.
- No inbound network/ports are needed (long-poll only makes outbound HTTPS
  calls to `api.telegram.org` and the vault's git remote).

## Vault write path (S16c — real git transport)

`vaultTransport.ts`'s `NodeVaultTransport` implements the existing
`VaultTransport` interface (`src/vault/transport.ts`, unmodified) against
Node's native `fs` + `isomorphic-git`/`isomorphic-git/http/node` — **not**
`lightning-fs` (IndexedDB-backed, browser-only, doesn't exist in Node). It is
new code satisfying the existing interface; the browser-facing `GitTransport`
class is untouched.

Same commit/push discipline `GitTransport.writeFile` established in S15b:

- `writeFile`: `mkdir -p` any missing parent directories → `git.add` → a
  **local-authoritative `git.commit`** (author `LifeOS Bot <noreply@lifeos>`,
  always succeeds offline against the full local clone) → a **best-effort
  `git.push`** (failure swallowed — offline / non-fast-forward — the
  unpushed commit stays local as the retry queue; no separate queue infra).
- `readFiles`: pull (fast-forward only); on failure, best-effort-push any
  local commits first, then only wipe-and-reclone when nothing local is
  ahead of origin (the S15b "must-fix transport hazard" — a plain wipe would
  otherwise silently destroy committed offline writes). First boot has no
  local clone yet, so this same path performs the initial shallow,
  single-branch clone.

### What's CI-verifiable vs. what needs an owner hand-verify

This ticket is **HITL by construction** (mirrors S15b, PR #61): the real
git-network write path and the real Telegram long-poll loop cannot be
exercised in CI (no git remote, no live Telegram bot token, no live
Anthropic key available to the CI runner).

- **CI-verifiable (`vaultTransport.test.ts`):** the transport's local git
  logic against a real local `isomorphic-git` repo in a temp directory —
  commit-lands, offline-commit-survives (push to an unreachable `.invalid`
  host is swallowed), and the wipe-guard (refuses to wipe-reclone when local
  commits are unpushed and pull fails). Plus every S16b test (owner guard,
  NLU with a mocked Claude client, intent router, fake-transport create
  handler) stays green — this ticket only replaced the transport's
  implementation, not its interface or S16b's test doubles.
- **NOT CI-verifiable — owner hand-verify required before merge:** see
  `afk-pipeline-out/s16c-verify-checklist.md` for the exact live cases
  (real message → real Claude → real commit+push to the live vault).
