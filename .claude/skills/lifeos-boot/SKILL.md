---
name: lifeos-boot
description: Boot a LifeOS work session — read the handoff + GitHub issues, derive exact project state (in-progress/ready/blocked), report a 5-line sitrep, then immediately start the next task. Use at the start of every LifeOS session, or when the user says /boot, "boot up", "where were we", "continue", "resume the project", "start the next task", or "what's next".
---

# LifeOS session boot

Cold start → working on the right thing in under a minute. Never re-derive
state by re-reading the whole repo: the script computes it.

**GitHub issues are the single source of truth** (since 2026-08-05). There is no
kanban file and no hub — `kanban.html`, `lifeos-hub.html` and
`scripts/build-hub.mjs` were deleted. An issue's **labels are its state**. There
are no waves.

## Step 1 — State (one command)

```
node .claude/skills/lifeos-boot/scripts/state.mjs
```

JSON out: issue counts by state · in-progress · **ready** (nothing open blocks
them) · blocked (with what blocks them) · needs-triage · **labelDrift** ·
cold-storage list · open PRs with CI colour · dirty tree · **ahead AND behind**
origin. Trust it over memory.

**The state model:**

| Label | Meaning |
|---|---|
| `status:in-progress` | started — an agent or PR is live on it |
| `status:ready` | unblocked, startable now |
| `status:blocked` | waiting on another issue (`Blocked by: #N` in the body) |
| `needs-triage` | filed, not yet ruled on |
| `cold-storage` + **closed** | parked on purpose. Real, reproducible, deliberately unscheduled. Reopen to revive |
| closed, no `cold-storage` | done |

`counts.done` is **closed GitHub issues**, not lifetime slices shipped — most of
S1–S66 predates issue-per-slice tracking. The historical card count lives in
HANDOFF.md; don't try to reconcile the two.

**`labelDrift` is not decoration — act on it.** It lists issues whose labels
contradict the computed frontier (labelled blocked but nothing blocks them,
labelled ready but blocked, no `status:` label at all). Fix the labels as part of
the sitrep; a board that lies is worse than no board.

## Step 2 — Context (read ONLY these, in order)

1. `HANDOFF.md` — first 40 lines only (the NEXT SESSION banner + gates).
2. The top 1–3 ready issues: `gh issue view <N>` — read the body, it carries the
   analysis. If a slice ticket exists for it, `docs/slices/slice-S##-*.md`.
3. Only if a rule is unclear: `docs/agents/afk-pipeline.md` (dispatch + the
   triple-green gate) or `docs/agents/triage-labels.md` (label vocabulary).

Do NOT re-read the design language, ADRs, or archive at boot — tickets carry
their own refs; load those lazily when implementing.

## Step 3 — Sitrep (5 lines, then act)

Report: ① position (done/in-progress/ready/blocked/cold), ② anything red (failed
CI, stale PR, dirty tree, **label drift**, **unpushed commits — check
`aheadOfOrigin`**), ③ outstanding human gates from the handoff banner, ④ the next
task + why it's next, ⑤ what you're starting NOW.

## Step 4 — Start the next task immediately

- **In-progress issue exists** (`status:in-progress` or an open PR)? Finish that
  first: check PR CI, run the eval gate if pending, merge on triple-green, then
  close the issue (`gh issue close <N>` — or let the PR's `closes #N` do it) and
  take the next.
- **Otherwise take the top ready issue.** Label it `status:in-progress`
  (`gh issue edit <N> --add-label status:in-progress --remove-label status:ready`)
  **before** dispatching, so a second session can't pick it up. If it has a
  ticket, its `## Dispatch` line says how — default is `/afk-pipeline auto` with
  the whole ticket file as input. If it has no ticket, the issue body IS the
  spec (the light path — see the afk-pipeline config).
- Two ready issues **MAY** dispatch in parallel only if their write-sets are
  disjoint. Waves are gone, so nothing computes this for you: read both tickets'
  write-sets and check by hand. Shared file → serialize, rebase-on-prior. The
  hard cap is **2 concurrent subagents**, and a slice needs an implementer plus
  two gate agents, so serial is usually the honest pace.

## Rules

- Merge gate is **triple-green**: CI (every job) + review + eval-subagent DoD
  check (`docs/agents/afk-pipeline.md` → "Eval gate"). No exceptions.
- Human-only gates (live verifies) are reported in the sitrep, never attempted.
- **Labels are the state — update them as work moves**, not at the end. An issue
  left `status:ready` while an agent works on it is how two sessions collide.
- If the script errors, say so in the sitrep and fall back to
  `gh issue list --state open`. GitHub is truth; there is no second board to
  reconcile against any more.
