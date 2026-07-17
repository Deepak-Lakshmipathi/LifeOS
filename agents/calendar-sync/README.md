# calendar-sync agent (S35)

First producer agent in the vault fleet. Runs on GitHub Actions on a cron,
reads today's Google Calendar events, and writes `Calendar/today.md` in the
[`LiveOS-VaultRepo`](https://github.com/Deepak-Lakshmipathi/LiveOS-VaultRepo)
vault repo (branch `main`) in the exact contract defined by S33
(`src/vault/calendar.ts`). Owns `Calendar/**` and nothing else — a strict
path-partition shared with no other agent (see `docs/agents/afk-pipeline.md`
known hotspots and `docs/agents/vault-tokens.md`).

## What it does

1. Exchanges a long-lived Google OAuth refresh token for a short-lived
   access token.
2. Fetches today's events (single-day window, recurring events expanded)
   from the primary Google Calendar.
3. Maps each event to the S33 contract shape (`{start, end, title, type}`,
   `HH:MM` 24h), classifying `type` from a keyword map on the event summary
   (`call | deep | gym`, default `other`). All-day events and events missing
   a usable start/end are skipped — never thrown.
4. Renders `Calendar/today.md` and commits + pushes it via
   `agents/lib/push.mjs`'s `commitAndPush` (shared fleet wrapper — stages
   only the named file, retries a rejected push with `pull --rebase` +
   jittered backoff).
5. Records a run status line via `agents/lib/runLog.mjs` (S47 contract),
   in a **separate** commit from the calendar write, so the calendar
   commit itself never touches anything outside `Calendar/today.md`.

## Running it

### On GitHub Actions (normal operation)

`.github/workflows/agent-calendar-sync.yml` runs this automatically:
every 30 minutes, 05:00–23:00 IST, plus on-demand via the Actions tab
("Run workflow" — `workflow_dispatch`). No manual steps needed once the
secrets below are provisioned.

### Locally (manual / debugging)

```bash
# From the repo root, with dependencies installed (npm ci).
export VAULT_DIR=/path/to/a/local/clone/of/LiveOS-VaultRepo
export GCAL_CLIENT_ID=...
export GCAL_CLIENT_SECRET=...
export GCAL_REFRESH_TOKEN=...
node agents/calendar-sync/sync.mjs
```

`VAULT_DIR` must point at a git clone of `LiveOS-VaultRepo` with push
access configured locally (your own credentials, not the agent's scoped
PAT — that PAT is Actions-only, see below).

## Secrets

Four GitHub Actions repo secrets, all scoped to this repo
(`Deepak-Lakshmipathi/LifeOS`) since that's where the workflow runs, even
though `AGENT_VAULT_PAT_CALENDAR` grants write access to the *other* repo
(`LiveOS-VaultRepo`):

| Secret | Purpose | Where it comes from |
|---|---|---|
| `GCAL_CLIENT_ID` | Google OAuth client ID | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs |
| `GCAL_CLIENT_SECRET` | Google OAuth client secret | Same Credentials page, paired with the client ID above |
| `GCAL_REFRESH_TOKEN` | Long-lived refresh token for the calendar owner's account | Obtained once via the OAuth consent flow with scope `https://www.googleapis.com/auth/calendar.readonly` (see below); does not expire unless revoked |
| `AGENT_VAULT_PAT_CALENDAR` | Push access to `LiveOS-VaultRepo` | GitHub fine-grained PAT — `Contents: Read and write` on `LiveOS-VaultRepo` only. See `docs/agents/vault-tokens.md` for the full provisioning procedure and rotation checklist (this agent's row is already listed there). |

### Google Cloud Console setup (one-time)

1. Create (or reuse) a Google Cloud project. Enable the **Google Calendar
   API** (APIs & Services → Library).
2. Configure the OAuth consent screen (External or Internal, per the
   account type) if not already done.
3. Create an **OAuth 2.0 Client ID** (Application type: "Desktop app" is
   simplest for a one-time manual consent flow) → note the client ID and
   client secret → these become `GCAL_CLIENT_ID` / `GCAL_CLIENT_SECRET`.
4. Run the OAuth consent flow **once**, manually, requesting scope
   `https://www.googleapis.com/auth/calendar.readonly` (read-only —
   this agent never writes to Google Calendar). Any standard OAuth
   playground / local script using the client ID+secret from step 3 works;
   the goal is a `refresh_token` in the response. Capture it —
   Google only returns a refresh token on the first consent (or after a
   forced re-consent, `prompt=consent`).
5. Store the resulting refresh token as `GCAL_REFRESH_TOKEN`.
6. Set all four secrets: GitHub repo → Settings → Secrets and variables →
   Actions → New repository secret (one per row in the table above).

### Setting the secrets via `gh`

```bash
gh secret set GCAL_CLIENT_ID --repo Deepak-Lakshmipathi/LifeOS
gh secret set GCAL_CLIENT_SECRET --repo Deepak-Lakshmipathi/LifeOS
gh secret set GCAL_REFRESH_TOKEN --repo Deepak-Lakshmipathi/LifeOS
gh secret set AGENT_VAULT_PAT_CALENDAR --repo Deepak-Lakshmipathi/LifeOS
```

Each prompts for the value on stdin — never pass secret values as a CLI
argument (shell history) or paste them into a commit, PR, or issue.

## Rotation

Follow the general rotation checklist in `docs/agents/vault-tokens.md` for
`AGENT_VAULT_PAT_CALENDAR` (generate replacement → update the Actions
secret → confirm next run pushes cleanly → revoke the old token).

For the Google OAuth credentials: revoking `GCAL_REFRESH_TOKEN` access is
done from the Google Account's
[connected apps page](https://myaccount.google.com/permissions) (revoke the
OAuth client's access) — repeat the consent flow (step 4 above) to mint a
new refresh token, then update the `GCAL_REFRESH_TOKEN` secret. Rotate
`GCAL_CLIENT_SECRET` from the same Cloud Console Credentials page as
provisioning; update the secret immediately after regenerating (the old
client secret stops working the moment a new one is issued).

## Tests

`agents/calendar-sync/sync.test.mjs` — pure-mapper roundtrip: a fixture
Google Calendar API response is mapped to markdown, and the markdown is
parsed back through the real S33 parser (`src/vault/calendar.ts`) to prove
it round-trips to the same events. Also covers the OAuth token exchange and
Calendar API fetch against a mocked `fetch`, and a full `run()` pass against
a temp-dir vault clone with an injected mock `push` — **zero live network,
zero live git**, per the repo's AFK test policy
(`docs/agents/afk-pipeline.md`).

```bash
npx vitest run agents/calendar-sync/sync.test.mjs
```
