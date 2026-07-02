# Deploy tables — S16: Telegram bot: text → create

Pipeline: `afk-pipeline auto` (headless self-grill; zero human pauses). Per explicit run instructions, this run stops at labeled, dependency-ordered issues + tables — **implementer agents were NOT dispatched**. Hand these off for manual/next-session dispatch.

- **PRD:** [#63 — PRD: S16 — Telegram bot: text → create](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/63)
- **ADR:** `docs/adr/0011-bot-transport-identity-router.md` (bot runtime, own PAT, durable `id::`, intent-router seam — all 4 previously-open grill questions resolved here)
- **CONTEXT.md:** new glossary entries — Bot, Intent, `id:: (durable identity)`
- **kanban.html:** `s16` placeholder row replaced with `s16a` / `s16b` / `s16c`; S17/S18/S19 `blockedBy` repointed from `s16` → `s16c`

## AFK-deployable table

| Issue | Task | Context | Model | Parallel group |
|-------|------|---------|-------|----------------|
| [#64 — S16a: vault id:: durable identity](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/64) | Extend `parseTaskLine`/`serializeTaskLine` for an optional `id::` inline field | files: `src/vault/parseVault.ts`, `src/vault/parseVault.test.ts`, `src/vault/serialize.ts`, `src/vault/serialize.test.ts`; ADR-0011 §3; blocked by: none; do NOT touch: `src/sync/VaultSync.ts`, `src/vault/transport.ts`, `services/**`; test: extended Vitest fixture suites in `parseVault.test.ts` + `serialize.test.ts` (52 existing S14 fixtures stay green + new id-present/id-absent/round-trip fixtures) | Sonnet | batch-1 (status:ready) |
| [#65 — S16b: bot core — Telegram intent pipeline](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/65) | Build `services/bot/` core: owner guard, Claude NLU (claude-sonnet-5, structured output), self-registering intent router, create handler against an injected fake `VaultTransport` | files: new `services/bot/**` (index.ts, config.ts, telegramClient.ts, claudeClient.ts/nlu.ts, ownerGuard.ts, router.ts, vaultTransport.ts [throwing stub], intents/{types,registry,create,index}.ts, tests, `.env.example`); PRD §Implementation Decisions; ADR-0011 §2/§4; blocked by: #64; do NOT touch: `src/vault/parseVault.ts`, `src/vault/serialize.ts`, `src/vault/transport.ts`, `src/sync/VaultSync.ts`, anything under `src/` or `e2e/`; test: owner-guard/intent-mapping/router/create-handler Vitest unit tests, all against mocks/fakes (no live network) | Sonnet | batch-2 (status:blocked → ready once #64 merges) |

## HITL-flagged section

Design work is **not** the reason here — all 4 design decisions were resolved this session (ADR-0011). This is flagged HITL for the same reason S15b was: the git-network write path and the live Telegram loop cannot be exercised in CI (no remote, no live bot token/Anthropic key available to the CI runner).

| Issue | Why HITL | What the human must decide | Assumption made (auto mode) |
|-------|----------|----------------------------|-----------------------------|
| [#66 — S16c: bot real vault transport + live Telegram wiring](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/66) | Not CI-verifiable — real `isomorphic-git`+Node-`fs` clone/commit/push and the real Telegram `getUpdates` loop need a live vault repo, a live bot token, and a live Anthropic key; CI has none of those (same constraint that made S15b HITL) | Owner hand-verify after merge-candidate: real message → vault commit lands → dashboard shows it → confirmation reply; a non-owner message stays a no-op | Bot hosting target (VM/always-on container) is left to the owner (ADR-0011 HITL flag A) — not blocking S16c's code, only its *deployment*. Claude model pin `claude-sonnet-5` (ADR-0011 HITL flag B) — assumed sufficient for extraction accuracy; revisit if quality proves insufficient in practice. |

## Design decisions made this run (recorded in ADR-0011, all final — do not re-open)

1. **Bot runtime:** long-poll worker (Node/TS process polling Telegram `getUpdates`), not a serverless webhook — keeps the local git clone warm across messages; no public HTTPS endpoint needed for a single-owner bot; avoids serverless execution-time ceilings for git+Claude round trips.
2. **Bot auth:** its own write-scoped fine-grained GitHub PAT (`BOT_VAULT_PAT`, Contents Read+Write on the vault repo), separate from the PWA's `VITE_VAULT_PAT`. All secrets via env, never committed.
3. **Durable `id::` identity:** lands in S16 per ADR-0010 §2's own upgrade trigger (bot = first "second live mutator"). `parseTaskLine` reads an optional `id::`; `serializeTaskLine` always emits it. No `Task`/Dexie schema change — vault-markdown-format addition only, with lazy on-next-write backfill for legacy lines.
4. **Intent router seam:** `services/bot/intents/` — one file per intent, each self-registers into a shared `Map`; the only per-slice shared touchpoint is one append-only `import` line in `intents/index.ts`. Carved now so S17/S18/S19 don't collide on a shared registry.

## Deploy hint (for the human / follow-up session)

Dispatch #64 now (no blockers). Once merged, #65 flips `status:blocked` → `status:ready` and can dispatch. #66 is HITL — pick it up only when ready to hand-verify against the real vault/Telegram; do not auto-dispatch it as a Sonnet AFK agent. Pair any dispatch with a CI Build Supervisor per the pipeline's standard runbook, and merge only on dual-green (CI + ponytail-review ultra) for #64/#65; #66 additionally needs the owner hand-verify checklist above before merge.
