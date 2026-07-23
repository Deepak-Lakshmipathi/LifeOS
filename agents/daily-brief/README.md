# daily-brief agent (S50)

The final v2 card. A GH Actions cron agent (`agent-daily-brief.yml`,
05:30 IST) that reads the WHOLE vault clone — tasks, habits, calendar,
attention, finance, career, everything markdown — compacts it into a
token-capped context pack, and asks Claude for a structured 5-line morning
brief. The brief is written to `Briefs/<date>.md`; Home shows it as a dim
intro line under the header greeting, morning mode only (§6).

## What it does

1. **Read** — walks every `.md` file in the vault clone, excluding
   `agents/**`, `proposals/**`, and its own `Briefs/**` output (yesterday's
   brief never feeds into today's).
2. **Digest** — compacts each file to a per-file character cap, then
   assembles a context pack capped at a total character budget (a ~4-chars-
   per-token approximation — no live tokenizer call is worth the extra
   network round trip for this). Files beyond the cap are simply dropped,
   never truncated mid-file.
3. **Compose** — one Claude call (`claude-sonnet-5`, structured output)
   asking for exactly 5 short lines, in order: mission preview, first
   calendar block, top attention item, streak note, one money fact. Malformed
   output (wrong line count, blank line) is retried ONCE; still-malformed
   output after the retry fails the run loudly.
4. **Write + push** — `Briefs/<date>.md` plus its own S47 run log
   (`agents/daily-brief/{runs.jsonl,status.json}`) are committed together and
   pushed via `agents/lib/push.mjs`.

Writes ONLY `Briefs/**` and `agents/daily-brief/**` — never touches another
agent's path-partition (`Mail/**`, `Finance/**`, `agents/<other>/**`, etc.).

## Failure behavior

A compose failure (malformed model output after the retry, or the Claude
call itself throwing) is loud, not silent: the run log is still written
(`ok: false`, a short note describing the failure) and pushed on its own,
then the error is rethrown so the GitHub Actions job itself shows red.
Nothing is written under `Briefs/**` on that path — a missing brief (Home
renders nothing) is always preferred over a malformed one.

## Running it

```bash
export VAULT_DIR=/path/to/a/local/clone/of/LiveOS-VaultRepo
export ANTHROPIC_API_KEY=...
node agents/daily-brief/brief.mjs
```

`VAULT_DIR` must be a git clone of `LiveOS-VaultRepo` with push access
configured (see `docs/agents/vault-tokens.md`).

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VAULT_DIR` | Yes | Path to a `LiveOS-VaultRepo` clone |
| `ANTHROPIC_API_KEY` | Yes | Claude compose call (`claude-sonnet-5`) |

## Vault contract

`Briefs/<date>.md` — exactly 5 `- ` bullet lines when the run succeeded:

```
# Briefs/2026-07-23.md

- Win: ship the S50 daily brief agent.
- 10:00 Client call — NorthStar handoff.
- Meera (NorthStar) is waiting 26h on a quote.
- Course study block is on a 6-day streak — keep it alive.
- Net worth is ₹18.4L, up 2.1% this month.
```

The PWA-side read parser is `src/vault/briefs.ts`'s `parseBrief` +
`latestBriefPath` — both sides compute the identical `Briefs/<date>.md` path
for the same date, and `parseBrief` is tolerant of a missing/malformed file
(returns `[]`, never throws).

## Tests

```bash
npx vitest run agents/daily-brief/brief.test.mjs
```

Fixture vault is a real temp directory tree (tasks/habits/calendar/mail/
finance-shaped `.md` files); Claude is entirely mocked via the `callClaude`
injection seam — zero live network calls anywhere in the suite. Written
output is round-tripped through the real `src/vault/briefs.ts` parser.
Covers: exactly-5-lines on success, the context pack's char cap, the
retry-once-then-succeed path, and the retry-once-then-fail-loudly path
(asserts `runLog`'s `ok: false` record is written and pushed, and that
nothing lands under `Briefs/**`).
