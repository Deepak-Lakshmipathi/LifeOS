# S36 — Mail/attention vault contract + parser [UI]

Phase 5 · Wave 3 · Deps: S24 (soft) · Blocks: S37, S38

## Context
The "Needs you" attention stack is Gmail-fed but the PWA only reads a vault
file written by the email-triage agent (S38). Contract + parser + fixture only.
Provenance is a design requirement (§8: show which agent flagged it and why).

## Contract — `Mail/attention.md`
```markdown
# attention — written by email-triage
- [ ] Meera (NorthStar) asked for a revised quote (label:: client-money) (from:: meera@northstar.io) (waiting:: 26h) (draft:: Mail/drafts/2026-07-14-meera.md)
- [ ] Electricity bill ₹2,340 due (label:: bill) (from:: alerts@bescom.in) (waiting:: 3d)
- [x] Recruiter reply — InstaCo (label:: job) (from:: t@instaco.dev) (waiting:: 0h)
```
Labels: `client-money | bill | job | agent-failure | other` (unknown → other).
`[x]` = handled (kept for history; UI hides). `draft::` optional pointer to a
ready draft file. Malformed lines skipped.

## Write-set
- NEW `src/vault/mail.ts` — `AttentionItem {title, label, from, waitingHours,
  draftPath?, handled}`; `parseAttention(md)`; `waiting::` parses `h`/`d`
  suffixes to hours.
- NEW `src/vault/__fixtures__/mail-attention.md`.
- NEW `src/vault/mail.test.ts`.

## Subtasks
1. Types + parser. 2. waiting:: unit parsing. 3. Fixture (≥1 of each label,
one handled, one with draft). 4. Tests.

## Definition of Done
1. Fixture parses to expected items; every label variant covered; handled items flagged.
2. `waiting:: 26h` → 26, `waiting:: 3d` → 72 (tested); missing → 0.
3. Unknown label → `other`; malformed line skipped, no throw.
4. NO changes outside `src/vault/`. Tests green.

## Tests
Vitest: fixture parse, waiting conversions, malformed.

## Design refs
None (no UI). Provenance fields exist for §8.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. Fully parallel-safe (own file).
