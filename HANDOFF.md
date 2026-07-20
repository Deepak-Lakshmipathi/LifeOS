# LifeOS — Handoff

Last updated: 2026-07-20. Picks up after the **#120 flake-fix session** (afk-pipeline `auto`, one bug): **#120** (useTasks teardown `window is not defined` flake) is **FIXED + MERGED** — PR #137, squash-merged triple-green as `ea00e0a`, issue auto-closed. Root cause was two post-unmount setState sites: `useTasks.ts`'s initial async load **and** `refresh()` (shared `mountedRef` guard now covers both + all four mutation callers), plus `TaskItem.tsx`'s 600ms ring-pulse `setTimeout` (cleared via a ref on unmount). Both pinned by mutation-verified tests (`src/test/useTasksUnmount.test.tsx` new; `tapDotComplete.test.tsx` +1). The ponytail-review gate **rejected the first cut** — the initial unmount test was vacuous (React 18 silently no-ops setState on an unmounted fiber, so `result.current` can't detect a leaked setState); rewrote it to assert on the `console.error` that sits after the `.catch` guard, mutation-tested to fail when the guard is stripped. `docs/agents/afk-pipeline.md` fingerprint **amended not deleted**: the teardown-leak half is struck as FIXED (#120); the *separate* `syncProvider` "Seam isolation" 5000ms-timeout-under-load flake stays as its own live entry (it's test slowness, not a teardown leak). Retro artifacts in `afk-pipeline-out/` (`issue-120-usetasks-unmount-run.json` + 5 new LESSONS lines). **Board unchanged** (bug fix, not a slice): **53 done, 15 backlog, 0 in-progress, 0 ready**.

**⚠️ Master is 3 commits ahead of origin, 0 behind — owner push pending.** All three are docs/local, none blocking: `a087168` (S51 board flip), `43d4d81` (2026-07-18 handoff), `9a59155` (#120 retro). The #120 code fix itself is already on origin (merged via PR #137). A plain `git push origin master` fast-forwards cleanly (0 behind) — do it when ready; push stays owner-gated.

> **NEXT SESSION.** `/lifeos-boot` → `state.mjs` → sitrep. Unblocked heads (per the script's `unblocked`): wave-4 leaves **S40** (Money tab), **S44** (Career tab), **S49** (Agents tab), **S52** (Supervisor contract); wave-5 **S41** (VitalsRow money tiles — opens the chain `S26→S41→S45`). All disjoint, no hotspots in common. **One bug still open: #136** — bot run-logging leaves update/delete/complete actions unwritten to runs.jsonl (router's `onAction` seam unreachable from `confirm/gate.ts` commit path; fix sketch in the issue = plumb `deps.onAction` into `resolvePending`, small). Can be sliced into a slot or run through afk-pipeline `auto --issue 136`. Telegram bot's owner-only live verify (S16c) remains the one human gate. Same merge gate: **triple-green** = CI (incl **pwa-e2e**) + ponytail-review + FRESH eval subagent vs the ticket's numbered DoD. `[UI]` slices: feed `docs/DESIGN_LANGUAGE.md`, honor reduced-motion, don't break `data-testid="tab-bar"`. **Lesson carried from #120: mutation-test any guard/race regression test before dispatching review — a green test that stays green with the fix reverted proves nothing.**

**Session lessons (2026-07-20, #120 flake fix) — add to the standing list:**

- **Mutation-test every guard/race regression test before dispatching review.** A React unmount/setState test that asserts on `result.current` after `unmount()` is **vacuous** — React 18 silently no-ops setState on an unmounted fiber (no throw, no re-render), so it passes with OR without the guard. Strip the fix, rerun; if still green the test proves nothing. Assert on an observable side-effect that sits *after* the guard (here `console.error` on the `.catch` path). The ponytail-review reviewer caught this by mutation-testing — do it yourself first (~2 min).
- **"Fix the flake" = root-cause across ALL sibling call-sites, not just the ticket's named signature.** #120 named useTasks' mount-load, but `refresh()` (called by add/update/toggle/delete) had the identical unguarded post-`await` setState. One shared `mountedRef` guarding `refresh()` + both mount continuations is a smaller, more correct diff than an effect-local `cancelled` flag covering only the mount path. Grep the whole file for the same pattern before calling a leak fixed.
- **A review-subagent can die on a transient API error (model retired / 429) with `status: failed` and NO verdict — that is not a reject and not a pass.** Re-dispatch it (synchronous, `run_in_background: false`, so the verdict returns inline) before gating. The escalation-tier rule counts real rejects, not infra deaths.
- **DoD "remove the flake fingerprint" when the entry bundles two root causes = amend, don't delete.** Strike the fixed half with a FIXED note + issue ref; keep the still-live half (`syncProvider` Seam-isolation timeout) as its own narrower entry. Wholesale deletion hides a flake that still fires.
- **Don't manufacture the flake you're trying to disprove.** Running 3 full suites back-to-back locally to "prove #120 gone" is self-inflicted concurrent load that triggers the *separate* `syncProvider` 5s timeout (passes ~2s isolated). Verify the SPECIFIC signature (grep `window is not defined`), not raw pass/fail counts; trust CI on a clean runner.

**Session lessons (2026-07-18) — add to the standing list for the next session:**

- **Per-PR rebase before re-eval after a "fix the gap" dispatch.** When an afk-pipeline auto agent adds tests to a stale branch (forked before the most recent merges), its rebase will rewrite the feature commit's hash (same content, new base). `git push --force-with-lease=BRANCH:OLD_TIP` is the textbook-safe call on a single-writer PR branch — the lease guards against any unseen remote push (there is none), and the rebased tip means CI runs against the real merge base, not the orphan. Plain `--force` is the wrong reflex; cherry-pick-and-replay is needless churn.
- **The merge gate's CI half is only "green on the new tip," not "green."** `gh pr view` rolls up the latest completed check; you must confirm those checks' `head_sha` matches the rebased tip before declaring triple-green. Use `gh api repos/.../commits/<new_tip>/check-runs` — `head` field per check run.
- **Eval subagents flag real product gaps even when the merge gate passes.** S51's tests are defensible (DoD required only "create" to log), but the same eval called out that update/delete never write runs.jsonl — the router's `onAction` seam is structurally unreachable from `confirm/gate.ts`. That's a real follow-up, not a nit. File as a bug with reproduction + fix sketch, do not fix in the same PR.
- **Local master drifts from origin during long sessions because `gh pr merge --squash` lands on the server-side remote but local never pulls.** Symptom: `git push origin master` → `! [rejected] non-fast-forward`. Recovery: `git fetch origin && git rebase origin/master` — board-flip commits are JSON in `kanban.html`, almost always rebase clean; verify `git rev-list --left-right --count master...origin/master` is `3 0` (or N 0) before retrying the push.
- **Lesson from prior session still binds for any new chain mount**: always grep e2e selectors for every name the new component renders before pushing a HomeView-chain slice. S32/S34/S37 still ahead; same `hideLive`-style seam will recur.

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

**Concurrency ceiling stays 4 and fan-out is now mostly spent** — remaining depth is the serial chains in the banner above. `src/App.tsx` (S24, done) and `HomeView.tsx` are the irreducible hotspots; never batch a hotspot-sharing slice (`afk-pipeline-out/LESSONS.md`). Full slice map: `docs/slices/README.md`.

**Session lessons (2026-07-15) — read before the next fan-out:**
- **Background subagents survive full-environment outages.** This wave ate a cert/connection blip and TWO session-limit walls (2:40pm + 7:40pm resets). Transcript-resume (`SendMessage` to the agent id) continues from each agent's own worktree with zero work lost — the PRs are the durable checkpoints. When rate-limited, **do NOT churn resumes**; wait for the reset (a scheduled wakeup or the user's ping), then resume all at once.
- **Worktree isolation can silently fall through.** One agent operated in the MAIN checkout and switched its branch under the orchestrator, stranding uncommitted `kanban.html` edits on the feature branch. Recovery: `git checkout master` (identical committed file carries the dirty edit cleanly), `git fetch`, `git merge --ff-only origin/master`. **Watch `git worktree list` mid-run.**
- **New CI flake fingerprinted** (`docs/agents/afk-pipeline.md`): post-teardown `ReferenceError: window is not defined` from `useTasks`' async load firing after test teardown (`cockpitShell.test.tsx`; siblings `tapDotComplete`/`syncProvider`). Load-dependent, passes in isolation, rerun-to-green. **Real fix = guard/cancel the `useTasks` load on unmount** — stabilization issue **#120** filed.
- **VitalsRow (S26) self-loads its own `SyncProvider`** (App mounts it propless, App.tsx out of write-set) → a second vault read + no live subscription; warmth won't reflect a change made elsewhere until remount. Contained + ADR-consistent, but **S41/S45 should wire the row to a shared subscription** when they extend it.

**Session lessons (2026-07-17) — add to the above for the next session:**
- **MissionCard + NowView double-render is a class of HomeView-chain bug to watch for.** S27 mounted MissionCard above NowView but the latter still rendered its own `ranked.slice(0, LIVE_COUNT)` block — pwa-e2e strict-mode locator found 2 elements and red'd. Fix: a `hideLive` prop on NowView, NOT `.first()` in the test. **Always grep e2e selectors for every "name" the new component renders** before pushing a HomeView-chain slice. The same trap will fire on S32/S34/S37 — every new card mounted above NowView must teach NowView what to skip.
- **The `dayStats(tasks, picks, now)` prose signature from the ticket is a spec bug, not a real spec.** A completed task has, by definition, already left the live `missionPicks()` result, so a caller-supplied `picks` snapshot taken after the completion can never intersect today's completions. Reusing the shipped `missionPicks`/`computeWarmth` seams to *reconstruct* the queue is the only way to answer "was this a mission pick" — no new ranking logic, but the signature deviates from the ticket's prose. Document both ways (code comment + PR body) and let the eval subagent judge.
- **When a component needs to react to global mode state (useTimeOfDay, currency, theme), test the component in isolation with an override prop, not by lifting shared state.** S29 made the same mistake the eval subagent called out: HomeView owns a `useTimeOfDay` instance separate from Header's, so manually forcing "Evening" in the header's seg control won't flip Day Review into view without a reload. Lifting shared state needs `App.tsx` (S24's exclusive hotspot). Document the gap; fix later, not in this slice.
- **`gh pr merge` reliably dies on `failed to delete local branch 'slice/X'` when the main checkout is on master.** Branch IS merged (verify with `gh pr view <N> --json state`); the cleanup script needs to retry: `git worktree remove` → `git branch -D` → `git push origin --delete`. The worktree dir sometimes needs an explicit `rm -rf` after `git worktree prune` because Windows holds the lock.

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
