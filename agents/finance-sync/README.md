# finance-sync agent (S42)

The one agent that runs on the owner's PC (not GitHub Actions). Kite Connect
needs a daily interactive login; Groww arrives as CSV downloads. This agent
pulls both, computes the Finance vault files, and pushes them in one atomic
commit.

## What it does

1. **Kite Connect** — fetches `/portfolio/holdings` (equity + MF
   bucketed by `isMF` flag) and `/user/margins` (cash balance).
2. **Groww CSV** — reads the latest CSV from the drop folder, parses
   `Date,Type,Amount` columns, computes income/spend for the current
   month and a cash-delta contribution to net worth.
3. **Compute** — net worth, portfolio buckets (Equity/Mutual funds/Cash),
   burn month-to-date. Net worth appended to history only when month
   changed or value moved >1% (avoids spamming the series).
4. **Write + push** — all three files (`Finance/networth-history.md`,
   `Finance/portfolio.md`, `Finance/burn.md`) written to the vault clone,
   then committed as `finance-sync: <date>` and pushed via
   `agents/lib/push.mjs`.

`Finance/bills.md` is never touched — bills stay manual/gmail-fed.

## Running it

### Step 1: Interactive login (once per day, before sync)

```bash
export KITE_API_KEY=...
export KITE_API_SECRET=...
node agents/finance-sync/login.mjs
```

Opens the Kite login page in your browser. Log in; the redirect is caught
by a short-lived local server on port 3838 (configurable via
`KITE_REDIRECT_PORT`). The access token is saved to a user-local JSON
file — **never** into the repo or vault.

### Step 2: Run the sync

```bash
export VAULT_DIR=/path/to/a/local/clone/of/LiveOS-VaultRepo
export FINANCE_DROP_DIR=/path/to/groww/csv/exports
export KITE_API_KEY=...   # same as login.mjs
export KITE_ACCESS_TOKEN=... # or omitted — sync reads the saved token file
node agents/finance-sync/sync.mjs
```

`VAULT_DIR` must be a git clone of `LiveOS-VaultRepo` with push access
configured. `FINANCE_DROP_DIR` is the folder where Groww CSV exports land
(`groww-*.csv` naming convention; the latest file alphabetically wins).

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `KITE_API_KEY` | Yes | Kite Connect API key (login + sync) |
| `KITE_API_SECRET` | Yes (login) | Kite Connect API secret (login only) |
| `KITE_ACCESS_TOKEN` | No (sync) | Kite access token — if omitted, sync reads the saved token file from `login.mjs` |
| `KITE_REDIRECT_PORT` | No (login) | Local port for the OAuth redirect listener (default: 3838) |
| `FINANCE_DROP_DIR` | Yes (sync) | Path to the Groww CSV drop folder |
| `VAULT_DIR` | Yes (sync) | Path to a `LiveOS-VaultRepo` clone |

## Token storage

The access token is saved to a user-local path, **never** in the repo:

- **Windows:** `%APPDATA%/lifeos/kite-token.json`
- **macOS/Linux:** `~/.config/lifeos/kite-token.json`

This file contains `{"access_token": "...", "saved_at": "..."}` and has
mode `0600` on POSIX. Rotate the token daily (Kite tokens expire at
market close).

## CSV convention

Groww CSVs must have a `Date,Type,Amount` header. `Type` is `credit` or
`debit`. `Amount` is a positive number. `Date` is `YYYY-MM-DD`. Malformed
rows are silently skipped (matches the S39 parser convention).

Drop the file in `FINANCE_DROP_DIR` with any name ending in `.csv` — the
latest file alphabetically is picked.

## Tests

```bash
npx vitest run agents/finance-sync/sync.test.mjs
```

Fixtures are inline in the test file (Kite holdings + margins JSON, sample
CSV). Zero network, zero live git. All three written files round-trip
through the real S39 parsers (`src/vault/finance.ts`). Bills.md is
asserted never written. Atomicity is tested via an injected write failure.
