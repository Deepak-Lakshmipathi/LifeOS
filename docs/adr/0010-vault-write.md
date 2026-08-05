# Vault write: single-line splice, no sync fields, in-memory identity

Status: **Accepted**. Extends [ADR-0009](0009-vault-read-transport.md) (vault read) and supersedes the S15 forward-notes in [ADR-0002](0002-local-first-sync-deferred.md).

S15 turns `VaultSync`'s throwing mutations (`add`/`update`/`toggleDone`/`delete`) into real writes: edit the local git clone's markdown, commit, best-effort push. The vault becomes the real source of truth for writes, not only reads.

Resolved in an afk-pipeline grill (Senior Architect + Software Engineer/ponytail). The two voices converged on everything except identity; the identity ruling is recorded below with its upgrade path.

## Decision tree

### 1. No `Task`-shape change, no Dexie migration — stay v2.
`updated_at`/`deleted_at`/LWW/tombstones are reconciliation machinery for **two live replicas of one store writing concurrently**. S15 has neither: exactly one `SyncProvider` is active at a time (`VITE_VAULT=1` → `VaultSync`, which never imports `db`), and cross-device propagation is carried by **git at file/line granularity**, not by record-level LWW inside the app. HANDOFF.md's "sync fields + migration + LWW land here" is the stale S14-draft over-scope that ADR-0009 §16 already reversed — S15 inherits that reversal, it does not reopen it. Delete = physically remove the markdown line (a real absence on next read, per the disposable-projection model); git history is the tombstone. **Add these only when** a true dual-write (`LocalOnly` **and** `VaultSync` mutating the same records) exists — which the one-provider-at-a-time design rules out.

### 2. Identity — in-memory source-map, no `id::` in markdown.
`parseVault` mints a fresh id per read, so `Task.id` is meaningful only **within one `list()`→mutation window** — which is exactly the window `useTasks` guarantees (it refreshes after every mutation). So no durable id is needed.

`VaultSync.list()` builds `private snapshot: Map<id, { path, rawLine }>` while it parses (free — it produced the list). A mutation reads that file's current content, finds the **exact verbatim `rawLine`**, splices/removes it, writes back. Raw-text match survives Obsidian inserting lines above the target. If the match count is **not exactly 1** (duplicate identical lines, or the line changed under us), the mutation **throws** and forces a `refresh()` — safe-fail, never a silent wrong edit.

- Rejected: stamping a durable `id::` UUID into every written line — pollutes the owner's hand-authored Obsidian markdown permanently to solve a problem the refresh-after-mutate loop already solves for a single user, and would force `parseVault` edits that risk S14's 52 green fixtures.
- Rejected: blind positional (line-index) match — breaks when Obsidian reorders/inserts lines.
- **Upgrade path (`id::` durable identity):** adopt the stamped-`id::` scheme (parser reads it when present, mints on first write) **when a second live mutator** — the **S16 Telegram bot** editing tasks it did not author in the same session — makes in-memory session identity insufficient. That is the slice that pays for `id::`, not S15.

### 3. Write granularity — surgical single-line edit, NEVER whole-file rewrite.
`parseVault` is **lossy**: it silently drops frontmatter, headers, prose, blank lines, and non-task bullets. Reconstructing a file from `Task[]` would delete all of that — catastrophic loss inside the owner's Obsidian notes. Rule: read raw content → `split('\n')` → replace/insert/remove exactly the one target line → rejoin → write; every other byte preserved. This is the load-bearing integrity decision of the slice.

### 4. Serializer — new pure module `src/vault/serialize.ts`.
`serializeTaskLine(task): string`, the inverse of `parseTaskLine`, pure/no-I/O, round-trip fixture-tested (`parseTaskLine(serializeTaskLine(t))` ≡ `t` over modeled fields). Bracket-free canonical format, fixed field order, emit-only-when-present:
```
- [ ] Title done_when:: <text> priority:: <1|2|3>
- [x] Title priority:: 2
```
Single leading space before each `field::` (satisfies the parser's `/\s+(done_when|priority)::\s+/`). Emit `done_when` before `priority` so the parser (which ends each value at the next marker) round-trips. No `id::` (see §2). Stays pure like `parseVault`; all I/O lives in `VaultSync`.

### 5. add() — append one line; path from (domain, project); reserved Inbox home.
Path resolution:
- domain + project → `<domain>/<project>.md`
- domain, no project → `<domain>/Inbox.md`
- no domain, project → `Inbox/<project>.md`
- neither → `Inbox/Inbox.md`

Supporting rules: (a) `parseVault` maps filename `Inbox` (case-insensitive) → `project = undefined` (keeps the derived-Inbox contract without inventing a real project named "Inbox", which CONTEXT.md forbids); (b) `transport.readFiles()` also scans a top-level `Inbox/` folder (it currently iterates `DOMAINS` only, so domain-less writes would be unreadable on next `list()` — a real gap, since smart-capture produces domain-less tasks). Missing dir/file → create (mkdir-recursive, write the single line, no fabricated header). "Inbox" is not in `isDomain`, so `domain` stays `undefined` on re-read.

### 6. completed_at / created_at — stay ephemeral, NOT persisted in S15.
`toggleDone` writes the `[x]`/`[ ]` checkbox only; timestamps stay synthesized-as-now on next read, exactly as S14. Stated consequence, **inherited from S14, not regressed by S15**: under `VaultSync`, warmth and pulse are degraded (every done task reads completed "now", every task created "now"), and `list()` newest-first collapses to parse order. Restoring truthful warmth/pulse = a future slice writing `completed_at::`/`created_at::` inline — deferred, gated on the timestamp-in-markdown legibility call.

### 7. Commit & push — local commit is authoritative, push is best-effort/deferred.
Each mutation: (1) edit file in lightning-FS, (2) `git.add` + `git.commit` locally (always succeeds offline — full local repo), **resolve the mutation here**, (3) attempt `git.push`; on failure (offline/non-ff) swallow and leave the commit local. Unpushed local commits **are** the queue (git's native model — no separate queue infra); opportunistically retry push at the next mutation and next `list()`/on-focus refresh. Non-fast-forward divergence (Obsidian pushed meanwhile) → retain local, retry, surface a soft "sync pending"; **no auto-merge in S15**.

### 8. Concurrency — single-writer serialization via an in-memory promise chain.
lightning-FS / isomorphic-git on one FS is not concurrent-safe. `VaultSync` holds `private queue: Promise<unknown> = Promise.resolve()`; every mutation does `this.queue = this.queue.then(work); return this.queue` → strict FIFO, one git op at a time, no library. ~5 lines.

### 9. PAT scope — upgrade + doc, no architecture change.
Regenerate the fine-grained PAT with **Contents: Read *and* Write** on the single vault repo; update the `VITE_VAULT_PAT` env note. `onAuth` already flows into `git.push` via `sharedOpts`, so no wiring change. Accept the larger at-rest blast radius under the single-user personal-device threat model ADR-0009 already accepted. Never log the token.

## Must-fix transport hazard (correctness prerequisite, not nice-to-have)
`GitTransport.readFiles()` (transport.ts ~L100–116) does `git.pull({fastForwardOnly:true})` **else wipe-and-reclone** (`new LightningFS(FS_NAME, { wipe: true })`). Once S15 has **unpushed local commits**, a wipe-reclone **destroys committed offline writes** — silent data loss. S15 must make the fallback non-destructive: push pending commits first, and only wipe-reclone when the local repo has **no** commits ahead of origin. Both grill voices flagged this independently.

## Scope fence — explicitly OUT of S15
- `updated_at`/`deleted_at`/tombstones/LWW/Dexie migration (§1).
- Durable/stamped `id::` identity (§2 upgrade path — lands with the S16 bot).
- `completed_at`/`created_at` persistence → warmth/pulse stay degraded (§6).
- Cross-device git **merge / conflict resolution** — non-ff divergence handled minimally (retain-local + retry + soft "pending"); 3-way merge / conflict UI deferred.
- Any dual-write or Dexie↔vault reconciliation — one provider active, still true.
- File-watch / polling / real-time sync — trigger stays on-open/on-focus/manual (S14).

## HITL flags (documented assumptions — auto-mode; confirm with owner)
- **(A) Inbox layout:** top-level `Inbox/` folder + `Inbox.md` files as the home for domain-less/project-less tasks, and the PWA is allowed to create folders/files in the vault. **Assumed yes.**
- **(B) Commit identity/message:** author `LifeOS PWA <noreply>`, message `lifeos: <op> <title>`. **Assumed.**
- **(C) Timestamp persistence (§6):** whether a later slice should write `completed_at::`/`created_at::` to make warmth/pulse truthful, accepting the markdown legibility cost. **Owner's call, deferred.**
- **(D) Live-vault write verification:** the git-write transport (S15b) cannot be CI-verified (no remote in CI); it needs a hand-verify against the real vault with the write-scoped PAT. **S15b is HITL by construction.**

## Slicing
- **S15a (AFK):** pure serializer + `VaultSync` real mutations (splice, source-map, write-queue), driven by a **fake transport** → fully Vitest-covered, dual-green in CI. Adds `writeFile` to the `VaultTransport` interface + a throwing `GitTransport` stub. Write-set: `src/vault/serialize.ts`, `src/vault/serialize.test.ts`, `src/sync/VaultSync.ts`, `src/sync/VaultSync.test.ts`, `src/vault/transport.ts` (interface line + stub).
- **S15b (HITL):** real `GitTransport.writeFile` (add/commit/best-effort push) + the wipe-reclone hazard fix + `Inbox/` folder scan + `parseVault` Inbox-filename rule. Not CI-testable → hand-verify against the real vault with the write PAT. Write-set: `src/vault/transport.ts`, `src/vault/parseVault.ts`. Blocked by S15a.

See also: [ADR-0016](0016-single-owner-vault-fs.md) — single owner of the vault FS and non-stealing reset (S66/#176); it changes *how* a reset is performed and leaves this ADR's `commitsAhead === 0` gate byte-identical.
