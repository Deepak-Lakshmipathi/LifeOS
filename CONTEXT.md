# LifeOS

A personal, Apple-feel life tracker for a single user, built local-first as an installable PWA that runs offline on Windows and Android.

## Language

**Task**:
A single thing the user intends to do. In Slice 1 it is the only entity: `{ id, title, done, created_at }`.
_Avoid_: todo, item, card

**Domain**:
A top-level area of life the user organizes around. The set is fixed at **7**: Building Things, Career, Growth, Life Admin, Body & Mind, Finance, Relationship. A live optional field on the Task as of Slice S5 (`domain?: string`, constrained to the 7 — a typed `const`/union in `src/data/domains.ts`), with a static color palette (`DOMAIN_COLORS`) reserved for later glow/warmth. Like `project`, it is a denormalized string consumed only by in-memory grouping — **no Dexie index, no schema bump** (ADR-0005/ADR-0006).
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

**Seed**:
The one-shot import of `seed_tasks_detailed.json` (folders → projects → tasks across the 7 domains) into the local store, run by `seedIfEmpty` on first launch only when the DB is empty (idempotent by empty-check; ADR-0006). Maps `folder`→domain, project `name`→project, carrying `priority`/`done_when`. Skipped under `?noseed` (test hook).
_Avoid_: fixture, demo data, import (the verb is fine; the noun is "seed")

**NOW**:
The command-center home surface answering "what do I do now?" — a flat, cross-domain, priority-ranked queue of open Tasks. As of Slice S6 it is the **dumb brain**: pure priority order (`rankNow`), domain-blind. The **balance brain** (S10) later makes it smart (per-domain cap + coldest-domain injection + warmth).
_Avoid_: home, dashboard, feed, today

**rankNow**:
The pure ranking function (`src/now/rankNow.ts`, S6) behind NOW: `rankNow(tasks) → Task[]`, excluding done Tasks, sorting priority descending (absent = lowest) then `created_at` ascending. The seam the balance brain (S10) extends; ranking never lives in the view.
_Avoid_: sort, filter, order

**Slice**:
A tracer-bullet vertical increment that pierces every architectural layer (UI → local data → PWA shell → sync seam), shippable on its own.
_Avoid_: phase, milestone, sprint

**Sync seam**:
The `SyncProvider` interface the app calls for persistence-beyond-local. In Slice 1 its only implementation is a no-op `LocalOnly`; a later Slice swaps the body, not the call sites.
_Avoid_: sync layer, backend (the backend does not exist yet)

**Bot**:
The Telegram capture face of LifeOS — a separate deployable (`services/bot/`, Node/TS, long-poll worker; ADR-0011) that meets the PWA only at the vault. Owner-chat-id-guarded; text messages are classified by Claude into an **Intent** and written via the same vault layer as the dashboard (`serializeTaskLine` + `GitTransport.writeFile`, S15). As of S16 it handles **create** only; non-create intents reply "not yet supported" until S17 (update/delete) / S18 (voice) / S19 (photo).
_Avoid_: assistant, agent (the bot is a thin capture front-end, not an autonomous agent)

**Intent**:
The Claude-classified action a bot message maps to (`create`, later `update`/`delete`/`voice`/`photo`), extracted via structured output (not the regex `parseCapture` — S12's shorthand parser and the bot's Claude NLU are deliberately uncoupled, ADR-0011). Routed through a self-registering handler seam in `services/bot/intents/` — one file per intent, one append-only import line per slice (ADR-0011 §4).
_Avoid_: command, action (the bot is not a command-line surface), request

**id:: (durable identity)**:
An optional inline vault-markdown field (`id:: <uuid>`), landing in S16 per ADR-0010 §2's upgrade trigger — the first "second live mutator" (the bot, editing tasks it may not have authored in-session) makes S15's ephemeral per-parse identity insufficient. `serializeTaskLine` always emits it going forward; `parseTaskLine` reads it when present and falls back to a freshly-minted id when absent (legacy lines get stamped lazily on their next write, by any mutator — no bulk migration). No `Task` type or Dexie schema change; a vault-format addition only (ADR-0011 §3).
_Avoid_: task ID (ambiguous with the in-memory `Task.id`, which now durably persists when the line carries `id::`), UUID (the field name is `id::`, not `uuid::`)

**Confirm-destructive**:
The bot's trust model for mutating **Intents** (update/delete): the bot echoes the exact change it will make and waits for an explicit `y` before committing, never mutating the vault on the first message (S17, ADR-0013). Create is not destructive and skips this gate. The `y`/`n` reply is checked in the router *before* Claude NLU, so it costs no model call and is reusable across modalities (e.g. an S18 voice transcript).
_Avoid_: confirmation dialog (there is no UI; it is a text reply), are-you-sure

**Pending confirmation**:
The per-chat state that holds a proposed destructive action between the bot's echo and the owner's `y`/`n` — an in-memory `Map<chatId, PendingAction>` with a short TTL (lazy-expired on read), not persisted (single owner, single always-on worker; S17, ADR-0013). Distinct from S19's photo batch-confirm state (`photoConfirm.ts`), which is independently built and a candidate for a later generalization pass.
_Avoid_: session, transaction, pending write (it gates a write; it is not itself one)

## Relationships

- A **Domain** contains one or more **Projects** (out of Slice 1 scope)
- A **Project** contains one or more **Tasks** — as of S4 this relation is realized by the Task's denormalized `project` string (grouping), not a foreign key to a Project entity
- A **Task** may carry a **done_when** (added in Slice S2), a **priority** (added in Slice S3), a **project** name (added in Slice S4), and a **domain** (added in Slice S5, one of the 7); project-less Tasks group under **Inbox**, and the list nests **Domain → Project → Task** (domain-less Tasks under an "Inbox" domain, first)
- The app reads/writes **Tasks** through the **Sync seam**, even when it is a no-op; the seam mutates Tasks via `add(input)` + a generic `update(id, patch)` (ADR-0004)
- The **Bot** writes **Tasks** to the vault via the same serializer/transport as the dashboard (`serializeTaskLine` + `GitTransport.writeFile`, S15) but is a separate process — the two meet only at the vault's git repo, never in-memory (ADR-0011). A bot message resolves to an **Intent**, which routes to a handler in `services/bot/intents/`.

## Flagged ambiguities

- "folder" (the seed JSON key) and "domain" (the plan/UI term) refer to the same concept — resolved: the canonical term is **Domain**; "folder" is the storage key only.
- "sync" was used to mean both the eventual backend and the always-present seam — resolved: **Sync seam** is the interface (exists in Slice 1); real sync is a later Slice.

- **Design language** — all UI work MUST follow `docs/DESIGN_LANGUAGE.md` (Glass Cockpit). Read it before touching any component or style.
