# Vault read transport: git-as-transport (in-browser clone)

Status: **Accepted**. Supersedes/extends [ADR-0002](0002-local-first-sync-deferred.md) on the transport question it deferred.

S14 swaps the `SyncProvider` seam body from `LocalOnly` to a `VaultSync` that **reads** the Obsidian vault. The vault is files; the PWA is sandboxed. Three transports were on the table: a co-located **bridge service**, the **File System Access API**, and **git-as-transport**.

## Decision

Adopt **git-as-transport**: the PWA clones the vault git repo (`Deepak-Lakshmipathi/LifeOS` vault) into local storage (isomorphic-git over a virtual FS in IndexedDB) and reads markdown from that local replica. A CORS proxy fronts the git remote.

Why git over the slice doc's tentative bridge lean:
- **Offline on Android away from home is a hard requirement** (CONTEXT.md: "runs offline on Windows and Android"). A bridge service is network-dependent from a phone off the home LAN — it fails this on mobile. FS Access API is Chromium-desktop-only (`showDirectoryPicker` absent on Android) — it fails mobile outright.
- A git clone materialises a **full local replica inside the PWA's own storage**, so reads are served locally on both Windows and Android — genuinely offline after first clone.
- Git *is* the truth-carrier, aligning with "vault is source of truth", and the same clone/commit/push mechanism becomes the **S15 write path** — one transport for both slices, no second transport later.

## Scope of S14 (read-only) — what this ADR deliberately does NOT change

- **No `Task` shape change. No `updated_at`/`deleted_at`. No tombstones. No Dexie migration — schema stays v2.** These are conflict-reconciliation machinery for a bidirectional writer. S14 has one writer (the vault) and one direction (vault → UI); nothing to reconcile. They land in **S15 (write)**, per ADR-0002 ("sync fields added in the slice that turns on sync") and ADR-0005 ("index/bump only when a field gets a real seam query"). This resolves the HANDOFF-vs-slice-doc discrepancy in the slice doc's favor.
- **Conflict model:** none beyond "vault wins". The Dexie cache (or plain React state) is a **disposable read-through projection** — load = replace the list, rebuilt from `parseVault(files)`. A task removed from the vault vanishes on next re-read. No LWW at read.
- **Change detection:** git commit / blob SHAs (free from the clone) — reparse only changed files.

## Consequences

- **Parser stays pure and in the PWA**, behind a transport adapter interface: `parseVault(files): Task[]` + `parseTaskLine(line)`, fixture-tested (incl. malformed lines — skip gracefully). Transport can change without touching the parser; reused by S15.
- **Trigger:** on-open + on-focus (visibilitychange) + manual `refresh()`. No polling, no file-watch (PWA sandbox can't push-watch). `useTasks` already lists on mount and exposes `refresh()`.
- **Rollout:** env flag, `LocalOnly` remains default and **permanent offline fallback**; `VaultSync` mutations throw `read-only` until S15. One-line provider selection in `App.tsx`.

## Costs accepted

- A **read-only, fine-grained PAT scoped to the single vault repo** at rest in IndexedDB (add write scope at S15). Browser storage is not a secret vault; blast radius is limited by single-user personal devices. Never log the token.
- A **CORS proxy** for the git remote, and an initial clone cost.
- More moving parts in the PWA than a bridge's plain `fetch`.

## Pivot noted for the record

If the owner later accepts that **Android is only ever used on the home LAN**, the bridge service becomes the simpler pick (a ~25-line `node:http` read API by the vault, PWA `fetch()`s markdown, one bearer token). As the requirement is currently written ("offline on Android"), git wins. Because the transport lives behind the adapter, this swap would touch only the transport adapter, not the parser or the seam.
