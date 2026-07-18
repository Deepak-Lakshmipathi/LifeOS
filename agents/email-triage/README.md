# email-triage agent (S38)

Producer agent for the Mail slice of the Attention stack. Runs on GitHub
Actions on a cron, reads recent unread/starred Gmail messages, classifies
each thread with Claude (structured output, same request shape as
`services/bot/nlu.ts`), and writes `Mail/attention.md` plus canned-reply
drafts under `Mail/drafts/*.md` in the
[`LiveOS-VaultRepo`](https://github.com/Deepak-Lakshmipathi/LiveOS-VaultRepo)
vault repo (branch `main`) in the exact contract defined by S36
(`src/vault/mail.ts`'s `parseAttention`). Owns `Mail/**` and nothing else —
a strict path-partition shared with no other agent (see
`docs/agents/afk-pipeline.md` known hotspots and
`docs/agents/vault-tokens.md`).

## What it does

1. Exchanges a long-lived Google OAuth refresh token for a short-lived
   access token (scope `https://www.googleapis.com/auth/gmail.readonly`).
2. Fetches recent unread + starred threads from the owner's primary
   inbox via the Gmail API (newest first, capped to a reasonable batch).
3. For each thread, calls Claude with a JSON-schema-constrained structured
   output `{label, urgent, needsDraft, draftBody?}` — `label` is from the
   S36 vocabulary (one of the 5 attention categories), `urgent` flags
   immediate attention, `needsDraft` opts the thread into draft
   generation, and `draftBody` is a short canned reply when set.
4. Renders `Mail/attention.md` (urgent-first ordering) and commits +
   pushes it via `agents/lib/push.mjs`'s `commitAndPush` (shared fleet
   wrapper — stages only the named file, retries a rejected push with
   `pull --rebase` + jittered backoff).
5. For every thread where `needsDraft: true`, writes
   `Mail/drafts/<YYYY-MM-DD>-<slug>.md` with a YAML-style front matter
   header (thread id, recipient, subject) and the canned body — each draft
   is a separate file so the owner can review/edit before sending.

## Running it

### On GitHub Actions (normal operation)

`.github/workflows/agent-email-triage.yml` runs this automatically: every
hour on the hour (plus on-demand via the Actions tab "Run workflow" —
`workflow_dispatch`). Hourly cadence catches the inbox before it goes
stale without burning Claude API tokens on an empty inbox. No manual
steps needed once the secrets below are provisioned.

### Locally (manual / debugging)

```bash
# From the repo root, with dependencies installed (npm ci).
export VAULT_DIR=/path/to/a/local/clone/of/LiveOS-VaultRepo
export GMAIL_CLIENT_ID=...
export GMAIL_CLIENT_SECRET=...
export GMAIL_REFRESH_TOKEN=...
export ANTHROPIC_API_KEY=...
node agents/email-triage/triage.mjs
```

`VAULT_DIR` must point at a git clone of `LiveOS-VaultRepo` with push
access configured locally (your own credentials, not the agent's scoped
PAT — that PAT is Actions-only, see below).

## Secrets

Four GitHub Actions repo secrets, all scoped to this repo
(`Deepak-Lakshmipathi/LifeOS`) since that's where the workflow runs, even
though `AGENT_VAULT_PAT_MAIL` grants write access to the *other* repo
(`LiveOS-VaultRepo`):

| Secret | Purpose | Where it comes from |
|---|---|---|
| `GMAIL_CLIENT_ID` | Google OAuth client ID | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs |
| `GMAIL_CLIENT_SECRET` | Google OAuth client secret | Same Credentials page, paired with the client ID above |
| `GMAIL_REFRESH_TOKEN` | Long-lived refresh token for the mail owner's account | Obtained once via the OAuth consent flow with scope `https://www.googleapis.com/auth/gmail.readonly` (read-only — this agent never sends, modifies, or deletes mail) |
| `ANTHROPIC_API_KEY` | Claude classification call | Anthropic Console → API Keys |
| `AGENT_VAULT_PAT_MAIL` | Push access to `LiveOS-VaultRepo` | GitHub fine-grained PAT — `Contents: Read and write` on `LiveOS-VaultRepo` only. See `docs/agents/vault-tokens.md` for the full provisioning procedure and rotation checklist (this agent's row is already listed there). |

### Google Cloud Console setup (one-time)

1. Create (or reuse) a Google Cloud project. Enable the **Gmail API**
   (APIs & Services → Library).
2. Configure the OAuth consent screen (External or Internal, per the
   account type) if not already done.
3. Create an **OAuth 2.0 Client ID** (Application type: "Desktop app" is
   simplest for a one-time manual consent flow) → note the client ID and
   client secret → these become `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`.
4. Run the OAuth consent flow **once**, manually, requesting scope
   `https://www.googleapis.com/auth/gmail.readonly` (read-only —
   this agent never writes to Gmail). Any standard OAuth playground /
   local script using the client ID+secret from step 3 works; the goal is
   a `refresh_token` in the response. Capture it — Google only returns
   a refresh token on the first consent (or after a forced re-consent,
   `prompt=consent`).
5. Store the resulting refresh token as `GMAIL_REFRESH_TOKEN`.
6. Set all five secrets: GitHub repo → Settings → Secrets and variables →
   Actions → New repository secret (one per row in the table above).

### Setting the secrets via `gh`

```bash
gh secret set GMAIL_CLIENT_ID --repo Deepak-Lakshmipathi/LifeOS
gh secret set GMAIL_CLIENT_SECRET --repo Deepak-Lakshmipathi/LifeOS
gh secret set GMAIL_REFRESH_TOKEN --repo Deepak-Lakshmipathi/LifeOS
gh secret set ANTHROPIC_API_KEY --repo Deepak-Lakshmipathi/LifeOS
gh secret set AGENT_VAULT_PAT_MAIL --repo Deepak-Lakshmipathi/LifeOS
```

Each prompts for the value on stdin — never pass secret values as a CLI
argument (shell history) or paste them into a commit, PR, or issue.

## Rotation

Follow the general rotation checklist in `docs/agents/vault-tokens.md` for
`AGENT_VAULT_PAT_MAIL` (generate replacement → update the Actions secret
→ confirm next run pushes cleanly → revoke the old token).

For the Google OAuth credentials: revoking `GMAIL_REFRESH_TOKEN` access is
done from the Google Account's
[connected apps page](https://myaccount.google.com/permissions) (revoke the
OAuth client's access) — repeat the consent flow (step 4 above) to mint
a new refresh token, then update the `GMAIL_REFRESH_TOKEN` secret.
Rotate `GMAIL_CLIENT_SECRET` from the same Cloud Console Credentials
page as provisioning; update the secret immediately after regenerating
(the old client secret stops working the moment a new one is issued).

`ANTHROPIC_API_KEY` rotation is done from the Anthropic Console (revoke
old key → generate new → update the secret).

## Prompt change policy

The classification prompt is owner-editable inline in
`agents/email-triage/triage.mjs` today (no separate prompt file). When
the supervisor agent ships (S55), prompt-change proposals will flow
through the supervisor contract (`src/vault/supervisor.ts`) and require
owner approval before merge — until then, prompt changes are just
PRs to this directory.

## Tests

`agents/email-triage/triage.test.mjs` — pure-mapper roundtrip: a fixture
Gmail API response (thread list) is classified against mocked Claude
responses, the resulting `Mail/attention.md` is parsed back through the
real S36 parser (`src/vault/mail.ts`) to prove it round-trips losslessly
(labels, waiting, draft pointers), and the generated draft files match
the expected `<date>-<slug>.md` naming. Also covers the OAuth token
exchange and Gmail API fetch against a mocked `fetch`, and a full `run()`
pass against a temp-dir vault clone with an injected mock `push` —
**zero live network, zero live git**, per the repo's AFK test policy
(`docs/agents/afk-pipeline.md`).

```bash
npx vitest run agents/email-triage/triage.test.mjs
```
