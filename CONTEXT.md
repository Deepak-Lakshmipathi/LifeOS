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
A named effort inside a Domain, holding related Tasks. As of S4, Project is a denormalized free-text string on the Task (`project?`), **not** its own stored entity — Projects are _derived by grouping_ the task list. Promotion to a real entity (color, domain link) is deferred to a later slice.
_Avoid_: list, board

**Inbox**:
The derived group of project-less Tasks — a UI/grouping label, not a stored Project. Sorts first, above the named project groups.
_Avoid_: unfiled, none, uncategorized

**done_when**:
A Task's written acceptance criterion — how the user knows it is truly finished. A live optional field on the Task as of Slice S2; a single short line, not a notes field.
_Avoid_: definition of done, acceptance, note

**priority**:
A Task's importance, `1 | 2 | 3` (3 = highest); absent = none. A live optional field as of Slice S3 — the first Dexie-indexed Task field (schema v2). Set via a Low/Med/High control on create + inline edit; shown as a weight badge.
_Avoid_: weight, importance, urgency, rank

**Slice**:
A tracer-bullet vertical increment that pierces every architectural layer (UI → local data → PWA shell → sync seam), shippable on its own.
_Avoid_: phase, milestone, sprint

**Sync seam**:
The `SyncProvider` interface the app calls for persistence-beyond-local. In Slice 1 its only implementation is a no-op `LocalOnly`; a later Slice swaps the body, not the call sites.
_Avoid_: sync layer, backend (the backend does not exist yet)

## Relationships

- A **Domain** contains one or more **Projects** (out of Slice 1 scope)
- A **Project** contains one or more **Tasks** — as of S4 this relation is realized by the Task's denormalized `project` string (grouping), not a foreign key to a Project entity
- A **Task** may carry a **done_when** (added in Slice S2), a **priority** (added in Slice S3), and a **project** name (added in Slice S4); project-less Tasks group under **Inbox**
- The app reads/writes **Tasks** through the **Sync seam**, even when it is a no-op; the seam mutates Tasks via `add(input)` + a generic `update(id, patch)` (ADR-0004)

## Flagged ambiguities

- "folder" (the seed JSON key) and "domain" (the plan/UI term) refer to the same concept — resolved: the canonical term is **Domain**; "folder" is the storage key only.
- "sync" was used to mean both the eventual backend and the always-present seam — resolved: **Sync seam** is the interface (exists in Slice 1); real sync is a later Slice.
