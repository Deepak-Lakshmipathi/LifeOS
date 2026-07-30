# S61 — GitTransport: recursive, non-`.md` vault reads (closes #158) [HARD]

Post-v2 · Wave 12 · Deps: — · Blocks: S62 (transport.ts hotspot)

Source: GitHub issue **#158** (`ready-for-agent`). Read it before starting.

## Context
`GitTransport._readFiles()` walks a **hardcoded flat list** of top-level folders
and keeps only `entry.endsWith('.md')`. Every consumer folder outside that list
is silently invisible to the live app: 5 gaps found so far — Habits (#148),
Calendar (#151), Mail (#154) each patched one string at a time, and now
**`agents/<name>/status.json`** and **`Briefs/<date>.md`**, which the one-string
fix cannot reach: status is one directory deeper AND is `.json`, not `.md`.

Live consequence today: `FleetStrip` renders every agent idle regardless of real
status, and the S50 daily-brief morning block never appears. Both are shipped,
fixture-green, and dead in production. This slice fixes the **class**, not the
two instances — no more per-folder string patches.

Issue #158 offers two designs; pick one and justify it in the PR body:
1. Recursive descent + a `.json` allowlist scoped to `agents/`.
2. A separate `readAgentStatuses()` read path, leaving the markdown snapshot
   loop markdown-only.

Recommended: **(1) recursive descent, extension allowlist** — one loop, and
`Briefs/` gets fixed for free by the same change. Whichever you take, the
hardcoded folder list must stop being the thing that decides what the app can
see.

**Hazard — read this before touching anything (v2 session lesson, twice-burned):**
- **`VaultSync.list()` pollution.** Newly-surfaced files flow into `list()` and
  get run through `parseTaskLine`'s `/^- \[([ xX])\]…/` checkbox regex. Mail
  lines matched and needed an explicit `continue`; Calendar lines never matched.
  For EVERY newly-surfaced path, diff its line format against that regex and
  either add the guard **with a red-before-fix test**, or state in the PR
  precisely why no guard is needed. `.json` bodies are a fresh risk here.
- **Never construct the real lightning-fs backend in a test.** Any
  GitTransport-path test mocks it. Fingerprint of getting this wrong:
  `ReferenceError: navigator is not defined … DefaultBackend.init`, all tests
  pass but vitest exits 1.
- Keep `depth: 1` / the ADR-0010 pull-then-clone hazard logic untouched — this
  slice changes only what gets enumerated after the sync, plus a bounded
  recursion depth so a deep vault can't stall the read.

## Write-set
- MODIFY `src/vault/transport.ts` — `_readFiles()` enumeration.
- MODIFY `src/vault/transport.test.ts` — fixture FS with nested + non-`.md`
  entries.
- MODIFY `src/sync/VaultSync.ts` (+ test) — ONLY if the pollution diff above
  proves a guard is needed.
- MODIFY the stale gap comments that document this bug as permanent:
  `src/components/home/FleetStrip.tsx` (~L19-26) and
  `src/components/home/HomeView.tsx` (~L118-125).

## Subtasks
1. Reproduce: fixture FS with `agents/x/status.json` + `Briefs/<date>.md` → assert
they are missing today (red). 2. Implement the chosen design. 3. `VaultSync.list()`
pollution diff + guard-or-justify. 4. Delete the stale "out of write-set" comments.
5. Close #158 in the PR body.

## Definition of Done
1. A red-before-fix test proves `agents/<name>/status.json` and `Briefs/<date>.md` are absent from `readFiles()` output today, and passes after the change.
2. All previously-surfaced paths (7 domain folders, Inbox, Habits, Calendar, Mail) still round-trip byte-identically — no regression (tested).
3. `VaultSync.list()` returns no phantom tasks from any newly-surfaced file; if a guard was added it has a test that fails when the guard is removed (mutation-proven), if not the PR states why none is needed.
4. Recursion is depth-bounded and cannot loop; no test constructs a real lightning-fs backend.
5. ADR-0010 pull/clone/ahead-count hazard logic is byte-unchanged.
6. The stale gap comments in FleetStrip.tsx / HomeView.tsx are removed or corrected.
7. `npm run build` + `npm test` green incl. pwa-e2e; issue #158 closed by the PR.

## Tests
Nested + non-md enumeration; existing-folder regression; VaultSync pollution;
depth bound.

## Design refs
None ([HARD], no UI).

## Dispatch
`/afk-pipeline auto` with this file. Model: Sonnet (escalate to Opus on a 2nd
eval FAIL). SOLE `src/vault/transport.ts` toucher this wave — S62 rebases onto
this merge. Disjoint from S58 and S60.
