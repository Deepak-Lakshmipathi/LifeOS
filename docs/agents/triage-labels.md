# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

`ready-for-agent` and `wontfix` already exist on the repo; `needs-triage`, `needs-info`, and `ready-for-human` don't yet — create each on first use (`gh label create <name>`).

## Adjacent labels (not triage roles)

The afk-pipeline also uses **workflow-state** labels — `status:ready` (no incomplete blockers — grab now), `status:blocked` (waiting on a blocker named `Blocked by: #N` in the body), and `status:in-progress` (an agent or PR is live on it; set this BEFORE dispatching so a second session can't pick the same issue up). These are dispatch states layered on top of `ready-for-agent`, not triage roles; don't substitute them for the table above. Category labels `bug` / `enhancement` ride alongside as usual.

**`cold-storage` (added 2026-08-05)** — parked on purpose: real, reproducible, deliberately unscheduled. It is applied **together with closing the issue**, and the closing comment must say it is a parking decision rather than a verdict on the bug. Distinct from `wontfix`, which means the thing will *not* be done; cold storage means *not now*, and reopening is the revival path. Never delete an issue to park it.

**Since 2026-08-05, GitHub issues are the single source of truth for project state** — labels ARE the state, and `.claude/skills/lifeos-boot/scripts/state.mjs` computes the frontier from them. There is no kanban file, no hub, and no waves. An issue with no `status:` label and no `needs-triage` is reported as drift by that script and must be fixed, not ignored.
