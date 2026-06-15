# Local-first; real sync deferred behind a no-op seam

Despite the cross-device requirement, Slice 1 ships **local-first with no backend**. Data lives in IndexedDB (via Dexie). The app calls a `SyncProvider` seam whose only Slice-1 implementation is a no-op `LocalOnly`.

Why: cross-device sync is the layer that historically kills personal-tool rewrites before they ship. Proving the local core loop (add → complete → persist → install → offline) first de-risks the project at the lowest cost. The seam means a later Slice swaps the implementation without touching call sites.

Decided deliberately: Slice 1 carries **no sync fields** (`updated_at`, `deleted_at`) — they are added in the Slice that turns on sync, with a migration. When sync lands it will use **last-write-wins per record** (not CRDT/Git), chosen for simplicity given a single user with at most two devices.

Trade-off accepted: until the sync Slice lands, the two devices do not share data automatically — a real gap against the stated requirement, taken on purpose to ship the core loop first.
