# Slice S14 — Obsidian vault read (VaultSync)

> Read `docs/slices/README.md` + `CONTEXT.md` first.

**Group:** D · **Depends on:** S13 (MVP) · **Status:** planned · **⚠ Forces the deferred transport decision**

## Why
The vault is the product's promised source of truth. This slice swaps the seam's body from `LocalOnly` to a `VaultSync` that **reads** the Obsidian vault, so the dashboard reflects what's on disk and in Obsidian. Read-only first to de-risk parsing before writing back.

## ⚠ Gate — decide before building
The vault is files; the PWA is sandboxed. Pick the transport (was deferred in design):
- **Bridge service** (a small Node service co-located with the vault, exposes a read API; vault synced across devices via Syncthing/Obsidian Sync), **or**
- **File System Access API** (PWA opens a vault folder on desktop; no mobile), **or**
- **Git-as-transport** (PWA pulls a vault repo).
Recommended for a clean first cut: **bridge service read API**. Capture the choice in a new ADR (supersedes/extends ADR-0002).

## Scope — this slice only
- Markdown parser: read Domain folders → Project notes → `- [ ]`/`- [x]` task lines with inline `done_when::` and `priority::` fields → `Task[]`.
- `VaultSync implements SyncProvider` — `list()` reads the vault via the chosen transport; `add/toggleDone/delete` may throw "read-only" this slice (write is S15).
- Feature-flag the provider swap in `App.tsx` (env/flag) so MVP `LocalOnly` stays default until vault is solid.

## Out of scope
- Writing back to the vault (S15). Bot (Group E). Conflict resolution beyond read.

## Data / model change
- No `Task` shape change — the markdown is parsed *into* the existing model. Map `- [x]` → `done`, inline fields → `done_when`/`priority`, folder → `domain`, note → `project`.

## Vertical
- Logic: pure `parseVault(files): Task[]` + `parseTaskLine(line)` helpers, unit-tested against markdown fixtures.
- Seam: new `src/sync/VaultSync.ts`; transport adapter behind an interface.
- Config: provider selection flag in `App.tsx`.
- PWA: offline behavior depends on transport — document it in the ADR.

## Acceptance criteria (done_when)
- [ ] ADR written capturing the transport choice.
- [ ] `parseVault`/`parseTaskLine` parse the documented vault shape incl. checked/unchecked, missing inline fields, multiple projects/domains; unit-tested via fixtures.
- [ ] With the flag on, the dashboard lists tasks read from a sample vault.
- [ ] `LocalOnly` remains default when flag off; no MVP regression.
- [ ] Seam discipline intact (UI unchanged; only the provider body swapped).

## Relevant files
New `src/sync/VaultSync.ts`, new `src/vault/parseVault.ts` (+ fixtures + test), new transport adapter, `src/App.tsx`, new `docs/adr/0003-vault-transport.md`.

## Notes for executor
The parser is the risky part — fixture-test it hard, including malformed lines (skip gracefully). Keep transport behind an interface so it can change without touching the parser.
