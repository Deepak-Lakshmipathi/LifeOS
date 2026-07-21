---
name: lifeos-close
description: Close out a LifeOS work session — splice the volatile head of HANDOFF.md (recap, push banner, NEXT SESSION, session lessons) from computed state, leave the stable body untouched unless a fact changed, then refresh the graphify graph + rebuild the hub. Use at the END of every LifeOS session, or when the user says /lifeos-close, "close out", "wrap up", "end the session", "write the handoff", or "update the handoff". The counterpart to lifeos-boot.
argument-hint: "optional: one-line focus for the next session"
---

# LifeOS session close

Counterpart to `lifeos-boot`. Boot READS the handoff head → sitrep → starts work.
Close COMPUTES this session's delta → splices the handoff head → refreshes the
graph + hub. Deterministic parts come from `state.mjs`; only the prose is written
by hand. **Never rewrite the stable body just to touch it** — that's how a handoff
rots into noise.

## Step 1 — Compute state (do not eyeball it)

```
node .claude/skills/lifeos-boot/scripts/state.mjs      # board counts, unblocked heads by wave, open PRs/issues, dirty tree
git fetch origin                                        # so ahead/behind is TRUE, not a stale remote-tracking ref
git rev-list --left-right --count master...origin/master   # "<ahead> <behind>"
git log origin/master..master --oneline                 # the exact local-ahead commits for the push banner
```

`git fetch` first is non-negotiable: `gh pr merge` lands squashes on origin
server-side and the local remote-tracking ref goes stale, so ahead/behind reads
wrong until you fetch (this is a recorded lesson — the banner was wrong last run).

## Step 2 — Splice the VOLATILE HEAD of HANDOFF.md (lines ~1–52)

Rewrite only these, in place:

1. **`Last updated: <date>.` recap paragraph** — full rewrite. What shipped THIS
   session: PRs merged (numbers), issues closed, board delta (done N→M), any new
   gate/lesson. Reference artifacts by path/URL — do NOT paste diffs or PRD text.
2. **`⚠️ ...` push banner** — recompute from Step 1. Format: `Master is <ahead>
   ahead of origin, <behind> behind — owner push pending.` List the ahead commits
   (hash + one-line) and whether a plain push fast-forwards (behind == 0) or needs
   `git fetch origin && git rebase origin/master` first (behind > 0). Push stays
   owner-gated — state the recovery command, never push.
3. **`> NEXT SESSION.` banner** — full rewrite from `state.mjs`: the unblocked
   heads grouped by wave (+ which chains they open), open issues/PRs, and the
   standing gates verbatim (triple-green; `[UI]` design-language + reduced-motion;
   any human-only gate like S16c). If the user passed a next-session focus arg,
   lead the banner with it.
4. **`Session lessons (<date>) —` block** — prepend a NEW dated block ONLY if this
   session produced operational lessons not already captured. afk-pipeline runs
   already write `afk-pipeline-out/LESSONS.md`; don't duplicate those — point to
   them. Keep each lesson one line, why + how-to-apply.

## Step 3 — Touch the stable body ONLY where a fact changed

Update in place, else leave exactly as-is:

- **`## Current state`** — bump the `tip <hash>` and the shipped-list bullets IF code shipped.
- **`## Outstanding board state`** — sync counts to `state.mjs`.
- **`## v2 progress`** — bump only if a phase/wave advanced.
- **`## Key files`** — add a row only for a notable NEW file this session created.
- **`## Deployment`**, **`## Outstanding HITL`** — only on an actual change.

Do NOT edit `## What LifeOS is`, `## Architecture`, `## Run it`, `## How work
ships here`, or the standing `## Lessons / gotchas` unless the underlying fact
genuinely moved. **Housekeeping (occasional):** when the dated `Session lessons`
blocks in the head pile up (>3–4), distill the oldest into one line each in the
standing `## Lessons / gotchas` list and delete the dated block — the head stays
skimmable, nothing is lost.

## Step 4 — Refresh the graph + hub

- **Graph:** `graphify-out/` exists → run `/graphify --update` (incremental —
  re-extracts only changed files). **Scope is enforced by `.graphifyignore` at the
  repo root — verify it exists before running, or graphify ingests vendored plugin
  code and personal data and blows the graph up.** It must exclude at minimum:
  `.claude/`, `.github/skills/`, `.github/hooks/` (vendored plugin code — this repo
  carries the impeccable/caveman/ponytail/graphify skills under BOTH dirs),
  `node_modules/`, `cors-proxy/node_modules/`, `dist/`, `test-results/`,
  `.worktrees/`, `graphify-out/`, `LifeOS-Vault/`, `**/.vault-clone/` (a clone of
  the private vault lives under `services/bot/.vault-clone/` — data, not source),
  `.obsidian/`, `lifeos-hub.html` + `seed_tasks*.json` + `package-lock.json`
  (generated/huge, embed base64). Sanity check after `detect_incremental`: if the
  changed-file count is in the hundreds, the ignore isn't catching something — stop
  and widen it before extracting. A correctly-scoped LifeOS corpus is ~220 files
  (~140 code + ~80 docs), not 800+.
- **Hub:** `node scripts/build-hub.mjs .` — regenerates `lifeos-hub.html`, which
  embeds the live kanban board (`#board-data`) + the graph. NEVER hand-edit
  `lifeos-hub.html`; it's generated and gets clobbered.

## Step 5 — Commit (local; push stays owner-gated)

```
git add HANDOFF.md lifeos-hub.html graphify-out/ afk-pipeline-out/
git commit -m "docs: handoff — <date>, <one-line recap>"
```

Do NOT push. Report the final ahead/behind and the owner's push/rebase command
(from Step 2's banner) as the last line, mirroring how boot ends with the sitrep.

## Rules

- The head is spliced from computed state; the stable body is touched surgically or not at all. A no-op diff on a stable section is a smell — revert it.
- `git fetch` before reading ahead/behind. Always.
- Push is owner-gated: compute + report the recovery command, never run it.
- `lifeos-hub.html` and `graphify-out/` are GENERATED — rebuild them, never hand-edit.
- Don't duplicate what other artifacts hold — afk-pipeline run manifests, `LESSONS.md`, ADRs, issues, commits. Reference by path.
- If `state.mjs` errors or the board disagrees with GitHub, say so and reconcile (GitHub = truth for issues/PRs, kanban = truth for waves) before writing the banner.
