# S51 — Telegram bot logs runs → appears on Health [AGENT]

Phase 8 · Wave 4 · Deps: S47 · Blocks: —

## Context
Retrofit the shipped bot (`services/bot/`, v1) to log activity via the S47
contract so it shows on the fleet board: each successful capture/edit logs a
run; the long-poll loop heartbeats status.json periodically (the bot is
always-on — cadence semantics differ from cron agents: heartbeat every 15min,
note = last action). Bot writes to `agents/telegram-bot/` in the vault through
its EXISTING transport — no new git plumbing.

## Write-set (services/bot only — disjoint from PWA)
- NEW `services/bot/runLog.ts` — thin adapter over the S47 file shapes writing
  via the bot's `vaultTransport` (append runs.jsonl line, overwrite
  status.json; piggyback on the action's existing commit when possible, else
  own small commit).
- MODIFY `services/bot/index.ts` — heartbeat interval (15min, ok:true,
  note "polling"); wire post-action logging (create/update/delete/photo/voice
  handled → one run entry with note like "create: <title>").
- MODIFY `services/bot/router.ts` — minimal: emit an action-result event/callback
  the logger subscribes to (keep router logic untouched otherwise).
- NEW `services/bot/runLog.test.ts` (fake transport, as all bot tests).

## Subtasks
1. Adapter (S47 shapes byte-compatible — cross-check against
`src/vault/agentStatus.ts` fixtures). 2. Heartbeat timer (unref'd; test with
fake timers). 3. Action hook. 4. Tests.

## Definition of Done
1. A handled create writes one runs.jsonl line + refreshed status.json via fake transport (tested); note contains the action.
2. Heartbeat writes status at the interval under fake timers; failures in logging NEVER break message handling (error swallowed + console.warn, tested).
3. status.json parses with the PWA's `agentStatus.ts` (fixture cross-test).
4. All existing 141+ bot tests pass unmodified.
5. Diff confined to `services/bot/`. Tests green.

## Tests
Bot Vitest: log-on-action, heartbeat, never-throws, cross-parse.

## Design refs
None. HOTSPOT note: touches `services/bot/router.ts` — no other bot slice in flight (none planned in v2), safe.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Parallel-safe vs all PWA slices.
