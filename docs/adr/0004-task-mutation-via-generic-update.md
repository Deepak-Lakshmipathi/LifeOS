# Task mutation via a generic `update` at the sync seam

Starting in Slice S2, the `Task` model grows new optional fields across consecutive slices: `done_when` (S2), `priority` (S3), `project` (S4), `domain` (S5), and later `completed_at` (S9). Each must be settable on create and editable afterward, through the `SyncProvider` seam (ADR-0002) — components never touch Dexie.

We considered three ways to evolve the seam:

- **A — keep `add(title)`, set every field via `update` after create.** Creating a fully-specified task (seed import, future Telegram bot) becomes a non-atomic two-call dance.
- **B — `add(input: {...})` + one generic `update(id, patch)`.** One breaking change to `add` now; every later field-slice just widens the `input` object and the `update` patch type. Chosen.
- **C — keep `add(title)` + a per-field setter** (`setDoneWhen`, `setPriority`, …). The seam interface grows one method per field; by S5 that is ~4 near-identical setters.

Decision: **B**. The seam exposes:

```ts
add(input: { title: string; done_when?: string /* widened by S3–S5 */ }): Promise<Task>
update(id: string, patch: Partial<Pick<Task, 'title' | 'done_when' /* widened by S3–S5 */>>): Promise<Task>
```

Field-growth slices extend the `input` shape and the `Pick` union — they do **not** add seam methods. `update` rules (set in the S2 grill): a patch whose `done_when` is empty/whitespace unsets the field (it is not stored as `''`); a patch that would empty the title throws, matching `add`; an unknown id throws `Task <id> not found`, matching `toggleDone`; an omitted key leaves that field untouched (true partial merge).

Why this is worth recording: a future reader sees `add` taking an object and a single generic setter and will ask why. The answer is that the seam is deliberately mutation-generic so the S2–S9 field-growth sequence — and the eventual `VaultSync` body that replaces `LocalOnly` at the seam — never has to widen the seam's method surface, only its types.

Trade-off accepted: one breaking change to `add` at S2 (five in-repo call sites, no external consumers) buys a method surface that stays fixed while the `Task` model keeps growing.

## Addendum (S3) — clearing non-string fields

`done_when` is unset by passing empty/whitespace (a string can be "emptied"). Numeric/enum fields like `priority` (S3) have no empty form, so the canonical **clear-to-unset signal is the key present in the patch with value `undefined`**: `update(id, { priority: undefined })` (guarded by `'priority' in patch`) **deletes** the key. The field is never stored as `null` or `undefined` — an unset task simply has no key, matching `done_when`'s "never store `''`". Omitting the key entirely still means "leave untouched". Future non-string field-slices follow this same pattern. The seam also **validates** an in-range value (`priority ∈ {1,2,3}`) and throws otherwise, mirroring the empty-title throw, because the seam is the trust boundary for non-typed callers (seed import, Telegram bot).
