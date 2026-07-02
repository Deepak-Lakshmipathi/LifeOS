# LifeOS — Handoff

Last updated: 2026-07-02. Picks up after **Group E Wave 8+9 (partial): S16 Telegram-bot text→create is MERGED and live, S17/S18/S19 are SPECCED (issues + ADRs on master), and S19a (photo ingest) is MERGED.** The app is a tab-navigated, glass-skinned PWA command center backed by a real Obsidian git-vault (`VITE_VAULT=1`), plus a separate Telegram bot capture face (`services/bot/`). **Groups A + B + C + D COMPLETE (MVP + full vault sync). Group E in progress: S16 done, S19a done, S17 + S18 + S19b remain.**

> **NEXT SESSION — read this first.** Three implementation slices remain: **S17 (#75), S18 (#78), S19b (#72)**. The prior session was asked to run them "as afk-pipeline auto in parallel where possible." **Parallel is NOT possible for these three — all three edit `services/bot/router.ts`** (S17 a confirm-gate branch, S18 a voice-ingest branch, S19b a photo/confirm branch). They MUST be dispatched **serially**, one implementer at a time, each branched off fresh `origin/master` AFTER the previous one merges (so it rebases onto the prior router edit). Batching them = guaranteed `router.ts` add/add conflict. See "Next vertical" below for the exact runbook.

## What LifeOS is
A personal, Apple-feel life tracker for a single user (the repo owner), built local-first as an installable PWA that runs offline on Windows and Android, with an Obsidian markdown vault as the real source of truth and three faces: **PWA dashboard, Telegram bot, Obsidian itself.** Seed data in `seed_tasks_detailed.json` (107 tasks) captures long-term intent. Read `CONTEXT.md` for the glossary, `docs/slices/README.md` for the slice backbone + product vision, `memory/lifeos-vision-2026-06-22.md` for full design rationale.

## Current state (on `master`, tip `cc339c4`)
**Slices S1–S16 complete + S19a merged.** Working installable offline PWA (nav shell, glass look, smart capture, Pulse, NOW balance-brain), a live Obsidian-vault backend behind `VITE_VAULT=1`, and a Telegram bot (`services/bot/`) that turns a text message into a vault task.

- **MVP (Groups A–C, S2–S13):** Task model (`done_when`/`priority`/`project`/`domain`/`completed_at`), NOW balance-brain (per-domain cap + cold-domain rescue), tap-the-dot complete + undo, derived domain warmth, glass/time-of-day skin, smart-capture `+` sheet, Pulse trends. All pure seams (`rankNow`, `computeWarmth`, `parseCapture`, pulse metrics).
- **Vault sync (Group D, S14–S15):** git-as-transport read + write; vault is the real truth. `VaultSync` provider swapped at the seam when `VITE_VAULT=1`. Single-line splice via in-memory source-map, FIFO write-queue, local-authoritative commit + best-effort push, wipe-reclone data-loss guard.
- **Bot (Group E, S16 — MERGED, live):**
  - **S16a (#64→PR #67):** durable `id::` vault identity. `parseTaskLine` reads optional `id::`; `serializeTaskLine` always emits it (after title). Legacy lines stamped lazily on next write — **no schema change, no bulk migration.** ADR-0011 §3.
  - **S16b (#65→PR #68):** bot core in `services/bot/` — long-poll worker, owner-chat-id guard, `claude-sonnet-5` structured-output NLU (create-only), self-registering intent router (`intents/` + `registry`), over a fake transport. Adds a `bot-test` CI job; `vite.config.ts` excludes `services/**` from the PWA vitest.
  - **S16c (#66→PR #69, HITL):** real Node `isomorphic-git` transport (commit-local → best-effort push, wipe-guard ported from S15b) + live Telegram wiring. Bot's own `BOT_VAULT_PAT`. **⚠️ Merged CI-green but the 5-case LIVE verify was NOT run** — see "Outstanding HITL" below.
  - **S19a (#71→PR #81):** photo ingest — `telegramClient.downloadPhoto` + `visionExtract.ts` (`claude-sonnet-5` vision, `{tasks:[…]}` structured output, cap 20). Router-free, additive. 54/54 bot tests.

Repo: `Deepak-Lakshmipathi/LifeOS` (public), default branch `master`. Ship via branch + PR — direct push to `master` is gated.

**Open issues (all `ready-for-agent`):**
| Issue | Slice | Type | Status | Blocked by | Touches `router.ts`? |
|-------|-------|------|--------|-----------|----------------------|
| #75 | S17 confirm update/delete | AFK impl | ready | — (S16 merged) | **YES** (confirm gate) |
| #78 | S18 voice notes | AFK impl | ready | — (S16 merged) | **YES** (voice branch) |
| #72 | S19b photo batch-confirm + wiring | AFK impl | ready (S19a merged) | — | **YES** (photo branch) |
| #70 | PRD: S19 photo | tracking | open | — | — |
| #74 | PRD: S17 confirm | tracking | open | — | — |
| #77 | PRD: S18 voice | tracking | open | — | — |

PRD parents (#70/#74/#77) are tracking issues — close them when their slice merges. `id::` durable identity already landed (S16a), so no identity blocker remains.

**Open PRs:** none.

## Outstanding HITL — S16c live verify (owner-only, cannot be automated) ⛔
S16c shipped CI-green but the git-network + live-Telegram path is not CI-verifiable (no remote/token/key in CI). The 5-case checklist at `afk-pipeline-out/s16c-verify-checklist.md` has **not** been run. Before trusting the bot in production, the owner must: set up `services/bot/.env` (bot-scoped `BOT_VAULT_PAT`, Telegram token via @BotFather, owner chat-id, `ANTHROPIC_API_KEY`), `cd services/bot && npm install && npm start`, then verify: (1) owner text → real commit (author `LifeOS Bot`, non-empty `id::`) → pushed → shows on PWA → `✓ added` reply; (2) offline commit survives + pushes on reconnect; (3) non-owner ignored; (4) ambiguous domain → Inbox; (5) non-create intent → "not yet supported". **An agent cannot do this.**

## Next vertical — Group E finale: S17 ∦ S18 ∦ S19b (SERIAL, not parallel) 🔴
All three edit `services/bot/router.ts` (`handleIncomingMessage`), different regions but the SAME file — the established rule (see Lessons) is **serialize, do not batch**. Recommended runbook for the next session:

1. **Pick an order.** Suggested: **S19b (#72) → S17 (#75) → S18 (#78)**. Rationale: S19b completes the photo vertical (freshest context, S19a just landed); S17 introduces the generic confirm model; S18 (voice) is a thin ingest branch that reuses whatever's registered. Any order works — the constraint is serial, not the sequence.
2. **For each slice, in turn:**
   - Branch off **fresh `origin/master`** (`git fetch origin && git checkout -b afk/<slice> origin/master`) — this is what makes the second/third slice rebase onto the prior router edit. Use **`isolation: "worktree"`** on the Agent call (see Lessons — shared-checkout agents race on HEAD).
   - Dispatch a **Sonnet 5** implementer with the issue as the spec (`gh issue view <n>`) + its ADR (0012 photo / 0013 confirm / 0014 voice, all on master). Instruct: **code + tests only**; do NOT touch `kanban.html`/`CONTEXT.md`/`docs/` (orchestrator manages the board); secrets env-only; don't stage `node_modules` or the pre-existing untracked files.
   - Gate: **dual-green** (CI `bot-test`+`build-test`+`pwa-e2e` AND a ponytail self-review). Merge (squash, delete branch), sync master, prune the worktree.
   - Only then start the next slice (off the now-updated master).
3. **"Run in parallel where possible" resolves to: none of these three parallelize.** The parallelism was already spent on the *spec* pipelines (S17/S18/S19 ran concurrently to produce the issues). Implementation of router-touching slices is inherently serial. Do not attempt to batch them.

After all three merge, Group E (and the slice backbone) is complete — one vault, three faces.

## Deferred board flip
The **S19a kanban card still shows `column: "ready"`** on master (should be `done`, PR #81). The flip was deferred to avoid a one-line CI-gated PR; fold it into the next board reconciliation (e.g. bundle with this handoff's PR or the first S17/S18/S19b merge). S19b's dispatchability does not depend on it (its real gate — S19a code on master — is satisfied).

## Architecture (decided — do not re-litigate)
- **Stack:** Vite + React + TS, Tailwind, Framer Motion, Dexie/IndexedDB (PWA); Node/TS long-poll worker (bot). ADR-0001.
- **Data access via a seam:** `src/sync/SyncProvider.ts`; impls `LocalOnly` (Dexie) and `VaultSync` (git vault). UI/components/hooks import only `SyncProvider` + `src/types`. Provider swapped in `App.tsx`. ADR-0002.
- **Mutation generic** (ADR-0004): `add(input)` + one `update(id, patch)`. New fields widen the patch; they don't add methods.
- **Not every field indexed** (ADR-0005): `project`/`domain`/`completed_at` are denormalized, no Dexie index, schema stays **v2**.
- **`id::` durable identity** (ADR-0011 §3): vault-format field only; no `Task`/Dexie change; lazy backfill.
- **Bot ↔ PWA meet only at the vault git repo**, never in-memory (ADR-0011). Bot has its own `BOT_VAULT_PAT`, runs as a long-poll worker (ADR-0011 §1). Intent router = self-registering handlers in `services/bot/intents/`, one file + one append-only import per intent (ADR-0011 §4) — BUT the message-ingest layer (`router.ts` `handleIncomingMessage`) is a shared hotspot the modality slices all touch.
- **Bot NLU ≠ PWA capture:** bot uses `claude-sonnet-5` structured output; the PWA `+` sheet uses the regex `parseCapture` — deliberately uncoupled (ADR-0011).
- **Testing:** CI gates `build-test` (Vitest, PWA), `bot-test` (Vitest, `services/bot`), `pwa-e2e` (Playwright install/offline/persistence). ADR-0003.

## Key files
```
src/…                       PWA (see prior handoff history / CONTEXT.md; unchanged this session)
src/vault/parseVault.ts     parseTaskLine reads optional id:: (S16a)
src/vault/serialize.ts      serializeTaskLine always emits id:: (S16a)
services/bot/index.ts       long-poll worker entry; constructs real transport from config (S16b/c)
services/bot/router.ts      handleIncomingMessage — owner guard + dispatch. ⚠️ SHARED HOTSPOT (S17/S18/S19b all extend it)
services/bot/nlu.ts         claude-sonnet-5 structured-output intent+extract (S16b); ClaudeClient + CLAUDE_MODEL exported here
services/bot/intents/        self-registering intent handlers (create.ts) + registry.ts + index.ts (ADR-0011 §4)
services/bot/telegramClient.ts  getUpdates long-poll + sendMessage + downloadPhoto (S16b/S19a)
services/bot/visionExtract.ts   claude-sonnet-5 vision → {tasks:[…]} cap 20 (S19a)
services/bot/vaultTransport.ts  real Node isomorphic-git transport (S16c)
services/bot/config.ts      env: TELEGRAM_BOT_TOKEN, BOT_VAULT_PAT, BOT_VAULT_REPO_URL, ANTHROPIC_API_KEY, OWNER_TELEGRAM_CHAT_ID
docs/adr/0011-…             bot transport / identity / router seam (S16)
docs/adr/0012-bot-photo-vision.md      S19 (photo)
docs/adr/0013-bot-confirm-destructive.md  S17 (confirm)
docs/adr/0014-bot-voice-transcription.md  S18 (voice; renumbered from a parallel-run 0012 collision)
kanban.html                 live board (#board-data JSON); S19a card flip still pending (see above)
afk-pipeline-out/           deploy tables + s16c-verify-checklist.md
```

## Run it
```
npm install && npm run dev            # PWA
npm test                              # PWA Vitest  (note: 'Seam isolation' test can TIMEOUT locally on a slow box — known flake, trust CI)
npm run build && npm run preview
npx playwright install chromium && npm run test:e2e
cd services/bot && npm install && npm test   # bot Vitest
cd services/bot && npm start          # run the live bot (needs .env)
```

## Lessons / gotchas (carried + new this session)
- **Parallel git-writing subagents MUST use `isolation: "worktree"`.** This session ran S17/S18/S19 spec pipelines concurrently in ONE shared checkout — they raced on `HEAD` (one agent's commit landed on a sibling's branch). Both self-recovered (cherry-pick back, reset sibling to origin), no work lost, but it was luck. S19a was then dispatched with `isolation: "worktree"` — no race. Always isolate concurrent agents.
- **`services/bot/router.ts` is a modality hotspot.** S17/S18/S19b all extend `handleIncomingMessage`. The intent-router *registry* (ADR-0011 §4) was designed disjoint (one file per intent), but the ingest dispatch in `router.ts` is shared — so modality slices serialize. Confirmed by two independent pipelines flagging it.
- **A stale docs branch is a merge trap once code has landed.** The S16 docs branch was cut before the S16a/b/c code PRs; a direct merge would have reverted `services/bot` + `src/vault`. Fix: rebuild docs on a fresh branch off current master and cherry-pick only the doc artifacts (verify the staged diff is docs-only before commit). This is why PR #80 (Group E docs reconciliation) exists instead of merging the four pipeline branches directly.
- **Parallel pipelines pick colliding ADR numbers.** S18 and S19 both grabbed 0012. Renumber during central reconciliation (S18 → 0014) and fix the internal refs in the slice's deploy/prd/issue docs.
- **A subagent can hit the account session limit mid-run.** S16b's implementer died before committing; its work survived UNCOMMITTED in the (shared) worktree. Recovery: verify locally (run the suite), stage only the slice's files (exclude pre-existing untracked), commit/push/PR yourself, let CI gate. Always check `git status` + `gh pr list` before assuming a silent agent's work is lost.
- **HITL splits the gate:** CI green covers only what runs without a remote. Isolate the non-CI-verifiable part (S15b, S16c) into its own slice so only the minimum needs an owner hand-verify.
- **`pwa-e2e` occasionally flakes on an SW-timing race** (offline-persistence test, `emu-test` not visible). If the diff didn't touch `src/`/`e2e/`, re-run the job once (`gh run rerun <id> --failed`) before treating it as real.
- **Local `npm test` exit-1 ≠ CI red:** the `Seam isolation` static-analysis test can time out on a slow machine while CI is green. Trust CI as the gate.
- **The Obsidian vault (`LifeOS-Vault/`) is graphify OUTPUT, not source** — never hand-edit; exclude `LifeOS-Vault/`, `graphify-out/`, `.obsidian/` from re-graphifying.

## How work ships here (afk-pipeline workflow)
Plan/grill → PRD/slice issues (afk-pipeline `auto` runs this headless) → Sonnet implementer agents in isolated worktrees off fresh `origin/master` → PR → **dual-green** (CI + ponytail-review) → orchestrator merges → next slice. Update `kanban.html` `#board-data` when a slice ships. Dispatch waves are derived batches: only pairwise-disjoint write-sets run concurrently; shared-hotspot slices (like the three remaining router slices) serialize.
