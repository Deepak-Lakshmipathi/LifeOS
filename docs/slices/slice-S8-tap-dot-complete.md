# Slice S8 — Tap-the-dot complete + undo

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** B · **Depends on:** S7 · **Status:** planned

## Why
Completing a task is the action you do most. The chosen gesture: tap the ● → it fills to ✓ with a ring pulse, the card fades and folds away, and a 3-second Undo toast appears. Precise, no accidental completes, identical on desktop + mobile.

## Scope — this slice only
- Replace the current toggle UI with a tappable status dot on each card (NowView + Domains list).
- Completion animation: dot fills → ✓, ring pulse, card fades to ~40% then collapses out (framer-motion).
- **Undo toast** for 3s: tapping Undo reverts the completion (re-toggle).
- Keep existing haptic (`navigator.vibrate`).

## Out of scope
- `completed_at` timestamp + warmth (S9) — this slice keeps toggling `done` only. Glass styling (S11).

## Data / model change
- None (still `toggleDone`).

## Vertical
- UI: dot control in `TaskItem`; completion animation; `UndoToast` component + a small dismiss-timer hook.
- Hook: `useTasks.toggleDone` already exists; add transient "recently completed" state to drive Undo.
- PWA: offline unaffected.

## Acceptance criteria (done_when)
- [ ] Tapping the dot completes the task with the fill→✓→fade→fold animation.
- [ ] An Undo toast shows for 3s; Undo reverts; after 3s it auto-dismisses.
- [ ] Works in NowView and the Domains list; haptic fires on mobile.
- [ ] Completing in NOW lets the next task rise (integrates with S6).
- [ ] PWA e2e green.

## Relevant files
`src/components/TaskItem.tsx`, new `src/components/UndoToast.tsx`, `src/hooks/useTasks.ts`, `src/components/NowView.tsx`.

## Notes for executor
Undo = re-issue `toggleDone(id)` within the window; don't invent a separate "undo" seam method. Respect `prefers-reduced-motion`.
