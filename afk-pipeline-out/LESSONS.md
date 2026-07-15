# AFK pipeline — lessons ledger

One line per lesson. P0 reads this file as context; P6 appends after every run. Newest last.

- 2026-06-29 (S6): a dispatched implementer that produces no branch + first commit within ~10 min is dead — kill it and implement inline; inline fallback beats re-dispatch for pre-resolved slices.
- 2026-06-29 (S7–S11): worktree-per-implementer off fresh `origin/master` is what makes parallel waves safe — 5 slices, 16 min/slice, zero conflicts.
- 2026-07-05 (S17/18/19b): `src/router.ts` is a hotspot — slices sharing it must serialize even with no dependency edge.
- 2026-07-05: kanban board flips ship as separate CI-gated PRs, not folded into slice PRs.
- 2026-07-01 (S14): docs branch left unmerged lagged master by 92 min — docs merge is part of the run, not a human chore (now P6).
- 2026-07-10 (PRs #96/#97): pwa-e2e offline-persistence test flaked 2/2 first attempts (rerun-green both) - fingerprint recorded in config; test needs a stabilization fix, file it rather than normalizing reruns. Also: gh pr checks --watch exits 0 on failing checks - never chain it straight into gh pr merge; assert green explicitly.
- 2026-07-14 (S20): a slice whose ticket already carries PRD-lite + DoD is the light path - P1/P2/P3 are already done and re-running them is pure cost; go P0 -> implement -> triple-green.
- 2026-07-14 (S20): the eval subagent earns its keep on [UI] slices - it caught rgba spacing drift between tokens.css and tailwind.config.js that CI and review both passed over. "Byte-exact to the contract" needs a reader that diffs characters, not intent.
- 2026-07-14 (S20): when a v2 reskin lands on a live v1 app, MERGE the Tailwind extend, never replace it - the contract's §2.4 block is additive-in-practice, and replacing it breaks every shipped component and fails the "existing suite green" DoD.
- 2026-07-14 (S20): pwa-e2e passed first attempt (1/1) - the recorded flake fingerprint did not fire this run; still unfixed, do not close it on one clean run.
- 2026-07-15 (S24): the eval subagent caught two blockers CI-at-first-glance and self-review missed on the App.tsx restructure — (1) a reduced-motion §7 violation where a code comment claimed a global index.css reset that never existed AND wouldn't stop framer's inline animation anyway (fix = framer useReducedMotion(), the app's own pattern), and (2) pwa-e2e red because removing the v1 `<h1>Tasks</h1>` + "Add task" button broke existing Playwright smoke-checks. Lesson: a shell/IA restructure silently invalidates e2e selectors keyed off the OLD UI — grep e2e for the removed elements BEFORE pushing, and gate every framer animation with useReducedMotion() not a CSS comment.
- 2026-07-15 (S24): pwa-e2e is a REAL blocking CI check (not just a slice acceptance target) — a restructure that breaks its selectors fails triple-green even though vitest is 100% green. "435/435 unit green" is not "CI green"; always read `gh pr checks`, not just the local suite.
- 2026-07-15 (S24): out-of-write-set edits (e2e/pwa.spec.ts) are acceptable when a UI change legitimately invalidates the old assertions — but require a one-line justified deviation posted as a PR comment, which the eval gate explicitly checks for. Repoint smoke-checks to a stable anchor (data-testid="tab-bar"), don't force a fake legacy element back into the DOM.
