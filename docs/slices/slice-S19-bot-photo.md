# Slice S19 — Telegram bot: photos (vision)

> Read `docs/slices/README.md` + `CONTEXT.md` first. Claude usage → `claude-api` skill.

**Group:** E · **Depends on:** S18 · **Status:** planned — **completes the vision**

## Why
The richest capture: photograph a whiteboard, a receipt, a handwritten list, a screenshot — and have it become tasks. Closes the "one software to rule them all" loop.

## Scope — this slice only
- Handle Telegram photo messages: download the image (+ any caption).
- Use Claude vision to read the image and extract **one or more** tasks with `{ title, domain, project, done_when, priority }`.
- Multiple tasks → present the parsed set and **confirm before creating** (batch confirm, consistent with confirm-destructive ethos for bulk creation).
- Caption text augments/guides extraction.

## Out of scope
- Anything beyond task extraction (e.g. storing the image as an attachment) unless trivial. PDF/multi-page.

## Data / model change
- None.

## Vertical
- Service: photo download → Claude vision (image + caption) → structured task list → batch-confirm → vault writes via S15.
- Reuse confirmation/conversation state from S17 for the batch case.

## Acceptance criteria (done_when)
- [ ] A photo is downloaded and read by Claude vision into a structured task list.
- [ ] Multiple extracted tasks are shown for confirmation before creation; user can accept/reject the set.
- [ ] Caption guides extraction when present.
- [ ] Owner-guarded; uses the latest vision-capable Claude model.
- [ ] Integration test with a fixture image/mocked vision response.
- [ ] **Vision complete** — update `kanban.html`; the three faces (dashboard, bot, Obsidian) all operate over one vault.

## Relevant files
`services/bot/` (photo handler, Claude vision client), reuse confirmation state (S17) + vault write (S15), `kanban.html`.

## Notes for executor
Bulk creation is effectively destructive-by-volume — confirm the set before writing. Use the latest vision-capable Claude model per `claude-api`. Keep extraction prompt-driven and testable with a mocked response.
