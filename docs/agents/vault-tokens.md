# Vault access tokens — per-agent inventory

Security floor for the fleet (S57): **every agent that writes to the vault
gets its own fine-grained GitHub PAT.** Revoking one agent's token never
touches another's — no shared credential to rotate blast-radius-wide when a
single agent misbehaves or a secret leaks.

This doc is an **inventory of scopes and provisioning steps only.** It never
contains a real token value, and no real token value should ever be pasted
into a PR, commit message, issue, or this file. Secrets live exclusively in
GitHub Actions repo secrets, the PC's OS credential manager, or a
gitignored `.env` on the VPS — never in the repo.

## Principle: least privilege, path-partitioned identity

Every agent below is a Sonnet-tier scheduled process that writes to its own
subtree of `LiveOS-VaultRepo` (`Calendar/**`, `Mail/**`, `Career/**`,
`Briefs/**`, `Finance/**`, or supervisor-only paths) and pushes through the
shared wrapper (`agents/lib/push.mjs`, S57). The token only needs to let that
one process write; it does not need org access, workflow access, or any
scope beyond the single vault repo's contents.

**Fine-grained PAT settings, every row below:**
- **Repository access:** "Only select repositories" → `LiveOS-VaultRepo` only. Never "All repositories."
- **Permissions:** `Contents: Read and write`. Nothing else — no Actions, no Administration, no Metadata beyond the default read GitHub requires.
- **Expiration:** 90 days max (GitHub's fine-grained PATs cap at 1 year; this fleet uses the shortest practical window so a forgotten leaked token expires itself).
- **Owner:** the repo owner's GitHub account (agents act as the owner, scoped down by token permission — not as separate GitHub users/bot accounts, since LiveOS-VaultRepo has one human owner today).

## Token inventory

| Agent | Secret name | Scope | Stored in | Rotation |
|---|---|---|---|---|
| Calendar-sync (S35) | `AGENT_VAULT_PAT_CALENDAR` | Contents: R/W, `LiveOS-VaultRepo` only; writes `Calendar/**` | GH Actions repo secret (runs on a cron + `workflow_dispatch` workflow) | Regenerate fine-grained PAT in GitHub settings → update the Actions secret value → old token can be revoked immediately (workflow's next scheduled run picks up the new secret; no code change). |
| Email-triage (S38) | `AGENT_VAULT_PAT_MAIL` | Contents: R/W, `LiveOS-VaultRepo` only; writes `Mail/**` | GH Actions repo secret | Same as above. |
| Career/job-scout (S46) | `AGENT_VAULT_PAT_CAREER` | Contents: R/W, `LiveOS-VaultRepo` only; writes `Career/**` | GH Actions repo secret | Same as above. |
| Daily-brief (S50) | `AGENT_VAULT_PAT_BRIEFS` | Contents: R/W, `LiveOS-VaultRepo` only; writes `Briefs/**` | GH Actions repo secret | Same as above. |
| Supervisor (S55) | `AGENT_VAULT_PAT_SUPERVISOR` | Contents: R/W, `LiveOS-VaultRepo` only; writes supervisor proposal paths only (never sets `status: approved` — human-only, per S55 DoD) | GH Actions repo secret | Same as above. |
| Finance-sync (S42) | `AGENT_VAULT_PAT_FINANCE` | Contents: R/W, `LiveOS-VaultRepo` only; writes `Finance/**` | GH Actions repo secret | Same as above. |
| Telegram bot (v1, existing) | `BOT_VAULT_PAT` | Contents: R/W, `LiveOS-VaultRepo` only; writes wherever the router dispatches (broadest existing scope — pre-dates path-partitioned agents) | VPS `.env` (gitignored; bot runs long-lived, not in GH Actions) — see `services/bot/.env.example` | Regenerate fine-grained PAT → update the VPS `.env` → restart the bot process → revoke old token once the bot confirms a successful push on the new one. |
| PWA runtime PAT (v1, existing) | *(no fixed secret name — user-supplied, browser-only)* | Contents: R/W, `LiveOS-VaultRepo` only; scope chosen by whoever pastes it | Browser `localStorage` only (`lifeos_vault_pat` key, see `src/vault/pat.ts`) — never in a build artifact, never server-side. `VITE_VAULT_PAT` env var is a **dev-only** fallback (stripped from production builds by the `import.meta.env.DEV` guard) | User generates a new fine-grained PAT → pastes it in via the PWA's prompt (overwrites `localStorage`) → revokes the old token in GitHub settings. No code or infra change needed. |

## Provisioning a new agent token (procedure, no values)

1. GitHub → Settings → Developer settings → Fine-grained personal access tokens → Generate new token.
2. Resource owner: the vault repo's owning account. Repository access: only `LiveOS-VaultRepo`.
3. Permissions: Contents → Read and write. Leave every other permission at its default (no access).
4. Set expiration to 90 days (or the shortest option ≥ the agent's expected review cycle).
5. Generate, copy the value **once** — GitHub never shows it again.
6. Store it in the destination for that agent (GH Actions repo secret for scheduled-workflow agents; VPS `.env` for the long-lived bot; never both, never in the repo).
7. Confirm the agent's next run pushes successfully, then discard any local clipboard/shell history that touched the value (`history -d`, clear clipboard, close the terminal tab you pasted into).

## Rotation checklist (any agent)

1. Generate the replacement token following the provisioning steps above — do this *before* revoking the old one, so there's no gap where the agent can't push.
2. Update the one storage location that agent uses (Actions secret, or VPS `.env`, or the PWA's localStorage prompt).
3. Trigger or wait for the agent's next run; confirm it pushes cleanly (check the commit's author line matches that agent's identity, and the vault repo's commit history shows the push landed).
4. Revoke the old token in GitHub settings (Developer settings → Fine-grained tokens → the old token → Revoke).
5. If rotation was triggered by a suspected leak (token pasted somewhere public, committed by accident, etc.): revoke **first**, accept the agent will fail its next run, then provision + restore — never leave a leaked token live while "getting around to" rotation.

## What this doc is not

- Not a place to record actual token strings, partial tokens, or token
  prefixes — GitHub fine-grained PATs are `github_pat_...`; if you ever see
  that prefix in a diff, treat it as a live secret and revoke it immediately
  regardless of which file it appeared in.
- Not the mechanism enforcing least privilege — GitHub's permission model
  is. This doc just records what each agent's token *should* be scoped to,
  so a reviewer can catch an over-scoped token at PR time (a workflow yml
  referencing a `*_VAULT_PAT` secret with `Administration` or
  organization-level access is a red flag, not a variant).
