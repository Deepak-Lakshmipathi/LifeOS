# LifeOS — Kanban

## Slice 1 — bare-bones local-first task tracker ✅ complete

PRD: #1

| Issue | Slice | Status | PR |
|-------|-------|--------|----|
| #2 | Local-first task loop | done | #4 (merged) |
| #3 | PWA shell: installable + offline | done | #6 (merged) |

Slice 1 shipped to master: local-first task loop (Dexie + SyncProvider seam, Apple-feel UI) + installable offline PWA. CI gates build/test + emulated PWA install/offline checks (see `docs/testing/pwa-emulation-protocol.md`).

## Slice 2 — Task gains `done_when` (S2) ✅ complete

PRD: #8 · ADR: 0004 (generic `update` at the seam)

| Issue | Slice | Status | Blocked by | PR |
|-------|-------|--------|-----------|----|
| #9 | S2a — done_when seam + Task model + hook | done | — | #11 (merged) |
| #10 | S2b — done_when UI: create field, inline edit, render | done | #9 | #12 (merged) |

Shipped to master: seam grew mutation-generic (`add(input)` + `update(id, patch)`, ADR-0004) so S3–S5 widen types, not methods. S2a = data foundation (unit-test verifiable); S2b = UI (always-visible `Done when…` field, tap-title inline edit, secondary card render). Next: S3 (priority) — first Dexie index / schema-version bump.
