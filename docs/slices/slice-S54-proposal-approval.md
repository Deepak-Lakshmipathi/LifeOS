# S54 — Proposal approval flow (owner-gated, confirm-destructive) [UI]

Phase 9 · Wave 6 · Deps: S52, S53 (AgentsView chain) · Blocks: —

## Context
The human gate on agent self-modification: PWA lists `proposals/*` with
`status: pending`; owner reviews change/diff/why, taps Approve or Reject →
the file's status line flips IN THE VAULT (S52 `setProposalStatus`) via the
existing write transport, committed like any task edit. Agents (S55+) only
ever act on `approved`. Two-step confirm in UI (tap Approve → "confirm?" →
commit) — confirm-destructive spirit (v1 S17/ADR-0013).

## Write-set
- NEW `src/components/agents/ProposalList.tsx` — pending proposals; expanded
  view: Change / Diff / Why sections; Approve (two-step) + Reject buttons per
  §4.4 action-button style.
- NEW `src/vault/proposalWrite.ts` — `flipProposal(transport, path, status)`:
  read file → setProposalStatus → write via transport (same seam as
  habitsWrite S32).
- MODIFY `src/components/agents/AgentsView.tsx` — mount under SupervisorCard.
- NEW tests.

## Subtasks
1. List + detail render. 2. Two-step approve (second tap within 5s, else
reset). 3. flipProposal write path (fake transport test). 4. Reject path.
5. Mount. 6. Tests.

## Definition of Done
1. Pending fixtures listed; approved/rejected fixtures NOT listed (tested).
2. Approve is two-step: first tap arms ("Confirm approve?"), second commits; timeout resets (fake timers, tested).
3. flipProposal writes the byte-surgical S52 transform through the transport seam — no direct fs/git in components (tested with fake transport, payload asserted).
4. Reject flips to rejected identically.
5. Diff = ProposalList, proposalWrite, AgentsView (+tests). Tests green.

## Tests
Vitest: list filter, two-step arm/timeout, write payloads.

## Design refs
§4.4 (action button), §4.8; confirm-destructive per ADR-0013 spirit.

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet. HOTSPOT: AgentsView — rebase on S53 merge.
