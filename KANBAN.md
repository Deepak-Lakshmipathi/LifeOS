# LifeOS — Kanban

## Slice 1 — bare-bones local-first task tracker ✅ complete

PRD: #1

| Issue | Slice | Status | PR |
|-------|-------|--------|----|
| #2 | Local-first task loop | done | #4 (merged) |
| #3 | PWA shell: installable + offline | done | #6 (merged) |

Slice 1 shipped to master: local-first task loop (Dexie + SyncProvider seam, Apple-feel UI) + installable offline PWA. CI gates build/test + emulated PWA install/offline checks (see `docs/testing/pwa-emulation-protocol.md`).

## Slice 2 — Task gains `done_when` (S2) 🟡 in progress

PRD: #8 · ADR: 0003 (generic `update` at the seam)

| Issue | Slice | Status | Blocked by | PR |
|-------|-------|--------|-----------|----|
| #9 | S2a — done_when seam + Task model + hook | ready | — | — |
| #10 | S2b — done_when UI: create field, inline edit, render | blocked | #9 | — |

Seam grows mutation-generic (`add(input)` + `update(id, patch)`, ADR-0003) so S3–S5 widen types, not methods. S2a = data foundation (unit-test verifiable); S2b = UI, serial on S2a. `AddTaskInput.tsx` is a hotspot across both — serialized via blocked-by.
