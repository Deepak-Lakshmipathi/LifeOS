# S16c — owner verify checklist (HITL, do NOT merge without these)

Issue: [#66](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/66) · PRD: [#63](https://github.com/Deepak-Lakshmipathi/LifeOS/issues/63) · ADR: `docs/adr/0011-bot-transport-identity-router.md`

This slice is **HITL by construction**, mirroring S15b (PR #61): the real
git-network write path and the real Telegram long-poll loop cannot be
exercised in CI (no git remote, no live Telegram bot token, no live
Anthropic key available to the CI runner). CI green (`bot-test` +
`build-test` + `pwa-e2e`) is necessary but **not sufficient** — merge only
after every case below is hand-verified against the live vault and a real
Telegram conversation.

## Prerequisites

1. A bot-owned, write-scoped GitHub PAT (`Contents: Read` + `Write`, scoped
   to the vault repo only) — distinct from the PWA's `VITE_VAULT_PAT`.
2. A Telegram bot registered with `@BotFather`, its token, and your own
   Telegram chat id (message the bot once, or use `@userinfobot`, to find
   it).
3. A real `ANTHROPIC_API_KEY`.
4. `services/bot/.env` (copied from `.env.example`, gitignored) filled in
   with all five vars: `TELEGRAM_BOT_TOKEN`, `BOT_VAULT_PAT`,
   `BOT_VAULT_REPO_URL`, `ANTHROPIC_API_KEY`, `OWNER_TELEGRAM_CHAT_ID`
   (`BOT_VAULT_CLONE_DIR` optional).
5. `cd services/bot && npm install && npm start` — leave it running for the
   cases below.

## Cases to verify

- [ ] **(1) Owner create → real commit → dashboard shows it.** From your own
  Telegram account (the one matching `OWNER_TELEGRAM_CHAT_ID`), text the bot
  a free-form task (e.g. "call the CA about GST, life admin, high
  priority"). Confirm:
  - (a) A new commit appears in the vault repo's history, authored
    `LifeOS Bot <noreply@lifeos>`, containing a correctly-formatted task
    line with a non-empty `id::`.
  - (b) The commit is pushed to the remote (visible on GitHub/your git host,
    not just local).
  - (c) Opening the PWA with `VITE_VAULT=1` and refreshing shows the new
    task on the NOW queue / correct domain tile on its next vault read.
  - (d) The bot replies `✓ added '<title>' · <domain> · P<priority>`
    (omitting the priority segment if you didn't state one).

- [ ] **(2) Offline commit survives, pushes on reconnect.** With the bot
  process running, disconnect its network (or block `BOT_VAULT_REPO_URL`'s
  host at the firewall/hosts-file level), text it a task, and confirm:
  - The bot does **not** crash and still replies with the `✓ added`
    confirmation (the commit succeeds locally even though the push fails).
  - Reconnect the network, then trigger another vault read/write (e.g. text
    a second task, or restart the bot) — confirm the earlier offline commit
    is now visible on the remote too (it was retried/pushed on the next
    successful network operation, not lost).

- [ ] **(3) Non-owner chat id is ignored.** From a **different** Telegram
  account (not matching `OWNER_TELEGRAM_CHAT_ID`), message the bot. Confirm:
  - No reply is sent back to that chat.
  - No new commit lands in the vault repo.
  - (Optional) Check the bot's process logs — no Claude call should have
    been made for that message either.

- [ ] **(4) Ambiguous domain falls back to Inbox.** Text the bot a task with
  no domain hint at all, or a domain-ish word that doesn't confidently match
  one of the 7 canonical domains (e.g. "buy filters for the water
  purifier"). Confirm:
  - The task lands under the top-level `Inbox/Inbox.md` (or
    `Inbox/<project>.md` if a project was named but no domain), not
    mis-filed into one of the 7 domain folders.
  - The bot's confirmation reply shows `Inbox` as the domain segment.
  - The dashboard shows it as an Inbox task, not silently hidden in the
    wrong domain tile.

- [ ] **(5) Unsupported intent gets the fallback reply, no vault write.**
  Text the bot something that isn't a create request (e.g. "delete my last
  task" or "what's on my plate today?"). Confirm:
  - The bot replies `"not yet supported"` (the literal S16b fallback).
  - No commit lands in the vault.

## After all five pass

- [ ] Confirm no secret (PAT, bot token, Anthropic key) appears anywhere in
  the bot's process logs or console output during the above.
- [ ] Confirm `services/bot/.vault-clone/` (or your configured
  `BOT_VAULT_CLONE_DIR`) was never staged/committed to the LifeOS repo
  itself — it's a real clone of the vault repo's contents and must stay
  local + gitignored.
- [ ] Only then: approve and merge the PR.
