# LifeOS

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `Deepak-Lakshmipathi/LifeOS` (via the `gh` CLI); external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`); `status:ready`/`status:blocked`/`status:in-progress` are workflow states, not triage roles; `cold-storage` + closed means parked on purpose. See `docs/agents/triage-labels.md`.

**GitHub issues are the single source of truth for project state (since 2026-08-05)** — an issue's labels ARE its state. `kanban.html`, `lifeos-hub.html` and `scripts/build-hub.mjs` were deleted; there is no local board and no wave concept. Recover the old board from git history if you ever need it (`git show 7a06f62:kanban.html`).

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### AFK pipeline config

Per-repo constitution for the `afk-pipeline` skill (target repo, test policy, flake fingerprints, model tiers, hotspots): `docs/agents/afk-pipeline.md`. Lessons ledger + run manifests: `afk-pipeline-out/`.
