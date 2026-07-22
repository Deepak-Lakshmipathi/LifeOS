# supervisor agent (S55)

The fleet's control plane. Runs on GitHub Actions weekly (Sunday 06:00 IST),
reads every OTHER agent's `agents/<name>/runs.jsonl` + `status.json` (the S47
run-log contract, `agents/lib/runLog.mjs`), computes per-agent metrics for
the trailing week, and writes the S52 weekly report
(`agents/supervisor/<date>.md`) plus zero or more proposals
(`proposals/<agent>-<date>.md`) in the
[`LiveOS-VaultRepo`](https://github.com/Deepak-Lakshmipathi/LiveOS-VaultRepo)
vault repo (branch `main`). Owns `agents/supervisor/**` and `proposals/**`
and nothing else — a strict path-partition shared with no other agent (see
`docs/agents/afk-pipeline.md` known hotspots and
`docs/agents/vault-tokens.md`).

## What it may do

- Read every fleet agent's `runs.jsonl`/`status.json` (read-only — never
  writes into another agent's directory).
- Compute metrics: run count, failure count, average/p50/p95 run duration,
  and staleness incidents (a consecutive-run gap exceeding
  `expected_cadence_min × 2`, per `audit.mjs`'s `STALENESS_MULTIPLIER`).
- Optionally sample up to **15** of an agent's runs and ask Claude to re-check
  whether the run's own note reads as a plausible/correct outcome.
- Write the weekly report to `agents/supervisor/<date>.md`.
- Write **proposals** — a template + a suggested change, `status: pending` —
  to `proposals/<agent>-<date>.md` when an agent's failure rate or sampled
  accuracy crosses a threshold.
- Log its own run via the shared S47 helper (`agents/lib/runLog.mjs`) under
  `agents/supervisor/runs.jsonl` / `agents/supervisor/status.json`.
- Commit + push those files via `agents/lib/push.mjs`'s `commitAndPush`
  (shared fleet wrapper — stages only the named files, retries a rejected
  push with `pull --rebase` + jittered backoff).

## What it may NEVER do

- **Never edit another agent's prompt, config, or code.** The supervisor's
  entire output is read-only observation + a proposal *document* — it never
  touches `agents/<other-agent>/**`.
- **Never write a proposal with any status other than `pending`.** This is
  enforced structurally, not just by convention: `renderProposalMarkdown` in
  `audit.mjs` writes the literal string `pending` directly into the
  frontmatter template — it does not read a `status` field off the proposal
  object at all, so no caller (however malformed the object it constructs)
  can make it emit `approved` or `rejected`. `audit.test.mjs` asserts this
  both functionally (feeding in a proposal object with an injected
  `status: 'approved'` field and proving the parsed output is still
  `pending`) and structurally (grepping the source for the hardcoded
  template and confirming there's no `status: ${...}` interpolation
  anywhere). Approval is exclusively an owner action in the PWA (S54).
- **Never self-apply a proposal.** A proposal is inert until the owner
  changes its `status` — the supervisor never re-reads or acts on that
  status field itself.

## Accuracy sampling — cost cap

Claude accuracy sampling is **optional** and **capped at 15 samples per
agent per run** (`MAX_ACCURACY_SAMPLES` in `audit.mjs`) — a caller-passed
`cap` can only lower this ceiling, never raise it. With up to ~6 fleet
agents that's at most ~90 short Claude calls, once a week. Sampling is
skipped entirely (zero calls, not an error) when `ANTHROPIC_API_KEY` isn't
set or an agent has no note-bearing runs in the window — a report always
renders, with or without an accuracy line.

The re-check call itself (`sample` in `sampleAccuracy`) is an injectable
seam: production wires the default Claude-backed sampler
(`defaultAccuracySample`), but **every test in `audit.test.mjs` injects its
own mock instead** — zero live network calls happen under `npx vitest run`.

## What it does (mechanics)

1. Lists every `agents/<name>` directory in the vault clone except
   `agents/lib` and `agents/supervisor` itself (`listFleetAgentDirs`).
2. For each, reads `runs.jsonl` (tolerant JSONL parse — a truncated final
   line from a crash mid-append is skipped, not fatal) and `status.json`
   (for `expected_cadence_min`), then filters to the trailing 7 days
   (`AUDIT_WINDOW_DAYS`).
3. Computes `{runCount, failureCount, avgDurationMs, p50DurationMs,
   p95DurationMs, stalenessIncidents}` per agent (`computeAgentMetrics`,
   pure).
4. Optionally samples accuracy per agent (`sampleAccuracy`, capped/mockable,
   see above).
5. Renders the weekly report in the exact S52 contract format
   (`renderReport`), verified to roundtrip losslessly through
   `src/vault/supervisor.ts`'s `parseReport`.
6. Generates proposals for any agent whose failure rate exceeds 10%
   (`FAILURE_RATE_THRESHOLD`) or whose sampled accuracy is below 90%
   (`ACCURACY_THRESHOLD`), always `status: pending`
   (`generateProposals` + `renderProposalMarkdown`), verified to roundtrip
   through `src/vault/supervisor.ts`'s `parseProposal`.
7. Logs its own run (S47) and commits + pushes everything written this run —
   the report, any proposal files, and its own `runs.jsonl`/`status.json` —
   in a single commit, via its own PAT.

## Running it

### On GitHub Actions (normal operation)

`.github/workflows/agent-supervisor.yml` runs this automatically: every
Sunday at 06:00 IST (plus on-demand via the Actions tab "Run workflow" —
`workflow_dispatch`).

### Locally (manual / debugging)

```bash
# From the repo root, with dependencies installed (npm ci).
export VAULT_DIR=/path/to/a/local/clone/of/LiveOS-VaultRepo
export ANTHROPIC_API_KEY=...  # optional -- omit to skip accuracy sampling
node agents/supervisor/audit.mjs
```

`VAULT_DIR` must point at a git clone of `LiveOS-VaultRepo` with push access
configured locally (your own credentials, not the agent's scoped PAT — that
PAT is Actions-only, see below).

## Secrets

| Secret | Purpose | Where it comes from |
|---|---|---|
| `ANTHROPIC_API_KEY` (optional) | Accuracy-sampling Claude calls | Anthropic Console → API Keys. Sampling is skipped cleanly when absent. |
| `AGENT_VAULT_PAT_SUPERVISOR` | Push access to `LiveOS-VaultRepo` | GitHub fine-grained PAT — `Contents: Read and write` on `LiveOS-VaultRepo` only. See `docs/agents/vault-tokens.md` for the full provisioning procedure and rotation checklist (this agent's row is already listed there). |

### Setting the secrets via `gh`

```bash
gh secret set ANTHROPIC_API_KEY --repo Deepak-Lakshmipathi/LifeOS
gh secret set AGENT_VAULT_PAT_SUPERVISOR --repo Deepak-Lakshmipathi/LifeOS
```

Each prompts for the value on stdin — never pass secret values as a CLI
argument (shell history) or paste them into a commit, PR, or issue.

## Rotation

Follow the general rotation checklist in `docs/agents/vault-tokens.md` for
`AGENT_VAULT_PAT_SUPERVISOR` (generate replacement → update the Actions
secret → confirm next run pushes cleanly → revoke the old token).

`ANTHROPIC_API_KEY` rotation is done from the Anthropic Console (revoke old
key → generate new → update the secret).

## Tests

`agents/supervisor/audit.test.mjs` covers:

- Metrics (`computeAgentMetrics` and its constituent pure functions)
  asserted against hand-computed values for a fixture "healthy" agent and a
  fixture "flaky" agent (S55 DoD #1).
- `renderReport` output parsed via the real `src/vault/supervisor.ts`
  `parseReport` — date, Fleet week, Concerns, and Proposals sections all
  roundtrip (DoD #1).
- `renderProposalMarkdown` output parsed via the real
  `src/vault/supervisor.ts` `parseProposal` — every generated proposal
  parses to `status: pending`, including an adversarial test that injects a
  `status: 'approved'` field onto the input object and proves the output is
  still `pending` (DoD #2).
- `sampleAccuracy` mocked and proven capped at `MAX_ACCURACY_SAMPLES=15`
  even when more note-bearing runs exist and even when a caller passes a
  higher `cap`; zero real `fetch` calls anywhere in the suite (DoD #4).
- A full `run()` pass against a temp-dir vault clone with an injected mock
  `push`, asserting every pushed file path falls inside
  `agents/supervisor/**` or `proposals/**` (DoD #3) — **zero live network,
  zero live git**, per the repo's AFK test policy
  (`docs/agents/afk-pipeline.md`).

```bash
npx vitest run agents/supervisor/audit.test.mjs
```
