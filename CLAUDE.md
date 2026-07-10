# LifeOS

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `Deepak-Lakshmipathi/LifeOS` (via the `gh` CLI); external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`); `status:ready`/`status:blocked` are kanban states, not triage roles. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### AFK pipeline config

Per-repo constitution for the `afk-pipeline` skill (target repo, test policy, flake fingerprints, model tiers, hotspots): `docs/agents/afk-pipeline.md`. Lessons ledger + run manifests: `afk-pipeline-out/`.
