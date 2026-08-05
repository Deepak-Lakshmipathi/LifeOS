---
name: lifeos-close
description: Close out a LifeOS work session — reconcile GitHub issue labels with what actually happened, then splice the volatile head of HANDOFF.md (recap, push banner, NEXT SESSION, session lessons) from computed state, leaving the stable body untouched unless a fact changed. Use at the END of every LifeOS session, or when the user says /lifeos-close, "close out", "wrap up", "end the session", "write the handoff", or "update the handoff". The counterpart to lifeos-boot.
argument-hint: "optional: one-line focus for the next session"
---

# LifeOS session close

Counterpart to `lifeos-boot`. Boot READS state → sitrep → starts work.
Close RECONCILES state → splices the handoff head. Deterministic parts come from
`state.mjs`; only the prose is written by hand. **Never rewrite the stable body
just to touch it** — that's how a handoff rots into noise.

**GitHub issues are the single source of truth** (since 2026-08-05). No kanban,
no hub, no waves. Labels ARE the state — closing a session means leaving them
true.

## Step 1 — Compute state (do not eyeball it)

```
node .claude/skills/lifeos-boot/scripts/state.mjs
```

It runs `git fetch` itself and reports **ahead AND behind**. The ahead-count is
load-bearing: on 2026-08-04 a close banner claimed "0 ahead, 0 behind — nothing
owed" while its own handoff commit sat unpushed, because the script only reported
*behind*. Never write a push banner from anything else.

## Step 2 — Reconcile the labels FIRST (before any prose)

The handoff describes state; the labels *are* state. Fix them before writing
about them:

- Every issue closed by a merged PR this session → confirm it actually closed
  (`gh issue view <N> --json state`). A `closes #N` that didn't fire is common
  when the PR was squashed with an edited body.
- Anything still `status:in-progress` that is NOT in flight → move back to
  `status:ready`, or to `status:blocked` with a `Blocked by: #N` line in the body.
- **`labelDrift` from the script must be empty when you finish.** If it isn't,
  either the labels or the `Blocked by:` lines are wrong — fix, re-run, confirm.
- Parked work → `cold-storage` label **and close it**, with a comment saying it
  is a parking decision, not a verdict. Cold storage is closed-but-revivable;
  never delete an issue to park it.
- New follow-ups discovered this session → filed **now**, not "next session".

## Step 3 — Splice the VOLATILE HEAD of HANDOFF.md

Rewrite only these, in place:

1. **`Last updated: <date>.` recap paragraph** — full rewrite. What shipped THIS
   session: PRs merged (numbers), issues closed, any new gate/lesson. Reference
   artifacts by path/URL — do NOT paste diffs or PRD text.
2. **push banner** — recompute from Step 1. Format: `Master is <ahead> ahead of
   origin, <behind> behind — owner push pending.` List the ahead commits (hash +
   one-line) and whether a plain push fast-forwards (behind == 0) or needs
   `git fetch origin && git rebase origin/master` first. Push stays owner-gated —
   state the recovery command, never push.
3. **`> NEXT SESSION.` banner** — full rewrite from `state.mjs`: the ready issues
   (+ what they unblock), open PRs, cold-storage count, and the standing gates
   verbatim (triple-green; `[UI]` design-language + reduced-motion; any human-only
   gate). If the user passed a next-session focus arg, lead with it.
4. **`Session lessons (<date>) —` block** — prepend a NEW dated block ONLY if this
   session produced operational lessons not already captured. afk-pipeline runs
   already write `afk-pipeline-out/LESSONS.md`; don't duplicate those — point to
   them. One line each, why + how-to-apply.

## Step 4 — Touch the stable body ONLY where a fact changed

Update in place, else leave exactly as-is:

- **`## Outstanding board state`** — sync to `state.mjs`. Note that
  `counts.done` is *closed issues*, not lifetime slices; the historical S1–S66
  card count is archival prose and does not get recomputed.
- **`## Key files`** — add a row only for a notable NEW file this session created.
- **`## Deployment`**, **`## Outstanding HITL`** — only on an actual change. A new
  human-only gate MUST be added here, not just mentioned in the head.

Do NOT edit `## What LifeOS is`, `## Architecture`, `## Run it`, `## How work
ships here`, `## Current state` (archival v1 snapshot — never bump its hash), or
the standing `## Lessons / gotchas` unless the underlying fact genuinely moved.

**Housekeeping (defer-with-note allowed):** when the dated `Session lessons`
blocks pile up (>3–4), distill the oldest into one line each in the standing
`## Lessons / gotchas` list and delete the dated block. Not a hard gate — leave a
"distillation due next close" note and defer, but never let it grow unbounded.

## Step 5 — Refresh the graph

`graphify-out/` exists → the graph is a build artifact of the corpus, so refresh
it when source actually moved.

- **`/graphify --update` is BROKEN in this repo** — `detect_incremental` marks the
  whole corpus changed AND the semantic cache returns ~1 node per file, so an
  incremental run silently produces a much poorer graph and trips graphify's own
  overwrite guard. **Run full rebuilds until that is fixed**, bypassing the
  semantic cache.
- A full rebuild is a **7-subagent job** (dispatched in pairs — never more than 2
  concurrent) and needs **owner approval**. For a small delta it is not worth it:
  **skip it and record the staleness in the NEXT SESSION banner**, naming what the
  graph does not yet know. An unrecorded stale graph is the failure; a recorded
  one is fine.
- Scope is enforced by `.graphifyignore` at the repo root — verify it exists
  before running. It must exclude at minimum `.claude/`, `.github/skills/`,
  `.github/hooks/` (vendored plugin code), `node_modules/`,
  `cors-proxy/node_modules/`, `dist/`, `test-results/`, `.worktrees/`,
  `graphify-out/`, `LifeOS-Vault/`, `.vault-clone/` (at any depth),
  `.obsidian/`, `seed_tasks*.json`, `package-lock.json`, `public/icons/`.
  Sanity check after `detect_incremental`: a changed-file count in the hundreds
  means the ignore isn't catching something — stop and widen it before extracting.
- **Never force the overwrite guard on a node-count drop without first inspecting
  the composition of what you'd lose.** The 2747 → 1677 drop was a quality win
  (546 slice-section headings and 100 JSON field names out; concept+rationale
  7% → 15%).

## Step 6 — Commit (local; push stays owner-gated)

```
git add HANDOFF.md graphify-out/ afk-pipeline-out/
git commit -m "docs: handoff — <date>, <one-line recap>"
```

Do NOT push. Report the final ahead/behind and the owner's push/rebase command
(from Step 3's banner) as the last line, mirroring how boot ends with the sitrep.

## Rules

- Labels are reconciled BEFORE the prose. The handoff describes state; it is not allowed to be the only place state lives.
- `labelDrift` must be empty at close.
- The head is spliced from computed state; the stable body is touched surgically or not at all. A no-op diff on a stable section is a smell — revert it.
- Push is owner-gated: compute + report the recovery command, never run it.
- `graphify-out/` is GENERATED — rebuild it, never hand-edit. Skipping a rebuild is allowed; hiding that you skipped it is not.
- Don't duplicate what other artifacts hold — afk-pipeline run manifests, `LESSONS.md`, ADRs, issues, commits. Reference by path.
- Cold storage = `cold-storage` label + closed. Never delete an issue to park it.
