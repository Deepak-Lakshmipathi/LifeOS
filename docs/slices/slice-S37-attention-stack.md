# S37 — "Needs you" attention stack [UI]

Phase 5 · Wave 9 · Deps: S36 (+S34 HomeView chain) · Blocks: S48 (chain)

## Context
Home left-stack card under Mission (`docs/DESIGN_LANGUAGE.md` §4.4): one row
per unhandled attention item — icon well tinted by source, message + small
provenance sub-line naming the flagging agent, action button. Draft-ready
items get the "Draft ready →" action.

## Write-set
- NEW `src/components/home/AttentionCard.tsx` — §4.4 anatomy exactly; icon
  tint by label (mail/bill/agent-failure/job per §4.4 rgba values → use
  tokens/color-mix); heading count "Needs you · N"; handled items hidden;
  sorted by waitingHours desc; action button per spec (draft-ready vs generic
  "Open →" no-op placeholder for now).
- MODIFY `src/components/home/HomeView.tsx` — mount below Mission.
- NEW `src/components/home/AttentionCard.test.tsx`.

## Subtasks
1. Row render per label variant. 2. Provenance sub-line ("email-triage flagged
as client / money" style from label+waiting). 3. Sort + count. 4. Mount. 5. Tests.

## Definition of Done
1. S36 fixture renders: 1 row per unhandled item, handled hidden, count in heading correct.
2. Each label maps to its §4.4 icon tint (assert class/style per variant).
3. Every row shows a provenance sub-line (§8 — no anonymous facts).
4. Items sorted by waiting desc (tested).
5. Draft-pointer items show "Draft ready →" button.
6. Diff = AttentionCard + HomeView (+test). Tests green.

## Tests
Vitest: fixture render, variants, sort, count, handled-hidden.

## Design refs
§4.4 (full), §8 (provenance).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. HomeView-chain: rebase on S34 merge.
