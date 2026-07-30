# LifeOS — Handoff

Last updated: 2026-07-30. **Post-v2 wave planned — 5 tickets (S58–S62) written, board `ready`, zero code this session.** Owner asked for a planning-only session: read `Post V2 User FeedBack, Features, Updates, Fixes.md` (4 usage items) and turn it + the 2 open issues into dispatch-ready tickets so the next session is pure `/lifeos-boot` → dispatch. Landed: `docs/slices/slice-S58…S62-*.md`, cards `s58…s62` in `kanban.html` (wave 12 = S58·S60·S61 parallel; wave 13 = S59←S58, S62←S61), post-v2 section in `docs/slices/README.md`, and new hotspot chains in `state.mjs` `CHAINS` (`TabBar.tsx`: s58→s59; `vault/transport.ts`: s61→s62; `App.tsx`: +s58). **Board: 69 done, 5 ready, 0 progress. Open issues: 2 (#158→S61, #155→S62). Open PRs: 0.**

**— previous session —**

Last updated: 2026-07-23. **v2 Glass Cockpit COMPLETE — 69/69 cards (100%).** Shipped the entire remaining HomeView chain + 3 transport fixes this session, each triple-green (CI incl pwa-e2e + ponytail-review + FRESH eval-vs-DoD): **S34** Today card (#152: `src/components/home/TodayCard.tsx` + pure `src/lib/gapFit.ts`) · **S37** attention stack (#156: `AttentionCard` renders S36 `parseAttention`) · **S48** fleet strip (#159: `FleetStrip`, reuses S47 `healthOf`/`parseStatus` + AgentsView LED table) · **S50** daily-brief agent (#161: `agents/daily-brief/brief.mjs` Claude-compose 5-line morning brief + `src/vault/briefs.ts` + Home am-only surface). **HomeView chain S34→S37→S48→S50 fully closed** — the whole v2 backbone (S20–S57) is done. Three transport folder-gap fixes, all bugs the eval surfaced live: **#148** Habits/ (#153, + a `loadGit()` init-order fix for a pre-existing CI teardown race the new test exposed), **#151** Calendar/ (#157, no VaultSync guard needed — verified), **#154** Mail/ (#160, +VaultSync `list()` guard, mutation-proven). Closed #148/#151/#154; filed **#155** (perf-seam) + **#158** (systemic `_readFiles()` folder-gap, STILL OPEN — agents/ + Briefs/ live self-loads resolve empty until it lands). Every PR triple-green. **Board: 69 done, 0 backlog/ready/progress. Open issues: 2 (#155, #158). Open PRs: 0.**

**⚠️ Master is 2 ahead of origin, 0 behind — owner push pending** (becomes **3 ahead** once this planning session's ticket commit lands; docs only, no code). All 7 feature PRs (#152/#153/#156/#157/#159/#160/#161) were merged to origin and pulled back this session (owner-approved). The 1 local-ahead commit is a board-flip doc only, no code: `dbcf27c` flip S50 → done (v2 COMPLETE) — plus *this* handoff commit. behind == 0 → clean fast-forward, no rebase: `git push origin master` (verify `git rev-list --left-right --count master...origin/master` is `2 0` first). Push stays owner-gated.

> **NEXT SESSION — the board is loaded, just dispatch.** `/lifeos-boot` → `state.mjs` → sitrep → **dispatch wave 12 three-wide, no planning needed**. The 2026-07-30 session turned the owner's post-v2 feedback (`Post V2 User FeedBack, Features, Updates, Fixes.md`, items 1–4) + the two open issues into 5 dispatch-ready tickets, cards `s58…s62` in `ready`:
> - **Wave 12 — fully parallel, disjoint write-sets, dispatch all three at once** (separate worktrees): **S61** (`docs/slices/slice-S61-transport-recursive-read.md`, closes **#158** — highest live value: FleetStrip + daily brief render EMPTY in production until it lands; fix the folder-enumeration CLASS, not a 5th one-word patch; watch `VaultSync.list()` pollution + never build a real lightning-fs in tests) · **S58** (`slice-S58-tasks-tab.md` — Home slims to Mission/Today/Habits/Needs-You; Up next+Later+Domains+Pulse fold into a new **Tasks** tab; tabs 6→5; sole `App.tsx`+`TabBar.tsx` toucher; edits DESIGN_LANGUAGE §5) · **S60** (`slice-S60-warmth-tint-completion-vital.md` — Warmth tile dies, warmth becomes the page background tint in `Aurora.tsx` (NOT App.tsx — S58 owns it this wave), Completion % + done/to-do takes the vacated vital slot; edits §4.2+§5).
> - **Wave 13 — after their prereq merges, rebase first:** **S59** (`slice-S59-responsive-tab-bar.md`, feedback #2, after S58 — TabBar.tsx hotspot) · **S62** (`slice-S62-transport-config-seam.md`, closes **#155**, after S61 — transport.ts hotspot).
> - **Design doc moves with the product this wave.** `docs/DESIGN_LANGUAGE.md` is LOCKED, but owner feedback overrides it: S58 and S60 each edit their own section in their own PR. The eval checks conformance against the doc — a stale doc fails a correct PR.
>
> Beyond those: run the live product as real usage → file issues; the v1 user-testing checklist ("Get started & test" tab of `lifeos-hub.html`) still stands. **Telegram bot's owner-only S16c live verify (`afk-pipeline-out/s16c-verify-checklist.md`) remains the one human gate.** Merge gate unchanged: **triple-green** = CI (incl **pwa-e2e**) + ponytail-review + FRESH eval subagent vs the ticket's numbered DoD. Standing local gate: run **`npm run build`** (tsc), not just `npm test` — vitest/esbuild skips type-check. `[UI]` work: feed `docs/DESIGN_LANGUAGE.md`, tokens-only, honor reduced-motion via `useReducedMotion()`, don't break `data-testid="tab-bar"`.

**Session lessons (2026-07-23, S34/S37/S48/S50 + #148/#151/#154 — v2 finale, 3 disjoint pairs + 1 solo) — add to the standing list:**

- **`GitTransport._readFiles()` hardcodes a flat `.md`-only folder allowlist — it silently drops any consumer folder not in the list.** 5 gaps found this session (Habits #148, Calendar #151, Mail #154, agents/ + Briefs/ #158). One-word-per-folder patching is the wrong fix past the second; #158 tracks the systemic root (recurse + non-md, or per-consumer allowlist). Every card self-loading a NEW vault folder is a live no-op until its folder is in the loop — the fixture DoD never catches it, the fresh eval does.
- **Surfacing a new folder can pollute `VaultSync.list()` — diff its line-format against `parseTaskLine`'s checkbox regex `/^- \[([ xX])\]…/` BEFORE adding it.** Mail lines are `- [ ]`-shaped → needed `if (folderName === 'Mail') continue` in `list()` (mutation-proven); Calendar lines (`- HH:MM …`) never match → no guard. Add the guard + a red-pre-fix test, or state precisely why none is needed.
- **`new LightningFS()` before the config-check orphans a `navigator`-touching init promise → post-teardown unhandled rejection, local-green/CI-red.** #148's new test exposed a PRE-EXISTING race (bare `<HabitsCard/>` self-load in HomeView tests): all tests pass but vitest exits 1 on the unhandled rejection. Fix: validate `VITE_VAULT_REPO_URL` before constructing the FS backend. Any GitTransport-path test MUST mock lightning-fs (never the real backend). Fingerprint: `ReferenceError: navigator is not defined … DefaultBackend.init`.
- **An API-path function behind an injection seam needs its OWN direct test.** S50's `callClaudeForBrief` (real HTTP + response parse) passed eval SHIP because every test injected a mock `callClaude` and bypassed it — a header/model-id/body/parse regression would fail nothing. Added 10 mocked-`fetchImpl` tests (request shape + non-2xx throws + non-JSON→null). Verify the model id against the `claude-api` skill, never memory (`claude-sonnet-5` current).
- Runs orchestrated manually (implement subagent → ponytail-review + fresh eval concurrent on the frozen diff → orchestrator merge), NOT via afk-pipeline P5/P6 — no `afk-pipeline-out/` run-manifest this session.

**Session lessons (2026-07-22 session 2, S41/S55/S45/S53/S54/S32 — 3 disjoint pairs) — add to the standing list:**

- **Local `npm test` does NOT type-check — CI `build-test` (`npm run build` = tsc) does.** S32 used `Array.prototype.at()`; vitest (esbuild transpile, no lib check) passed 984/984 locally AND in the fresh eval subagent, but CI `build-test` failed `TS2550: Property 'at' does not exist on type 'string[]' … change lib to es2022`. The local gate must include `npm run build` (or `tsc --noEmit`) or lib-gated APIs slip to CI. On the fix, grep the whole diff for the same API (only 1 occurrence here) — root-cause, not just the failing line. This is now a standing pre-push gate in the NEXT-SESSION banner.
- **Eval-flagged LIVE-path gap → file the issue, do NOT fix in the slice.** S32's DoD is all fixture/fake-transport tested (green), but the eval found `GitTransport._readFiles()` only walks `[...DOMAINS,'Inbox']` — never `Habits/` — so live taps overwrite log history. Out of S32's write-set (transport.ts is its own hotspot). Filed **#148** (repro + one-line fix). Same discipline as #136/S51: a passing merge gate doesn't mean the eval's product-gap findings are noise.
- **Raw hex that reproduces a DESIGN_LANGUAGE §-literal with same-file precedent is NOT a design-gate violation.** S53 (`#c4b5fd` §4.8 metric accent) + S54 (`#a5b4fc`/`#fca5a5` §4.4 action buttons) both used Tailwind arbitrary hex where no token exists; the eval verified each is the verbatim spec literal already used by sibling call-sites (AgentsView infra badge, Chip.tsx p3). Ship it; if a token gets minted later, migrate the cluster together. The gate exists to catch *invented* one-off colors, not spec literals.
- Runs were orchestrated manually (implement subagent → inline review → fresh eval → orchestrator merge), NOT via afk-pipeline P5/P6 — so no `afk-pipeline-out/` run-manifest or `LESSONS.md` line this session. If a future session runs the real pipeline, point here to that ledger instead of inlining.

**Session lessons (2026-07-22, S44/S52/S49/S56 — orchestration) — add to the standing list:**

- **A watchdog-killed subagent is RESUMED, not re-dispatched.** S56 stalled (600s no stream progress) mid-run with real uncommitted work in its worktree (`rotate.mjs`, tests, workflow) but no commit. `SendMessage` to its agent id continued it from its own transcript + worktree — it finished, committed, reported clean. A cold re-`Agent` would have thrown away the partial work and re-derived context. Send a **bounded** finish instruction (run tests → commit → report; "kill hanging commands, don't wait"), and inspect the worktree first (`git -C <wt> status/log`) so you know what state it left.
- **Push order for parallel-worktree PRs: master first, then rebase each branch `--onto master <old-base>`.** Push+rebase `master` onto origin, push it, THEN for each feature branch `git rebase --onto master <fork-point>` so the PR diff is only the feature commit. Skipping this makes the (rewritten) docs/board commits show as duplicates in every PR. `--onto` cleanly drops commits already upstream ("patch contents already upstream").
- **Windows `core.autocrlf=true` silently drifts LF fixtures to CRLF on every fresh worktree checkout** — it bit `supervisor.test.ts`'s byte-exact CRLF guard in 3 separate worktrees before being fixed at the root: `.gitattributes` → `<fixture-dir>/** text eol=lf`, then refresh the working tree (`rm` the files + `git checkout -- <dir>`). Fix it once at the repo root, never per-worktree. This is the CI-green/local-red class of failure — don't dismiss a local-only fail as "just my machine"; pin the bytes.
- Per-run afk-pipeline lessons were NOT generated this session — the dispatched agents stopped at commit-on-branch (P6 retro/run-manifest not run), and the orchestrator did the verify+merge. If future runs re-enable P6, point to `afk-pipeline-out/LESSONS.md` here instead of inlining.

*(The 2026-07-21 and 2026-07-20/#120 dated blocks were distilled into the standing `## Lessons / gotchas` list this close and removed from the head — mutation-test-guards, root-cause-across-siblings, re-dispatch-dead-reviewers, amend-don't-delete-flake-fingerprint, and don't-manufacture-load are now standing. The 2026-07-21 block's fetch-before-ahead/behind + scripted-close lessons were already baked into the `/lifeos-close` skill. The 2026-07-18 block was distilled a prior close.)*

### Wave 3 recap (this session, 2026-07-15)

8-wide fan-out, all merged triple-green:

| Slice | PR | What landed |
|---|---|---|
| S36 Mail/attention contract | #112 | `src/vault/mail.ts` — 5-label attention parser + provenance fields |
| S33 Calendar contract | #113 | `src/vault/calendar.ts` — events + `freeGaps` (overlap-merge, staleness date) |
| S30 Habits contract | #115 | `src/vault/habits.ts` — log parse/serialize roundtrip, `weekGrid`, `streak` |
| S43 Career contracts | #114 | `src/vault/career.ts` — pipeline stages + course progress |
| S39 Finance contracts | #117 | `src/vault/finance.ts` — networth/portfolio/burn/bills + `formatINR` |
| S47 Agent-run contract | #118 | `agents/lib/runLog.mjs` + `src/vault/agentStatus.ts` — `healthOf` thresholds |
| S25 Cockpit header | #119 | `src/components/cockpit/Header.tsx` — greeting + time seg + note (CSS reduced-motion) |
| S26 Vitals row | #116 | `src/components/cockpit/VitalsRow.tsx` — 5 tiles, live warmth, 4 stubs |

**Concurrency ceiling is 2 (owner-set 2026-07-22, was 4) and fan-out is now mostly spent** — dispatch at most two disjoint slices at a time; remaining depth is the serial chains in the banner above. `src/App.tsx` (S24, done) and `HomeView.tsx` are the irreducible hotspots; never batch a hotspot-sharing slice (`afk-pipeline-out/LESSONS.md`). Full slice map: `docs/slices/README.md`.

## v2 vision + design lock (this session, 2026-07-08 pm) 🎨
- **LifeOS v2 = life cockpit, not task tracker.** Grill session locked scope: time-aware check-in cockpit (morning brief / midday check / evening review), Today's Mission (1–3 balance-brain picks, why + done_when always visible), unified Attention stack (client email, job replies, bills, agent failures — Gmail-fed), Life Vitals row, calendar blocks + gap hints, habits (each habit FEEDS a domain's warmth), money (net worth/burn/portfolio/bills; Zerodha/Groww/CSV first), career tab (job pipeline kanban + course progress), agent fleet health board incl. a **supervisor** agent (weekly log audit, accuracy metrics, prompt patches gated on owner approval — confirm-destructive spirit extends to agent self-modification). Full detail: `memory/lifeos-v2-vision-2026-07-08.md`.
- **Design LOCKED: Glass Cockpit.** Three mockups built (`docs/mockups/cockpit-glass.html` ← chosen, `cockpit-terminal.html`, `cockpit-edition.html` — the other two kept for reference only). The contract extracted from the winner lives in **`docs/DESIGN_LANGUAGE.md`** — tokens, component specs, layout/IA (6 tabs: Home/Money/Career/Agents/Domains/Pulse), time-of-day system, motion/a11y, Do/Don'ts. Load it into every future coding session; deviations need a written one-line reason in the PR.
- Nothing shipped to `src/` this session — docs + mockups only.

## v2 progress (Glass Cockpit — slices S20–S57)

**✅ COMPLETE 2026-07-23 — all 38 v2 slices (S20–S57) shipped, every phase/wave done.** The detail below is the ARCHIVAL Wave-0 kickoff snapshot, kept for provenance; live progress is the board (69/69) + the recap at the top of this file.

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
**69 done, 0 backlog, 0 in-progress, 0 ready — v2 COMPLETE (100%).** (v1 S1–S19 = 30 cards + v2 S20–S57 = 38 slices done + `bug-136`.) All chains complete: HomeView (S27→S28→S29→S32→S34→S37→S48→S50), VitalsRow (S26→S41→S45), AgentsView/Supervisor (S49→S53→S54, S55). No slice tickets remain. **Open non-slice follow-ups (not on the board): #158** (systemic `_readFiles()` folder-gap — agents/ + Briefs/ live self-loads empty until fixed; ready-for-agent) and **#155** (perf-seam; enhancement). The hub rebuilds its progress stats live from `kanban.html`'s `#board-data`. No deferred flips remain.

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
kanban.html                 live board (#board-data JSON); 69 done, 0 backlog (v2 COMPLETE)
lifeos-hub.html             GENERATED showcase (Overview/Get-Started/Kanban/Graph tabs) — edit scripts/build-hub.mjs then rebuild
afk-pipeline-out/           LESSONS.md + s16c-verify-checklist.md (v1 deploy tables collapsed into docs/archive/V1_ARCHIVE.md)
src/main.tsx                shims Buffer + process (browser) before any vault code loads
src/vault/pat.ts            runtime PAT (localStorage prompt); DEV-guarded env fallback so it never bakes into a build
src/vault/transport.ts      GitTransport — dedupes concurrent readFiles(); _readFiles() loop = [...DOMAINS,Inbox,Habits,Calendar,Mail] (#148/#151/#154; agents/+Briefs/ still gapped, #158); loadGit validates url BEFORE new LightningFS (#153 teardown-race fix)
cors-proxy/                 self-hosted Cloudflare Worker CORS proxy (worker.js + wrangler.toml + worker.test.mjs + README)
.github/workflows/deploy-pages.yml   build (no PAT) → deploy GitHub Pages on push to master
.env.example                PWA vault-mode config template (VITE_VAULT_REPO_URL/PAT/CORS_PROXY)
src/vault/supervisor.ts     supervisor report/proposal parsers + byte-preserving setProposalStatus (S52)
src/data/agentManifest.ts   7-agent fleet roster {name,purpose,infra,cadence} for the Agents tab (S49)
agents/lib/rotate.mjs       rotateJsonl (month-split/archive) + pruneNetworth; atomic+idempotent, zero-dep (S56)
.github/workflows/agent-rotate.yml   monthly cron pruning runs.jsonl + networth history, one commit (S56)
.gitattributes              pins src/vault/__fixtures__/** to eol=lf (Windows autocrlf CRLF guard)
src/lib/vitalsData.ts       pure VitalsRow selectors: netWorthVital/burnVital (S41) + pipelineVital (S45)
agents/supervisor/audit.mjs weekly fleet audit → S52 report + pending-only proposals; cap-N=15 mockable Claude sampling (S55)
.github/workflows/agent-supervisor.yml   cron Sun 06:00 IST supervisor run (S55)
src/components/agents/SupervisorCard.tsx  renders the weekly report on the Agents tab (S53)
src/vault/proposalWrite.ts  flipProposal — byte-surgical status flip via transport seam; no fs/git (S54)
src/components/agents/ProposalList.tsx    pending-proposal list + two-step approve/reject (S54)
src/vault/habitsWrite.ts    appendHabitHit — one S30-serialized hit line via transport (S32); NOTE live-read gap = bug #148
src/components/home/HabitsCard.tsx        §4.6 7-day grid + streaks + tap-today (S32; head of HomeView chain)
src/components/home/TodayCard.tsx         §4.5 calendar card — slots/tinted chips/gap hints (S34)
src/lib/gapFit.ts           pure gapFit(gaps,tasks) — top-ranked fitting task per gap (S34)
src/components/home/AttentionCard.tsx     §4.4 "Needs you" stack — rows/provenance/actions (S37)
src/components/home/FleetStrip.tsx        §4.7 fleet mini pills — LED per S47 healthOf, blink-on-fail (S48)
src/vault/briefs.ts         pure parseBrief(md) + latestBriefPath(today) (S50)
agents/daily-brief/brief.mjs  morning-brief agent — vault→context-pack→claude-sonnet-5 compose→Briefs/<date>.md; retry-once-fail-loud; own PAT (S50)
.github/workflows/agent-daily-brief.yml   cron 05:30 IST daily-brief run (S50)
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
- **VitalsRow (S26) self-loads its own `SyncProvider`** (App mounts it propless, App.tsx out of write-set) → a second vault read, no live subscription; warmth won't reflect an elsewhere-change until remount. Contained + ADR-consistent, but **S41/S45 should wire the row to a shared subscription** when they extend it. *(distilled from 2026-07-15)*
- **Grep e2e selectors for every name a new HomeView-chain card renders, before pushing.** S27's MissionCard above NowView double-rendered the live block → pwa-e2e strict-mode found 2 elements, red. Fix is a `hideLive`-style skip prop on NowView, NOT `.first()` in the test. Same trap waits on **S32/S34/S37** — every card mounted above NowView must teach NowView what to skip. *(distilled from 2026-07-17)*
- **Global mode state (useTimeOfDay/currency/theme) that two components each instantiate can't be flipped from one without a reload** — lifting shared state needs `App.tsx` (S24's exclusive hotspot). Test the component in isolation with an override prop instead; document the gap, don't fix it inside a leaf slice. *(distilled from 2026-07-17)*
- **`gh pr merge --delete-branch` fails on `cannot delete branch … used by worktree`** when the branch is checked out in a worktree (and separately on the main checkout being on master). The branch IS merged — verify with `gh pr view <N> --json state`. Cleanup order: `git worktree remove --force <wt>` → `git branch -D <branch>` → `git worktree prune`; the merged remote branch drops via the PR merge (or `git push origin --delete`). *(distilled from 2026-07-17, re-hit 2026-07-22)*
- **After a "fix the gap" dispatch rewrites a PR branch, re-verify CI on the NEW tip, not the rolled-up status.** A rebase/amend gives the feature commit a new hash; `git push --force-with-lease=BRANCH:OLD_TIP` is the safe single-writer push (plain `--force` is the wrong reflex). Then confirm the green checks' `head_sha` matches the rebased tip (`gh api repos/.../commits/<tip>/check-runs`) — `gh pr view` rolls up the latest completed check, which may be the orphaned pre-rebase run. *(distilled from 2026-07-18)*
- **Vite inlines every `VITE_`-prefixed env var into the client bundle.** A write-scoped PAT in a public bundle = anyone can write your vault. Keep secrets runtime-only (`localStorage`), and if you must reference `import.meta.env.VITE_*` as a dev fallback, guard it with `import.meta.env.DEV` so the production minifier strips it. Verify with `grep <pat> dist/`.
- **`LiveOS-VaultRepo` is a SEPARATE private repo from the app repo**, default branch `main` (app repo is `master`). Its name is "Live" not "Life" — easy typo. Seeded headless via a `serialize.ts`-matching script; the browser/bot both read+write it over git.
- **Mutation-test every guard/race regression test before trusting it.** Strip the fix, rerun; if still green the test is vacuous (React 18 silently no-ops setState on an unmounted fiber — asserting on `result.current` after `unmount()` proves nothing). Assert on an observable side-effect *after* the guard. And "fix the flake" = root-cause across ALL sibling call-sites (grep the file for the same pattern), not just the ticket's named signature. *(distilled from 2026-07-20/#120)*
- **A review/eval subagent that dies on a transient API error (`status: failed`, no verdict) is neither pass nor reject — re-dispatch it synchronously (`run_in_background: false`) before gating.** And don't manufacture the flake you're disproving: verify the SPECIFIC failure signature (grep the exact error), don't run suites back-to-back to self-inflict concurrent load; trust CI on a clean runner. When a bundled flake fingerprint is half-fixed, amend (strike the fixed half + issue ref), don't delete the whole entry. *(distilled from 2026-07-20/#120)*
- **`GitTransport._readFiles()` hardcodes a flat `.md`-only folder allowlist** — any consumer folder not in the loop is a silent live no-op. Adding one → check `VaultSync.list()` pollution vs `parseTaskLine`'s checkbox regex first. Systemic fix tracked in #158 (recurse + non-md). *(2026-07-23)*
- **Regression tests for any `GitTransport` path MUST mock `@isomorphic-git/lightning-fs`** — the real backend's `DefaultBackend.init` touches `navigator` in an un-awaited promise that rejects post-teardown (`ReferenceError: navigator is not defined`), a local-green/CI-red unhandled-rejection that exits vitest 1 despite all tests passing. Validate config before constructing the FS. *(2026-07-23)*

## How work ships here (afk-pipeline workflow)
Plan/grill → PRD/slice issues (afk-pipeline `auto` runs this headless) → Sonnet implementer agents in isolated worktrees off fresh `origin/master` → PR → **dual-green** (CI + ponytail-review) → orchestrator merges → next slice. Update `kanban.html` `#board-data` when a slice ships. Dispatch waves are derived batches: only pairwise-disjoint write-sets run concurrently; shared-hotspot slices (like the three remaining router slices) serialize.
