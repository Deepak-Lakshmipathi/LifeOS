# AFK pipeline — lessons ledger

One line per lesson. P0 reads this file as context; P6 appends after every run. Newest last.

- 2026-06-29 (S6): a dispatched implementer that produces no branch + first commit within ~10 min is dead — kill it and implement inline; inline fallback beats re-dispatch for pre-resolved slices.
- 2026-06-29 (S7–S11): worktree-per-implementer off fresh `origin/master` is what makes parallel waves safe — 5 slices, 16 min/slice, zero conflicts.
- 2026-07-05 (S17/18/19b): `src/router.ts` is a hotspot — slices sharing it must serialize even with no dependency edge.
- 2026-07-05: kanban board flips ship as separate CI-gated PRs, not folded into slice PRs.
- 2026-07-01 (S14): docs branch left unmerged lagged master by 92 min — docs merge is part of the run, not a human chore (now P6).
