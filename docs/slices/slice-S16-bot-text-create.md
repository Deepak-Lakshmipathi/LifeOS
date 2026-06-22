# Slice S16 — Telegram bot: text → create

> Read `docs/slices/README.md` + `CONTEXT.md` first. For Claude API usage, consult the `claude-api` skill.

**Group:** E · **Depends on:** S15 · **Status:** planned

## Why
The capture-from-anywhere payoff. Thinnest bot first: text a task, Claude parses it, it's created in the vault and shows up on the dashboard. No media, no edits yet.

## Scope — this slice only
- A Telegram bot (separate deployable, e.g. `services/bot/`, Node/TS) using the official Telegram Bot API.
- **Auth:** only the owner's Telegram chat id is accepted; all others ignored.
- On a text message → call Claude to classify intent (this slice handles **create** only) and extract `{ title, domain, project, done_when, priority }`.
- Write the task to the vault via the same vault layer as S15 (share the parser/serializer + transport; do not duplicate).
- Reply with a confirmation: `✓ added '<title>' · <domain> · P<priority>`.

## Out of scope
- update/delete (S17, with confirm-destructive), voice (S18), photo (S19). Non-create intents → reply "not yet supported".

## Data / model change
- None (writes existing model to the vault).

## Vertical
- Service: Telegram webhook/long-poll handler; owner-id guard; Claude call (intent + extraction with a structured output schema); vault write.
- Shared: reuse `serializeTaskLine`/transport from S15 (extract to a shared module if needed).
- Dashboard: no change — it already reflects the vault (S14/S15).

## Acceptance criteria (done_when)
- [ ] Only the owner's chat id is served; others ignored/denied.
- [ ] A free-text message creates a correctly-parsed task in the vault; dashboard shows it.
- [ ] Bot replies with the created task summary.
- [ ] Claude extraction uses a structured schema (latest Claude model per `claude-api`); ambiguous domain → Inbox.
- [ ] Secrets (bot token, Claude key) via env, never committed; owner id configurable.
- [ ] Unit/integration test for the intent→task mapping with mocked Claude.

## Relevant files
New `services/bot/` (handler, Claude client, config), shared vault write module from S15, repo README/deploy notes.

## Notes for executor
Keep the model's job narrow this slice: classify + extract for **create**. Use the latest Claude model. Treat the bot as a separate process from the PWA; they meet only at the vault.
