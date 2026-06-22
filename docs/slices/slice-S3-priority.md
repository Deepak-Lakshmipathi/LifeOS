# Slice S3 — Task gains `priority` (1–3)

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** A · **Depends on:** S2 · **Status:** planned

## Why
Priority is what the balance brain (S6/S10) ranks on. The seed data already carries `priority` 1–3. Capturing it now means NOW has signal to work with later.

## Scope — this slice only
- Add optional `priority?: 1 | 2 | 3` to `Task` (3 = highest, matching seed). **No `0`** — `0=none` from the seed maps to `unset` (resolved in CONTEXT.md flagged ambiguities; S5 import does the mapping).
- Set it on create + edit via a 3-way control labeled **Low / Med / High** (stored 1/2/3; numeric scale stays internal so the inverted direction never confuses the user). The control also offers an explicit **none** segment; **create defaults to none** (untriaged stays reachable).
- Show a small weight indicator on the card — a P-badge or dot, **never color-alone** (carry an `aria-label`/visible text for accessibility).
- A task's priority is **clearable** back to none from the UI (symmetric with done_when).

## Out of scope
- Sorting/ranking by priority (that's the NOW view, S6). This slice only stores + displays.

## Data / model change
- `src/types/task.ts`: add `priority?: 1 | 2 | 3`.
- Reuse `update(id, patch)` from S2; extend `add(input)` to accept `priority`.
- Add `priority` to the Dexie index in `LifeOSDb.ts` (NOW will query/sort by it) → **bump schema to version(2)** with the new index string.

## Vertical
- UI: priority control in `AddTaskInput` + edit; weight indicator in `TaskItem`.
- Seam/store: `add`/`update` carry `priority`; Dexie indexed.
- PWA: offline unaffected (Dexie upgrade runs locally).

## Acceptance criteria (done_when)
- [ ] A task can be created/edited with priority 1–3; persists across reload.
- [ ] Priority shows as a clear weight indicator on the card.
- [ ] Dexie schema bumped to v2; existing tasks (no priority) survive the upgrade.
- [ ] Unit tests cover `priority` round-trip via the seam.
- [ ] PWA e2e green.

## Relevant files
`src/types/task.ts`, `src/db/LifeOSDb.ts`, `src/sync/LocalOnly.ts`, `src/sync/SyncProvider.ts`, `src/hooks/useTasks.ts`, `src/components/AddTaskInput.tsx`, `src/components/TaskItem.tsx`, `src/test/syncProvider.test.ts`.

## Notes for executor
- **Migration:** add `this.version(2).stores({ tasks: 'id, created_at, done, priority' })` while **keeping** the `version(1)` line. **No `.upgrade()` callback and NO backfill** — legacy rows keep no `priority` key, fall out of the priority index, and still load via `get`/`orderBy('created_at')` (IndexedDB does not index `undefined` key paths). Keep `priority` optional so legacy/un-prioritized tasks are valid.
- **Migration test (the one most likely written wrong):** `fake-indexeddb` + a fresh `LocalOnly` always opens at v2, so it does NOT reproduce an on-disk v1 DB. Genuinely exercise the upgrade: open a raw `new Dexie('LifeOS')` with only `.version(1).stores({ tasks: 'id, created_at, done' })`, add a priority-less record, `close()`, then instantiate `LocalOnly` (opens v2) and assert the record loads with `priority` absent.
- **Seam validation:** reject `priority` present-and-not-in-`{1,2,3}` with a throw (mirrors the empty-title throw) — the seam is the trust boundary for future non-typed callers (seed import, Telegram bot).
- **Clear semantics:** `update(id, { priority: undefined })` with `'priority' in patch` true → `delete` the key (never store `null`/`undefined`). Omitting `priority` from the patch leaves it untouched.
- **The index is declared but MUST NOT be queried/sorted this slice** — that's S6 (NOW view).
- Widen the patch union `Partial<Pick<Task,'title'|'done_when'|'priority'>>` in `SyncProvider`, `LocalOnly`, `useTasks` (both the `updateTask` site AND the `add`-forward call), `TaskItem`, `TaskList`. Widen `add` input to `{ title; done_when?; priority? }` everywhere it appears.
- While editing `SyncProvider.ts`/`LocalOnly.ts`, fix the stale **ADR-0003 → ADR-0004** citation (the generic-update ADR was renumbered in #14).

## Split (resolved in grill)
- **S3a** — model + seam + migration + `useTasks` + unit tests (all the risk lives here; unit-test verifiable, no UI).
- **S3b** — UI: Low/Med/High control in `AddTaskInput` + edit in `TaskItem`, weight badge render. **Blocked by S3a** (consumes the finished hook signature). `useTasks.ts` belongs to S3a so S3b never touches it.
