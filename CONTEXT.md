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
- The app reads/writes **Tasks** through the **Sync seam**, even when it is a no-op; the seam mutates Tasks via `add(input)` + a generic `update(id, patch)` (ADR-0003)

## Flagged ambiguities

- "folder" (the seed JSON key) and "domain" (the plan/UI term) refer to the same concept — resolved: the canonical term is **Domain**; "folder" is the storage key only.
- "sync" was used to mean both the eventual backend and the always-present seam — resolved: **Sync seam** is the interface (exists in Slice 1); real sync is a later Slice.
