# S52 — Supervisor report + proposal contracts + parsers [UI]

Phase 9 · Wave 4 · Deps: S47 · Blocks: S53, S54, S55

## Context
The supervisor is the control plane: weekly it audits all `runs.jsonl`,
writes a report, and PROPOSES prompt/config patches — which the owner must
approve in the PWA before any agent self-modifies (confirm-destructive spirit,
v1 S17). This slice: the two file contracts + parsers + fixtures.

## Contracts
```markdown
# agents/supervisor/2026-07-13.md (weekly report)
## Fleet week
- email-triage: 168 runs, 2 failures, avg 8.1s. Accuracy sample: 14/15 labels correct.
- job-scout: 7 runs, 0 failures. 12 found, 3 advanced by owner.
## Concerns
- calendar-sync stale twice (>2h) on 07-11.
## Proposals
- [[proposals/email-triage-2026-07-13]]

# proposals/email-triage-2026-07-13.md
---
agent: email-triage
date: 2026-07-13
status: pending        # pending | approved | rejected
---
## Change
Lower draft threshold: also draft for label bill when amount > ₹5,000.
## Diff
(prompt block before/after)
## Why
3 bill emails last week needed manual replies.
```

## Write-set
- NEW `src/vault/supervisor.ts` — `parseReport(md) → {date, sections}`;
  `parseProposal(md) → {agent, date, status, change, diff, why}` (frontmatter
  + sections); `setProposalStatus(md, status) → md` (pure text transform —
  ONLY flips the status line, byte-preserves everything else).
- NEW fixtures `src/vault/__fixtures__/supervisor-report.md`,
  `__fixtures__/proposal-{pending,approved}.md`.
- NEW `src/vault/supervisor.test.ts`.

## Subtasks
1. Report parser (sections tolerant). 2. Proposal frontmatter parser.
3. setProposalStatus (surgical line replace). 4. Fixtures + tests.

## Definition of Done
1. Fixtures parse to expected structures; unknown sections preserved/ignored gracefully.
2. `setProposalStatus(pendingFixture, "approved")` differs from input ONLY on the status line (byte-diff tested).
3. Proposal with invalid status → treated as pending (safe default, tested).
4. NO changes outside `src/vault/`. Tests green.

## Tests
Vitest: parsers, surgical status flip, invalid status.

## Design refs
§4.8 (supervisor card downstream); none here.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Fully parallel-safe (own file).
