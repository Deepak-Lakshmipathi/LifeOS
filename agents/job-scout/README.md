# job-scout agent (S46)

Runs on GitHub Actions on a nightly cron, scans two keyless job-board
sources — the [RemoteOK API](https://remoteok.com/api) and the
[HN "Who is hiring?" RSS feed](https://hnrss.org/whoishiring/newest) — and
appends matches to `Career/pipeline.md` in the
[`LiveOS-VaultRepo`](https://github.com/Deepak-Lakshmipathi/LiveOS-VaultRepo)
vault repo (branch `main`) in the exact contract defined by S43
(`src/vault/career.ts`). Owns `Career/pipeline.md` writes and nothing else —
never touches `Career/courses.md` or an owner-managed pipeline line (see
`docs/agents/afk-pipeline.md` known hotspots and `docs/agents/vault-tokens.md`).

Browser-session job boards (LinkedIn, etc.) are explicitly out of scope for
this slice — see the ticket's Context — and would need to run from the PC,
not GitHub Actions.

## What it does

1. Reads `agents/job-scout/profile.md` — the owner-editable keyword/weight
   list and match threshold.
2. Fetches both sources (RemoteOK JSON API, HN whoishiring RSS) and
   normalizes each listing to `{company, role, url, tags, description}`.
3. Scores every listing against the profile: each keyword present as a
   whole word (case-insensitive) in the role/tags/description contributes
   its weight; score = matched weight ÷ total possible weight × 100.
4. Listings scoring at/above `profile.md`'s `threshold` are formatted as
   `Career/pipeline.md` lines and appended (never rewritten/reordered):

   ```
   - <company> — <role> (stage:: found) (match:: NN%) (source:: job-scout) (url:: …)
   ```

5. Dedup is by case-insensitive `company+role` against **every** existing
   pipeline line (any stage — an owner's already-applied line suppresses a
   re-find), plus within the incoming batch itself (two sources returning
   the same posting).
6. Commits + pushes `Career/pipeline.md` via `agents/lib/push.mjs`'s
   `commitAndPush` (shared fleet wrapper — stages only the named file,
   retries a rejected push with `pull --rebase` + jittered backoff). If
   nothing cleared the threshold, the run is a no-op — no commit.

## Tuning matches

Edit `agents/job-scout/profile.md` — no code change needed. It's a plain
`keyword: weight` list plus a `threshold: NN` line; see the file's own
comments for the scoring formula.

## Running it

### On GitHub Actions (normal operation)

`.github/workflows/agent-job-scout.yml` runs this automatically: nightly at
02:00 IST, plus on-demand via the Actions tab ("Run workflow" —
`workflow_dispatch`). No manual steps needed once the secret below is
provisioned.

### Locally (manual / debugging)

```bash
# From the repo root, with dependencies installed (npm ci).
export VAULT_DIR=/path/to/a/local/clone/of/LiveOS-VaultRepo
node agents/job-scout/scout.mjs
```

`VAULT_DIR` must point at a git clone of `LiveOS-VaultRepo` with push
access configured locally (your own credentials, not the agent's scoped
PAT — that PAT is Actions-only, see below).

## Secrets

One GitHub Actions repo secret, scoped to this repo
(`Deepak-Lakshmipathi/LifeOS`) since that's where the workflow runs, even
though it grants write access to the *other* repo (`LiveOS-VaultRepo`):

| Secret | Purpose | Where it comes from |
|---|---|---|
| `AGENT_VAULT_PAT_CAREER` | Push access to `LiveOS-VaultRepo`, `Career/**` only | GitHub fine-grained PAT — `Contents: Read and write` on `LiveOS-VaultRepo` only. See `docs/agents/vault-tokens.md` for the full provisioning procedure and rotation checklist (this agent's row is already listed there). |

Neither RemoteOK's API nor HN's RSS feed requires a key/token.

### Setting the secret via `gh`

```bash
gh secret set AGENT_VAULT_PAT_CAREER --repo Deepak-Lakshmipathi/LifeOS
```

Prompts for the value on stdin — never pass secret values as a CLI
argument (shell history) or paste them into a commit, PR, or issue.

## Rotation

Follow the general rotation checklist in `docs/agents/vault-tokens.md` for
`AGENT_VAULT_PAT_CAREER` (generate replacement → update the Actions
secret value → confirm next run pushes cleanly → revoke the old token).

## Tests

`agents/job-scout/scout.test.mjs` — fixture RemoteOK JSON + HN RSS text
mapped through the normalizer and scorer, with the resulting lines
round-tripped through the real S43 parser (`src/vault/career.ts`) to prove
they parse to `stage: found` entries with `match`/`source` set (DoD #1).
Also covers: dedup against an existing pipeline file, including a byte
assert that owner-managed lines are untouched (DoD #2); the scorer as a
pure function; both source fetchers against a mocked `fetch`; and a full
`run()` pass against a temp-dir vault clone with an injected mock `push` —
**zero live network, zero live git**, per the repo's AFK test policy
(`docs/agents/afk-pipeline.md`).

```bash
npx vitest run agents/job-scout/scout.test.mjs
```
