# Slice S15 — Obsidian vault write

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** D · **Depends on:** S14 · **Status:** planned

## Why
Make the vault the *live* source of truth: dashboard edits flow back to markdown so the box you check in the PWA is checked in Obsidian, and vice-versa. This completes the multi-client promise (dashboard ⇄ Obsidian).

## Scope — this slice only
- Implement `VaultSync.toggleDone / add / update / delete` as markdown mutations:
  - `toggleDone` → flip `- [ ]`/`- [x]` on the right line.
  - `add` → append a task line (+ inline fields) under the correct Project note (create note/folder if missing); unsorted → an Inbox note.
  - `update` → rewrite inline fields on the line.
  - `delete` → remove the line.
- Round-trip safety: writes preserve surrounding note content + formatting.

## Out of scope
- Bot (Group E). Real-time multi-writer conflict resolution beyond a documented last-write-wins + file-level safety (note it; harden later if needed).

## Data / model change
- None. Same model; serialized to/from markdown.

## Vertical
- Logic: pure `serializeTaskLine(task)` + targeted line-edit helpers; unit-tested for round-trip (`parse(serialize(x)) === x`).
- Seam: complete `VaultSync` write methods via the transport adapter.
- PWA: writes require the transport to be writable; document offline behavior.

## Acceptance criteria (done_when)
- [ ] Toggling done in the dashboard updates the checkbox in the vault file; re-reading reflects it.
- [ ] Adding/updating/deleting a task mutates the correct note without corrupting other content.
- [ ] Round-trip property test passes (parse∘serialize identity for supported fields).
- [ ] Creating a task in a new project/domain creates the note/folder; unsorted → Inbox.
- [ ] Seam discipline intact; flag-gated; MVP `LocalOnly` unaffected when off.

## Relevant files
`src/sync/VaultSync.ts`, `src/vault/parseVault.ts` (+ serializer + tests), transport adapter (write), ADR-0003 (update with write/conflict notes).

## Notes for executor
Edit lines surgically — never rewrite a whole note from the model (you'd lose user prose). Test round-trip and "preserve unrelated content" explicitly.
