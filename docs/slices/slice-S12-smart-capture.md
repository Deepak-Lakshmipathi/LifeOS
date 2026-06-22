# Slice S12 — Smart capture on the `+` tab

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** C · **Depends on:** S11 · **Status:** planned

## Why
Manual capture is one of the two channels (the bot is the other, later). Make it fast and forgiving: one field that parses natural shorthand into a structured task, defaulting to Inbox when unsorted.

## Scope — this slice only
- Single capture field on `+` that parses inline tokens from free text:
  - `#domain` → domain (fuzzy-match to one of the 7)
  - `!1`/`!2`/`!3` → priority
  - `when …` (to end) or `~ …` → `done_when`
  - `/project` or chosen project → project
  - remaining text → title
- Live preview of the parsed task before commit; unmatched → Inbox (no domain).
- Commit creates the task via the seam.

## Out of scope
- Voice/photo/NLU via Claude (that's the Telegram bot, Group E). This is deterministic local parsing only.

## Data / model change
- None (uses `add(input)` from Group A).

## Vertical
- Logic: pure `parseCapture(text): TaskInput` helper, heavily unit-tested (tokens in any order, missing tokens, fuzzy domain match).
- UI: capture field + live parsed preview; reuses glass styling.
- Seam/store: `add(input)`.
- PWA: offline unaffected (parsing is local).

## Acceptance criteria (done_when)
- [ ] `parseCapture` extracts domain/priority/done_when/project/title from shorthand in any order; pure + unit-tested.
- [ ] Unmatched domain → task lands in Inbox.
- [ ] Live preview shows the parsed result before commit.
- [ ] Committing persists a correct task.
- [ ] PWA e2e green.

## Relevant files
New `src/capture/parseCapture.ts` (+ test), new/updated `src/components/CaptureSheet.tsx`, `src/components/TabBar.tsx`, `src/hooks/useTasks.ts`.

## Notes for executor
Keep parsing rules in the pure helper and document the mini-syntax in a comment. The Telegram bot (S16) will later reuse the *concept* but via Claude, not this regex parser — don't couple them.
