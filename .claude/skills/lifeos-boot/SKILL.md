---
name: lifeos-boot
description: Boot a LifeOS work session — read the handoff + kanban + tickets, derive exact project state (done/in-flight/unblocked), report a 5-line sitrep, then immediately start the next task. Use at the start of every LifeOS session, or when the user says /boot, "boot up", "where were we", "continue", "resume the project", "start the next task", or "what's next".
---

# LifeOS session boot

Cold start → working on the right thing in under a minute. Never re-derive
state by re-reading the whole repo: the script computes it.

## Step 1 — State (one command)

```
node .claude/skills/lifeos-boot/scripts/state.mjs
```

JSON out: board counts · in-progress cards · **unblocked** cards (all
`blockedBy` done) sorted by wave · open PRs/issues · dirty working tree ·
hotspot conflicts among unblocked cards. Trust it over memory.

## Step 2 — Context (read ONLY these, in order)

1. `HANDOFF.md` — first 40 lines only (the NEXT SESSION banner + gates).
2. The ticket file(s) of the top 1–3 unblocked cards: `docs/slices/slice-S##-*.md`.
3. Only if a rule is unclear: `docs/slices/README.md` (waves, hotspot chains,
   triple-green gate).

Do NOT re-read the design language, ADRs, or archive at boot — tickets carry
their own refs; load those lazily when implementing.

## Step 3 — Sitrep (5 lines, then act)

Report: ① board position (done/in-flight/unblocked), ② anything red (failed
CI, stale PR, dirty tree), ③ outstanding human gates from the handoff banner,
④ the next task + why it's next (wave + deps), ⑤ what you're starting NOW.

## Step 4 — Start the next task immediately

- **In-flight card exists** (column `progress` or open PR)? Finish that first:
  check PR CI, run the eval gate if pending, merge on triple-green, flip the
  card to `done` (edit `#board-data` in `kanban.html`), then take the next.
- **Otherwise take the top unblocked card**: read its ticket; its `## Dispatch`
  line says how — default is `/afk-pipeline auto` with the whole ticket file
  as input. Multiple unblocked cards with disjoint write-sets (script flags
  hotspot conflicts) MAY dispatch in parallel worktrees; hotspot-sharing cards
  NEVER (serialize, rebase-on-prior — v1 lesson).
- Move each started card to `progress` and stamp `issue`/`pr` numbers on it
  as they exist. Keep `#board-data` valid JSON.

## Rules

- Merge gate is **triple-green**: CI + review + eval-subagent DoD check
  (`docs/agents/afk-pipeline.md` → "Eval gate"). No exceptions.
- Human-only gates (e.g. live verifies) are reported in the sitrep, never
  attempted.
- If the script errors or the board looks inconsistent with GitHub, say so in
  the sitrep and reconcile (GitHub is truth for issues/PRs, kanban for waves).
