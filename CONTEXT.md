# LifeOS

A personal, Apple-feel life tracker for a single user, built local-first as an installable PWA that runs offline on Windows and Android.

## Language

**Task**:
A single thing the user intends to do. In Slice 1 it is the only entity: `{ id, title, done, created_at }`.
_Avoid_: todo, item, card

**Domain**:
A top-level area of life the user organizes around (e.g. Building Things, Career, Body & Mind).
_Avoid_: folder (the seed JSON's key), category, area

**Project**:
A named effort inside a Domain, holding related Tasks.
_Avoid_: list, board

**done_when**:
A Task's written acceptance criterion — how the user knows it is truly finished. A live optional field on the Task as of Slice S2; a single short line, not a notes field.
_Avoid_: definition of done, acceptance, note

**priority**:
A Task's weight: `1 | 2 | 3` where **3 = highest** (matching the seed and the eventual `priority::` vault field). Optional and indexed as of Slice S3; **unset = untriaged**, semantically distinct from `1` (low). The balance brain (S6/S10) ranks on it. The UI surfaces it as **Low / Med / High** (stored 1/2/3) — the numeric scale stays internal so the inverted direction never reaches the user.
_Avoid_: weight, importance, urgency, P0/P1 labels

**Slice**:
A tracer-bullet vertical increment that pierces every architectural layer (UI → local data → PWA shell → sync seam), shippable on its own.
_Avoid_: phase, milestone, sprint

**Sync seam**:
The `SyncProvider` interface the app calls for persistence-beyond-local. In Slice 1 its only implementation is a no-op `LocalOnly`; a later Slice swaps the body, not the call sites.
_Avoid_: sync layer, backend (the backend does not exist yet)

## Relationships

- A **Domain** contains one or more **Projects** (out of Slice 1 scope)
- A **Project** contains one or more **Tasks** (out of Slice 1 scope; Slice 1 Tasks are unparented)
- A **Task** may carry a **done_when** (added in Slice S2)
- A **Task** may carry a **priority** (1–3, 3=highest; added in Slice S3, first indexed field → Dexie schema v2)
- The app reads/writes **Tasks** through the **Sync seam**, even when it is a no-op; the seam mutates Tasks via `add(input)` + a generic `update(id, patch)` (ADR-0004). The patch widens per slice; a non-string field is **cleared by passing the key with value `undefined`** (mirrors done_when's empty-string unset), never by storing `null`/`undefined`

## Flagged ambiguities

- "folder" (the seed JSON key) and "domain" (the plan/UI term) refer to the same concept — resolved: the canonical term is **Domain**; "folder" is the storage key only.
- "sync" was used to mean both the eventual backend and the always-present seam — resolved: **Sync seam** is the interface (exists in Slice 1); real sync is a later Slice.
- The seed JSON declares `priority: 0=none, 1=low, 2=med, 3=high` and carries 7 tasks at `0`, but the Task type is `1 | 2 | 3` — resolved (S3 grill): the model has **no `0`**; `0 = unset`. The S5 seed import maps `0 → absent` (field omitted), keeping the type clean and "untriaged" a real absent state.
