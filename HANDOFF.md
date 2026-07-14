# LifeOS — Handoff

Last updated: 2026-07-14 (pm). Picks up after the **S20 session**: v2 Wave 0 is **merged** — the Glass Cockpit design tokens are in code (PR #104 `dc47069`, board flip #105 `abbf9b8`). Wave 1 is now fully unblocked. The PWA remains deployed and live; the Telegram bot's owner-only live verify (S16c) is still the one outstanding human gate.

> **NEXT SESSION — DISPATCH WAVE 1 (4 slices, in parallel).** Run `/lifeos-boot`, then fan out **S21 · S22 · S23 · S57** concurrently — one Sonnet subagent per slice, each in its **own git worktree off fresh `origin/master`**, each dispatched as `/afk-pipeline auto` with its whole ticket file as input. Their write-sets are pairwise disjoint (verified below), so they cannot conflict. Feed `docs/DESIGN_LANGUAGE.md` into every `[UI]` slice. Merge each on **triple-green** (CI + ponytail-review + fresh eval subagent vs the ticket's numbered DoD). **Then S24 ALONE** — it is the sole `src/App.tsx` toucher, ever, and it gates the 8-wide Wave 3.

### Wave 1 dispatch table (copy this into the next session)

| Slice | Ticket | Write-set (why it's safe to parallelize) | Model |
|---|---|---|---|
| **S21** — Glass primitives | `docs/slices/slice-S21-glass-primitives.md` | NEW `src/components/glass/{Card,Chip,Vital,Segmented}.tsx` (+ tests). New dir; touches no existing component. | Sonnet |
| **S22** — Aurora canvas | `docs/slices/slice-S22-aurora-bg.md` | NEW `src/components/glass/Aurora.tsx` (+ test). Same dir as S21 but **different files** — git merges cleanly. | Sonnet |
| **S23** — `useTimeOfDay` | `docs/slices/slice-S23-time-of-day.md` | MODIFY `src/lib/timeOfDay.ts` (+ its test), NEW `src/hooks/useTimeOfDay.ts` (+ test). Disjoint from `components/**`. | Sonnet |
| **S57** — Scoped tokens + push wrapper | `docs/slices/slice-S57-scoped-tokens-push.md` | NEW `agents/lib/push.mjs` (+ test), NEW `docs/agents/vault-tokens.md`. `Deps: none`; zero overlap with `src/**`. Hardening — pull it forward because it's free parallelism. | Sonnet |

**Concurrency ceiling is 4 — not "everything".** The v2 graph is 11 waves deep and two chains are irreducibly serial: `src/App.tsx` (S24 alone, always) and `src/components/home/HomeView.tsx` (S27→S28→S29→S32→S34→S37→S48→S50, each mounting one card, rebase onto prior merge). `VitalsRow` (S26→S41→S45) and `AgentsView` (S49→S53→S54) serialize too. Real fan-out arrives at **Wave 3** (8 slices: S25·S26·S30·S33·S36·S39·S43·S47) once S24 lands the stub views. Full table: `docs/slices/README.md`.

**After Wave 1 → S24 (alone) → Wave 3 (8-wide).** Do not batch a hotspot-sharing slice with anything — v1's hardest-won lesson (`afk-pipeline-out/LESSONS.md`).

## v2 vision + design lock (this session, 2026-07-08 pm) 🎨
- **LifeOS v2 = life cockpit, not task tracker.** Grill session locked scope: time-aware check-in cockpit (morning brief / midday check / evening review), Today's Mission (1–3 balance-brain picks, why + done_when always visible), unified Attention stack (client email, job replies, bills, agent failures — Gmail-fed), Life Vitals row, calendar blocks + gap hints, habits (each habit FEEDS a domain's warmth), money (net worth/burn/portfolio/bills; Zerodha/Groww/CSV first), career tab (job pipeline kanban + course progress), agent fleet health board incl. a **supervisor** agent (weekly log audit, accuracy metrics, prompt patches gated on owner approval — confirm-destructive spirit extends to agent self-modification). Full detail: `memory/lifeos-v2-vision-2026-07-08.md`.
- **Design LOCKED: Glass Cockpit.** Three mockups built (`docs/mockups/cockpit-glass.html` ← chosen, `cockpit-terminal.html`, `cockpit-edition.html` — the other two kept for reference only). The contract extracted from the winner lives in **`docs/DESIGN_LANGUAGE.md`** — tokens, component specs, layout/IA (6 tabs: Home/Money/Career/Agents/Domains/Pulse), time-of-day system, motion/a11y, Do/Don'ts. Load it into every future coding session; deviations need a written one-line reason in the PR.
- Nothing shipped to `src/` this session — docs + mockups only.

## v2 progress (Glass Cockpit — slices S20–S57)

**Wave 0 done: S20 — design tokens (#103 → PR #104, merged `dc47069`).** `docs/DESIGN_LANGUAGE.md` §2 is now code: `src/styles/tokens.css` (all 17 §2.1 colors, §2.2 font stack, §2.3 radius/blur vars, `color-scheme: dark`), the §2.4 Tailwind mapping, and `src/index.css` on `--bg`/`--txt`. 379/379 tests green. Two things the next session must know:

- **The app still LOOKS like v1.** `body` sits on `--bg` now, but `src/App.tsx:79` paints a v1 light time-of-day gradient inline over it at runtime. `App.tsx` is **S24's exclusive hotspot** (out of every other slice's write-set), so the dark ground only becomes visible once **S22 (aurora) + S24 (shell)** land. This is expected — not a regression, don't "fix" it in a S21/S22/S23 PR.
- **The Tailwind extend is MERGED, not replaced.** v2's §2.4 keys sit *alongside* the v1 `apple-*` / `rounded-ios` / `shadow-glass-*` keys, because every shipped v1 component still uses them; replacing outright breaks the app. The v1 keys retire per-view as S21+ restyles each surface. A test in `src/test/tokens.test.tsx` pins them compiling until then.
- **Known cruft, deliberately not touched:** `tailwind.config.js` still carries a v1 `spring: cubic-bezier(0.34, 1.56, 0.64, 1)` bounce easing that the v2 motion contract (§7) has no room for. Out of S20's write-set. Kill it in a v1-teardown slice, or let it die as the v1 keys retire.

**The eval gate earns its keep on `[UI]` slices** — on S20 it caught `rgba` spacing drift between `tokens.css` and `tailwind.config.js` that both CI *and* review passed over. "Byte-exact to the contract" needs a reader that diffs characters. Keep dispatching it fresh (no shared context with the implementer).

## What LifeOS is
A personal, Apple-feel life tracker for a single user (the repo owner), built local-first as an installable PWA that runs offline on Windows and Android, with an Obsidian markdown vault as the real source of truth and three faces: **PWA dashboard, Telegram bot, Obsidian itself.** Seed data in `seed_tasks_detailed.json` (107 tasks) captures long-term intent. Read `CONTEXT.md` for the glossary, `docs/archive/V1_ARCHIVE.md` for the archived v1 slice backbone + product vision (v2 backbone: `docs/LIFEOS_V2_ROADMAP.md`, slices S20–S57), `memory/lifeos-vision-2026-06-22.md` for full design rationale.

## Current state (on `master`, tip `e6c8a62`)
**Slices S1–S19 ALL complete + the PWA is DEPLOYED LIVE.** Working installable offline PWA (nav shell, glass look, smart capture, Pulse, NOW balance-brain), a live Obsidian-vault backend behind `VITE_VAULT=1`, and a full Telegram bot (`services/bot/`): text→create, confirm-gated update/delete, photo→vision batch-confirm, voice→transcription. The hosted PWA now clones a real private vault repo in-browser through a self-hosted CORS proxy and loads real tasks — verified on desktop and mobile.

- **MVP (Groups A–C, S2–S13):** Task model (`done_when`/`priority`/`project`/`domain`/`completed_at`), NOW balance-brain (per-domain cap + cold-domain rescue), tap-the-dot complete + undo, derived domain warmth, glass/time-of-day skin, smart-capture `+` sheet, Pulse trends. All pure seams (`rankNow`, `computeWarmth`, `parseCapture`, pulse metrics).
- **Vault sync (Group D, S14–S15):** git-as-transport read + write; vault is the real truth. `VaultSync` provider swapped at the seam when `VITE_VAULT=1`. Single-line splice via in-memory source-map, FIFO write-queue, local-authoritative commit + best-effort push, wipe-reclone data-loss guard.
- **Bot (Group E, S16 — MERGED, live):**
  - **S16a (#64→PR #67):** durable `id::` vault identity. `parseTaskLine` reads optional `id::`; `serializeTaskLine` always emits it (after title). Legacy lines stamped lazily on next write — **no schema change, no bulk migration.** ADR-0011 §3.
  - **S16b (#65→PR #68):** bot core in `services/bot/` — long-poll worker, owner-chat-id guard, `claude-sonnet-5` structured-output NLU (create-only), self-registering intent router (`intents/` + `registry`), over a fake transport. Adds a `bot-test` CI job; `vite.config.ts` excludes `services/**` from the PWA vitest.
  - **S16c (#66→PR #69, HITL):** real Node `isomorphic-git` transport (commit-local → best-effort push, wipe-guard ported from S15b) + live Telegram wiring. Bot's own `BOT_VAULT_PAT`. **⚠️ Merged CI-green but the 5-case LIVE verify was NOT run** — see "Outstanding HITL" below.
  - **S19a (#71→PR #81):** photo ingest — `telegramClient.downloadPhoto` + `visionExtract.ts` (`claude-sonnet-5` vision, `{tasks:[…]}` structured output, cap 20). Router-free, additive. 54/54 bot tests.
- **Bot (Group E finale — MERGED 2026-07-05):**
  - **S19b (#72→PR #83):** photo batch-confirm — `photoConfirm.ts` (per-chat pending Map, 10-min TTL) + photo/confirm branches in `router.ts`; `all`/`none`/subset reply picks which extracted tasks get created via the unmodified `handleCreate`. 71 bot tests.
  - **S17 (#75→PR #85):** confirm-destructive update/delete — `taskMatch.ts` (fuzzy target match), `confirm/store.ts` (2-min TTL pending Map), `confirm/gate.ts` (y/n/disambiguation state machine, sole vault-writer), self-registering `intents/update.ts`+`delete.ts`. Router gate runs before NLU. ADR-0013. 131 bot tests.
  - **S18 (#78→PR #87):** voice notes — `transcription.ts` (Groq Whisper `whisper-large-v3-turbo`, never-throws, confidence = non-empty text AND mean `no_speech_prob` ≤ 0.5) + `downloadVoiceFile` + router voice branch; confident transcript flows through the *unmodified* `classifyAndExtract`→dispatch path, reply echoes `heard: '…' → …`. New env `GROQ_API_KEY`. ADR-0014. 141 bot tests. Zero diff in `intents/**` + `nlu.ts`.

Repo: `Deepak-Lakshmipathi/LifeOS` (public), default branch `master`. Ship via branch + PR — direct push to `master` is gated.

**Open issues:** none. All slice + PRD-parent issues (#70/#74/#77) closed. **Open PRs:** none. **Kanban:** all 30 cards `done` (the board tracks slices only; deployment infra below is post-backbone and lives in this handoff, not on the board).

## Deployment (live) 🚀 — added this session
The PWA face is hosted, installable, and wired to a real vault. Everything is single-user and keeps the vault PAT off any public bundle.

- **Live URL:** https://deepak-lakshmipathi.github.io/LifeOS/ — GitHub Pages, source = **GitHub Actions**. Auto-deploys on push to `master` via `.github/workflows/deploy-pages.yml` (build `VITE_VAULT=1`, `VITE_BASE=/LifeOS/`, **no PAT in the build env**). Pages serves under the `/LifeOS/` subpath — Vite `base` + base-relative manifest `start_url`/`scope`/icons (see `vite.config.ts`).
- **Vault repo:** `Deepak-Lakshmipathi/LiveOS-VaultRepo` (PRIVATE, default branch `main` — note the name is "**Live**OS", not "Life"). Seeded with all 107 tasks from `seed_tasks_detailed.json` (18 `<Domain>/<Project>.md` files, `serialize.ts` format). Distinct from the app repo. The bot writes here too (its own `BOT_VAULT_PAT`).
- **Runtime PAT (never baked):** `src/vault/pat.ts` reads the token from `localStorage`, prompting once on first load. The `import.meta.env.VITE_VAULT_PAT` fallback is guarded by `import.meta.env.DEV` so a production build dead-code-strips it. **Never set `VITE_VAULT_PAT` in the Pages build env** or it inlines into the public JS. Recovery UI: the error panel's "Re-enter token" calls `clearVaultPat()` + reload.
- **Self-hosted CORS proxy:** `cors-proxy/` — a Cloudflare Worker (`worker.js`, deployed via `wrangler`), live at `https://lifeos-git-proxy.ldeepak-kumar550v.workers.dev`. Replaces the public `cors.isomorphic-git.org` so the PAT + git traffic transit only the owner's Cloudflare account. Locked to the LifeOS origins + github.com git endpoints (not an open relay); maps isomorphic-git's `x-authorization` → `authorization`. The Pages build reads the URL from **repo variable** `VAULT_CORS_PROXY` (`gh variable set …`), so it isn't committed. Node self-check: `node cors-proxy/worker.test.mjs`.
- **Load fixes shipped this session (why it now works in-browser):**
  - `GitTransport.readFiles` dedupes concurrent callers behind one in-flight clone/pull — App fires two `list()` on mount (`seedIfEmpty` + `useTasks`) and two parallel clones into the same lightning-fs dir raced and rejected (PR #91).
  - `useTasks` initial load now `.catch`es and surfaces `error` (App shows an error panel + Retry/Re-enter) instead of a forever-spinner (PR #91).
  - `src/main.tsx` shims `Buffer` + `process` (from the already-present `buffer` dep) before any vault code loads — isomorphic-git references those Node globals and the browser threw `Buffer is not defined` (PR #92).
- **Session PRs:** #89 (Pages deploy + runtime PAT), #90 (self-hosted CORS proxy), #91 (load-hang fixes), #92 (browser Buffer/process shim). All merged.
- **To redeploy / operate:** merge to `master` (auto-deploys). To rotate the proxy: `cd cors-proxy && npx wrangler deploy`. To change the proxy URL: `gh variable set VAULT_CORS_PROXY --body <url>` then re-run the deploy workflow. Local dev vault mode still uses `.env` (gitignored; `.env.example` is the template).

## Outstanding HITL — S16c live verify (owner-only, cannot be automated) ⛔
S16c shipped CI-green but the git-network + live-Telegram path is not CI-verifiable (no remote/token/key in CI). The 5-case checklist at `afk-pipeline-out/s16c-verify-checklist.md` has **not** been run. Before trusting the bot in production, the owner must: set up `services/bot/.env` (bot-scoped `BOT_VAULT_PAT`, Telegram token via @BotFather, owner chat-id, `ANTHROPIC_API_KEY`), `cd services/bot && npm install && npm start`, then verify: (1) owner text → real commit (author `LifeOS Bot`, non-empty `id::`) → pushed → shows on PWA → `✓ added` reply; (2) offline commit survives + pushes on reconnect; (3) non-owner ignored; (4) ambiguous domain → Inbox; (5) non-create intent → "not yet supported". **An agent cannot do this.**

## Next task — v2 EXECUTION 🚀
v2 is fully prepped: design LOCKED (`docs/DESIGN_LANGUAGE.md`), backbone sliced + numbered (`docs/LIFEOS_V2_ROADMAP.md`, S20–S57), afk-pipeline v2 config seeded (`docs/agents/afk-pipeline.md`, PR #96), v1 archived (`docs/archive/V1_ARCHIVE.md`).

**Tickets are CUT (2026-07-14):** all 38 v2 slices have dispatch-ready tickets in `docs/slices/slice-S20…S57` (context, write-set, subtasks, numbered DoD, tests) + kanban cards `s20…s57` with `blockedBy` = true dep graph + hotspot chains. Wave plan + hotspot rules: `docs/slices/README.md`. Merge gate is now **triple-green** — CI + review + an eval subagent that checks the PR diff against the ticket's DoD (process in `docs/agents/afk-pipeline.md` "Eval gate").

Order of operations:
1. **Dispatch Phase 0** (S20 tokens → S21 primitives → S22 aurora → S23 timeOfDay) via afk-pipeline — S21/S22/S23 all dep on S20, so S20 lands first, then the other three can run parallel (disjoint write-sets).
2. Then Phase 1 (shell: S24 pill-tabs, S25 header, S26 vitals row) → Phase 2 (Home from existing data) → fan out Phases 3–7 in parallel.
3. **In parallel, owner runs the S16c bot live-verify** (see Outstanding HITL below) — the last v1 production-trust gate. An agent cannot do it. Prep is done (`.env` autoload, checklist updated for `GROQ_API_KEY`).
4. v1 user-testing checklist ("Get started & test" tab of `lifeos-hub.html`) still stands — walk it as real usage alongside v2 work; feedback → issues.

Known follow-ups (non-blocking): the Pages deploy workflow's `actions/*@v4` run on a deprecated Node 20 (bump when convenient); the runtime PAT uses a `window.prompt` (fine for single-user; a small settings input is the obvious upgrade).

## Outstanding board state
All 30 kanban cards are `done`; the hub rebuilds its progress stats live from `kanban.html`'s `#board-data`. No deferred flips remain.

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
services/bot/router.ts      handleIncomingMessage — owner guard, then voice/photo/confirm branches, then NLU dispatch (was the modality hotspot; now settled — all four modalities landed)
services/bot/nlu.ts         claude-sonnet-5 structured-output intent+extract (create/update/delete); ClaudeClient + CLAUDE_MODEL exported here
services/bot/intents/        self-registering handlers: create.ts (S16b) + update.ts/delete.ts (S17) + registry.ts + index.ts (ADR-0011 §4)
services/bot/taskMatch.ts   fuzzy target-task match for update/delete (S17)
services/bot/confirm/        store.ts (2-min TTL pending Map) + gate.ts (y/n/disambiguation state machine, sole vault-writer for edits) (S17)
services/bot/photoConfirm.ts    per-chat pending photo batch (10-min TTL); all/none/subset picks (S19b)
services/bot/telegramClient.ts  getUpdates long-poll + sendMessage + downloadPhoto (S19a) + downloadVoiceFile (S18)
services/bot/visionExtract.ts   claude-sonnet-5 vision → {tasks:[…]} cap 20 (S19a)
services/bot/transcription.ts   Groq Whisper voice→text + confidence gate; never throws (S18)
services/bot/vaultTransport.ts  real Node isomorphic-git transport (S16c)
services/bot/config.ts      env: TELEGRAM_BOT_TOKEN, BOT_VAULT_PAT, BOT_VAULT_REPO_URL, ANTHROPIC_API_KEY, GROQ_API_KEY, OWNER_TELEGRAM_CHAT_ID
docs/adr/0011-…             bot transport / identity / router seam (S16)
docs/adr/0012-bot-photo-vision.md      S19 (photo)
docs/adr/0013-bot-confirm-destructive.md  S17 (confirm)
docs/adr/0014-bot-voice-transcription.md  S18 (voice; renumbered from a parallel-run 0012 collision)
docs/DESIGN_LANGUAGE.md     LOCKED v2 visual contract (Glass Cockpit) — read before ANY UI work
docs/LIFEOS_V2_ROADMAP.md   v2 slice backbone (one slice = one issue = one subagent)
docs/mockups/               cockpit-glass.html (chosen) + terminal/edition (reference only)
kanban.html                 live board (#board-data JSON); all cards done
lifeos-hub.html             GENERATED showcase (Overview/Get-Started/Kanban/Graph tabs) — edit scripts/build-hub.mjs then rebuild
afk-pipeline-out/           LESSONS.md + s16c-verify-checklist.md (v1 deploy tables collapsed into docs/archive/V1_ARCHIVE.md)
src/main.tsx                shims Buffer + process (browser) before any vault code loads
src/vault/pat.ts            runtime PAT (localStorage prompt); DEV-guarded env fallback so it never bakes into a build
src/vault/transport.ts      GitTransport — now dedupes concurrent readFiles() behind one in-flight clone
cors-proxy/                 self-hosted Cloudflare Worker CORS proxy (worker.js + wrangler.toml + worker.test.mjs + README)
.github/workflows/deploy-pages.yml   build (no PAT) → deploy GitHub Pages on push to master
.env.example                PWA vault-mode config template (VITE_VAULT_REPO_URL/PAT/CORS_PROXY)
```

## Run it
```
npm install && npm run dev            # PWA
npm test                              # PWA Vitest  (note: 'Seam isolation' test can TIMEOUT locally on a slow box — known flake, trust CI)
npm run build && npm run preview
npx playwright install chromium && npm run test:e2e
cd services/bot && npm install && npm test   # bot Vitest (141 tests)
cd services/bot && npm start          # run the live bot (needs .env: 6 secrets incl GROQ_API_KEY for voice)
node scripts/build-hub.mjs .          # regenerate lifeos-hub.html from source (kanban + graph embedded)
```

## Lessons / gotchas (carried + new this session)
- **`lifeos-hub.html` is GENERATED, never hand-edit it.** It's built by `node scripts/build-hub.mjs .`, which embeds `kanban.html` + `graphify-out/graph.html` (base64) and computes progress stats live from `#board-data`. Edit the `overview`/`start` template strings or the `GROUPS`/`FACES`/`FEATURES`/`shippedSlices` constants in `build-hub.mjs`, then rebuild. Direct edits get clobbered on the next build.
- **The three router-hotspot slices (S17/S19b/S18) were shipped SERIALLY and it worked cleanly** — each its own worktree-isolated Sonnet implementer off fresh `origin/master`, dual-green → squash-merge → tiny `docs/<slice>-board-flip` PR → next slice. Every later slice rebased onto the prior router edit with zero conflicts. Confirms the serialize-don't-batch rule for shared-file slices.
- **Parallel git-writing subagents MUST use `isolation: "worktree"`.** This session ran S17/S18/S19 spec pipelines concurrently in ONE shared checkout — they raced on `HEAD` (one agent's commit landed on a sibling's branch). Both self-recovered (cherry-pick back, reset sibling to origin), no work lost, but it was luck. S19a was then dispatched with `isolation: "worktree"` — no race. Always isolate concurrent agents.
- **`services/bot/router.ts` is a modality hotspot.** S17/S18/S19b all extend `handleIncomingMessage`. The intent-router *registry* (ADR-0011 §4) was designed disjoint (one file per intent), but the ingest dispatch in `router.ts` is shared — so modality slices serialize. Confirmed by two independent pipelines flagging it.
- **A stale docs branch is a merge trap once code has landed.** The S16 docs branch was cut before the S16a/b/c code PRs; a direct merge would have reverted `services/bot` + `src/vault`. Fix: rebuild docs on a fresh branch off current master and cherry-pick only the doc artifacts (verify the staged diff is docs-only before commit). This is why PR #80 (Group E docs reconciliation) exists instead of merging the four pipeline branches directly.
- **Parallel pipelines pick colliding ADR numbers.** S18 and S19 both grabbed 0012. Renumber during central reconciliation (S18 → 0014) and fix the internal refs in the slice's deploy/prd/issue docs.
- **A subagent can hit the account session limit mid-run.** S16b's implementer died before committing; its work survived UNCOMMITTED in the (shared) worktree. Recovery: verify locally (run the suite), stage only the slice's files (exclude pre-existing untracked), commit/push/PR yourself, let CI gate. Always check `git status` + `gh pr list` before assuming a silent agent's work is lost.
- **HITL splits the gate:** CI green covers only what runs without a remote. Isolate the non-CI-verifiable part (S15b, S16c) into its own slice so only the minimum needs an owner hand-verify.
- **`pwa-e2e` occasionally flakes on an SW-timing race** (offline-persistence test, `emu-test` not visible). If the diff didn't touch `src/`/`e2e/`, re-run the job once (`gh run rerun <id> --failed`) before treating it as real.
- **Local `npm test` exit-1 ≠ CI red:** the `Seam isolation` static-analysis test can time out on a slow machine while CI is green. Trust CI as the gate.
- **The Obsidian vault (`LifeOS-Vault/`) is graphify OUTPUT, not source** — never hand-edit; exclude `LifeOS-Vault/`, `graphify-out/`, `.obsidian/` from re-graphifying.
- **isomorphic-git in the browser needs Node-global shims + concurrent-clone dedupe.** It threw `Buffer is not defined` on the hosted vault load (also reads `process.env`/`platform`); shim both in `src/main.tsx` before any vault code loads (the `buffer` dep was already present). And `list()` isn't queued, so App's two mount-time `list()` calls raced two clones into the same lightning-fs dir — dedupe concurrent `readFiles()` behind one in-flight promise. Any async load that can reject MUST clear the loading flag, or the UI hangs on a spinner with no error.
- **Vite inlines every `VITE_`-prefixed env var into the client bundle.** A write-scoped PAT in a public bundle = anyone can write your vault. Keep secrets runtime-only (`localStorage`), and if you must reference `import.meta.env.VITE_*` as a dev fallback, guard it with `import.meta.env.DEV` so the production minifier strips it. Verify with `grep <pat> dist/`.
- **`LiveOS-VaultRepo` is a SEPARATE private repo from the app repo**, default branch `main` (app repo is `master`). Its name is "Live" not "Life" — easy typo. Seeded headless via a `serialize.ts`-matching script; the browser/bot both read+write it over git.

## How work ships here (afk-pipeline workflow)
Plan/grill → PRD/slice issues (afk-pipeline `auto` runs this headless) → Sonnet implementer agents in isolated worktrees off fresh `origin/master` → PR → **dual-green** (CI + ponytail-review) → orchestrator merges → next slice. Update `kanban.html` `#board-data` when a slice ships. Dispatch waves are derived batches: only pairwise-disjoint write-sets run concurrently; shared-hotspot slices (like the three remaining router slices) serialize.
