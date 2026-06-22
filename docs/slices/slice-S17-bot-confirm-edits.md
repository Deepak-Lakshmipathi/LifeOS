# Slice S17 — Telegram bot: confirm update/delete

> Read `docs/slices/README.md` + `CONTEXT.md` first. Claude usage → `claude-api` skill.

**Group:** E · **Depends on:** S16 · **Status:** planned

## Why
Capture isn't enough — the bot must edit and remove tasks conversationally. But edits are destructive, so the trust model is **confirm-destructive**: create fires instantly (S16); update/delete echo the intended change and wait for a yes.

## Scope — this slice only
- Extend intent handling to **update** and **delete**.
- **Find the target task** from a fuzzy reference ("the GST thing") by searching vault tasks; if multiple plausible matches, ask the user to pick.
- **Confirm before acting:** reply with the exact change ("Delete 'GST registration' from Finance? (y/n)" / "Set 'call CA' to P3? (y/n)") and only commit on confirmation.
- Apply via the vault write layer (S15); reply with the result.

## Out of scope
- Voice (S18), photo (S19). Multi-step batch edits.

## Data / model change
- None.

## Vertical
- Service: intent classification now covers create/update/delete; a lightweight per-chat conversation state to hold a pending confirmation; disambiguation prompt; vault mutate.
- Matching: a task-search helper (title/project/domain fuzzy match) — unit-tested.
- Dashboard: reflects changes via the vault.

## Acceptance criteria (done_when)
- [ ] "mark X done" / "delete X" / "change X priority" are classified and resolved to a specific task.
- [ ] Ambiguous reference → bot lists candidates and waits for a pick.
- [ ] update/delete are **not** applied until the user confirms; "n"/timeout cancels.
- [ ] create still fires instantly (no regression).
- [ ] Confirmation state is per-chat and owner-guarded.
- [ ] Tests cover matching + the confirm gate (mocked Claude).

## Relevant files
`services/bot/` (intent handler, conversation state, task-search helper + test), vault write module (S15).

## Notes for executor
Keep confirmation state minimal and expiring. Never mutate on a low-confidence match without confirmation. Mirror the dashboard's tap-dot Undo philosophy: reversible, explicit.
