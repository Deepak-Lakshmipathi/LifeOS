# Slice S15 — Obsidian vault write (VaultSync write)

> Read `docs/slices/README.md` + `CONTEXT.md` + `docs/adr/0010-vault-write.md` first.

**Group:** D · **Depends on:** S14 (vault read) · **Status:** planned · **All design locked in ADR-0010 — carry it, don't reopen.**

## Why
S14 made `VaultSync` read the vault; its mutations still throw `'vault is read-only until S15'`. S15 makes them real writes so the vault becomes the source of truth for writes too — and exports the serializer + `writeFile` transport that the S16 Telegram bot reuses.

## Scope — split by AFK/HITL verifiability (ADR-0010 §Slicing)
- **S15a (AFK):** pure `serializeTaskLine` + `VaultSync` real mutations (single-line splice, in-memory source-map identity, promise-chain write-queue), tested against a **fake transport** (no git/network). Extends the `VaultTransport` interface with `writeFile` + a throwing `GitTransport` stub.
- **S15b (HITL):** real `GitTransport.writeFile` (add/commit/best-effort push) + the wipe-reclone hazard fix + `Inbox/` folder scan + `parseVault` Inbox-filename rule. Needs write-PAT + live vault → hand-verify.

## Out of scope (ADR-0010 scope fence)
Sync fields / `updated_at` / `deleted_at` / tombstones / LWW / Dexie migration; durable `id::` identity (S16); `completed_at`/`created_at` persistence (warmth/pulse stay degraded, inherited from S14); git merge / conflict UI; dual-write; file-watch/polling.

## Data / model change
**None.** No `Task` shape change, schema stays v2, no migration (ADR-0010 §1).

## Acceptance criteria (done_when)
**S15a:**
- [ ] `src/vault/serialize.ts`: pure `serializeTaskLine(task): string`, inverse of `parseTaskLine`, `done_when` before `priority`, emit-only-when-present, no `id::`.
- [ ] Round-trip test: `parseTaskLine(serializeTaskLine(t))` ≡ `t` over modeled fields (title/done/done_when/priority), for checked/unchecked, both fields either presence, neither.
- [ ] `VaultSync` mutations real: `add` appends a serialized line at the resolved path (ADR-0010 §5); `update`/`toggleDone`/`delete` splice/remove the matched raw line; non-unique match → throw. All other bytes of the file preserved.
- [ ] `VaultSync.list()` builds the source-map snapshot; mutations go through the promise-chain write-queue (FIFO).
- [ ] Tested against a **fake transport** that captures `writeFile(path, content)` — assert committed content, no network. `npm test` green.
- [ ] `VaultTransport` interface gains `writeFile(path, content, message)`; `GitTransport.writeFile` throws `'not implemented until S15b'` (VITE_VAULT off by default).

**S15b:**
- [ ] `GitTransport.writeFile`: FS write → `git.add` + `git.commit` (authoritative) → best-effort `git.push` (swallow failure).
- [ ] Wipe-reclone hazard fixed: never wipe when local commits are ahead of origin (ADR-0010 §Must-fix).
- [ ] `readFiles()` also scans top-level `Inbox/`; `parseVault` maps filename `Inbox` → `project = undefined`.
- [ ] Hand-verified against the real vault with a write-scoped PAT: a PWA mutation lands as a commit on the vault repo and re-reads correctly.

## Relevant files
`src/vault/serialize.ts` (new), `src/vault/serialize.test.ts` (new), `src/sync/VaultSync.ts`, `src/sync/VaultSync.test.ts` (new), `src/vault/transport.ts`, `src/vault/parseVault.ts` (S15b Inbox rule).

## Notes for executor
The splice must be byte-preserving on every non-target line — that is the load-bearing correctness property; test it. Keep all git/network behind the `VaultTransport` interface exactly as S14 did; S15a proves correctness with a fake transport, S15b wires the real git and is hand-verified. Do NOT touch `src/types/index.ts`, `src/db/`, `src/sync/SyncProvider.ts`, or `App.tsx`.
