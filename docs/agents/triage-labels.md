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

The afk-pipeline also uses **kanban-state** labels — `status:ready` (no incomplete blockers — grab now) and `status:blocked` (waiting on a blocker). These are dispatch states layered on top of `ready-for-agent`, not triage roles; don't substitute them for the table above. Category labels `bug` / `enhancement` ride alongside as usual.
