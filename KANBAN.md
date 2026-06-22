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

## Slice 3 — Task gains `priority` (S3) 🔵 planned

PRD: #15 · ADR: 0004 (addendum — `undefined` clears non-string fields; seam validates) · Spec: `docs/slices/slice-S3-priority.md`

| Issue | Slice | Status | Blocked by | PR |
|-------|-------|--------|-----------|----|
| #16 | S3a — priority seam + Task model + Dexie v2 + hook | status:ready | — | — |
| #17 | S3b — priority UI: Low/Med/High control + weight badge | status:blocked | #16 | — |

`priority?: 1|2|3` (3=highest; no `0` — seed's `0=none` → unset at S5 import). First indexed field → Dexie **schema v2** (`'id, created_at, done, priority'`, no `upgrade()`/backfill — legacy rows fall out of the index, still load). Seam widens per ADR-0004: `add` carries `priority?`, `update` patch gains `priority`, cleared via `{ priority: undefined }`, validated `∈{1,2,3}` (throw). UI = Low/Med/High + none control (default none, clearable), weight badge (not color-alone). Stores + displays only — **no sorting** (that's S6 NOW). S3a = all risk (migration/clear/validate, unit-test verifiable); S3b = UI, blocked by S3a.
