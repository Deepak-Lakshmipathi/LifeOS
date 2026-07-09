# LifeOS v2 "Glass Cockpit" — development roadmap

From the shipped task-tracker PWA to the full life cockpit
([mockup](https://claude.ai/code/artifact/576a94b7-432a-4ae6-8170-376a343291c0)),
sliced so **each slice = one GitHub issue = one Sonnet subagent via the
afk-pipeline skill**. Every slice is thin, isolatable, and completely testable
on its own.

---

## Where we are

- React 18 + Vite + Tailwind PWA on GitHub Pages, installable.
- Vault backend: private git repo of markdown (`Domain/Project.md`, tasks are
  `- [ ]` lines w/ `done_when::`/`priority::`), read/written in-browser via
  isomorphic-git + runtime PAT through a self-hosted Cloudflare CORS proxy.
  Dexie local cache.
- Balance brain: derived domain warmth + ranked NOW queue.
- Nav: Now / Domains / Pulse.

## Where we're going

Time-aware cockpit: header + vitals row + pill tabs (Home / Money / Career /
Agents / Domains / Pulse). Home = Today's Mission + Needs-you attention + Today
calendar + Habits + Fleet strip + evening Day Review. Five integrations (Gmail,
Calendar, Money, Career, Habits) land data **into the vault as markdown**. Agent
fleet on mixed infra + a human-gated supervisor. Health board over it all.

## Infra (from systems-architect — the contract every slice honors)

- **Vault stays the single source of truth and the bus.** Microkernel: vault +
  PWA + balance brain = stable core; integrations + agents = plugins; markdown =
  the plugin contract. Plugins never call each other, only the vault.
- **Path-partitioning:** every writer owns a disjoint set of files, so git
  auto-merges and there are no write conflicts. finance-sync owns `Finance/**`,
  email-triage owns `Mail/**`, etc. Append-only logs are per-writer.
- **New vault folders:** `Mail/` `Calendar/` `Finance/` `Career/` `Habits/`
  `Briefs/` `agents/<name>/{runs.jsonl,status.json,state.json,prompt.md}`
  `agents/supervisor/<date>.md` + `proposals/`.
- **Agent placement rule:** always-on/inbound → VPS; needs live browser session
  or daily-interactive login → this PC; pure API + cron → GitHub Actions
  (default). Lands: daily-brief/email-triage/calendar-sync/job-scout/supervisor
  → GH Actions; finance-sync → this PC (Kite daily login + Groww CSV); telegram
  → VPS.
- **Secrets:** per-agent fine-grained vault-write token (revoke one, rest
  untouched); PWA's broad PAT never leaves the browser; GH Actions secrets /
  local Credential Manager / VPS `.env` per target.
- **Health:** `agents/*/status.json` gives O(1) staleness read; loud amber/red,
  never silent-stale.

**The key enabler:** because the vault is the contract, every UI slice is
testable against a **committed fixture markdown file** — zero network, zero
secrets. The producer agent is a *separate* slice. So you can build the whole
cockpit against fixtures first, wire real agents later.

---

## Slicing rules (tracer-bullet, one Sonnet each)

- **Vertical, thin:** a slice touches contract → parser → render (or one agent
  end-to-end), never a horizontal layer across the whole app.
- **Completely testable alone:** every slice leaves ≥1 runnable test. UI slices
  test against fixtures; agent slices test their write-a-valid-file logic
  against a mocked API response.
- **Isolated:** integration slices are path-partitioned, so Phases 3–7 run in
  **parallel** once the shell (Phase 1) exists.
- **Contract-first:** for each integration, ship the parser+UI slice (fixture-
  backed) BEFORE its agent slice. UI never blocks on OAuth.

---

## Roadmap

Legend — **[UI]** fixture-testable, no secrets · **[AGENT]** needs infra/secrets
· **dep** = must land first.

### Phase 0 — Design system foundation
Turns `docs/DESIGN_LANGUAGE.md` (Fable output) into code. Gates everything.

| # | Slice | Test | Dep |
|---|-------|------|-----|
| 0.1 | **[UI]** Port Glass tokens → `tokens.css` `:root` + Tailwind `theme.extend` (colors, domains, radii, blur, semantic) | snapshot component renders with vars | — |
| 0.2 | **[UI]** Glass primitives: `<Card>` (cursor spotlight), `<Chip>` variants, `<Vital>` tile, `<Segmented>` | component render + state tests | 0.1 |
| 0.3 | **[UI]** Aurora canvas bg component + reduced-motion guard | mounts; no RAF under reduced-motion | 0.1 |
| 0.4 | **[UI]** `useTimeOfDay()` am/mid/pm → greeting + body class + aurora palette (extend existing `timeOfDay.ts`) | boundary tests | 0.1 |

### Phase 1 — Cockpit shell (IA restructure)
| # | Slice | Test | Dep |
|---|-------|------|-----|
| 1.1 | **[UI]** Pill-tab nav Home/Money/Career/Agents/Domains/Pulse; Domains+Pulse keep existing views | tab switch shows/hides section | 0.2 |
| 1.2 | **[UI]** Cockpit header: greeting + time segmented control + mission-note subtitle | renders per time-of-day | 0.4 |
| 1.3 | **[UI]** Vitals row shell: 5 tiles, warmth tile from real `computeWarmth`, rest stubbed; count-up | warmth tile reflects warmth output | 0.2 |

### Phase 2 — Home from EXISTING data (no new integrations)
| # | Slice | Test | Dep |
|---|-------|------|-----|
| 2.1 | **[UI]** Today's Mission: reuse `rankNow`, top 1–3 + coldest-domain rescue inject; mtask cards (why + done_when + chips) + veto | rescue inject + veto behavior | 1.1 |
| 2.2 | **[UI]** Mission dot-tap completes task in vault (reuse complete flow) → warms domain | complete → warmth updates | 2.1 |
| 2.3 | **[UI]** Evening Day Review card (pm only): mission-done / tasks-completed / domains-warmed counts | pm visibility + counts | 2.1 |

### Phase 3 — Habits (no external API; feeds warmth)
| # | Slice | Test | Dep |
|---|-------|------|-----|
| 3.1 | **[UI]** `Habits/log.md` contract + parser (append-only `- [x] X (domain::) (date::) (source::)`) | parse fixture, roundtrip | 1.1 |
| 3.2 | **[UI]** Habit-hit domain events feed `computeWarmth` (a hit heats its domain) | hit raises domain warmth | 3.1 |
| 3.3 | **[UI]** Habits card: 7-day grid, streak hot/broken, tap-today appends a log line | render fixture, tap appends | 3.1 |

### Phase 4 — Calendar
| # | Slice | Test | Dep |
|---|-------|------|-----|
| 4.1 | **[UI]** `Calendar/today.md` contract + parser (blocks + free gaps) | parse fixture | 1.1 |
| 4.2 | **[UI]** Today card: time slots + tinted event chips + gap-fit hint (fit a mission task) | render fixture, gap-fit hint | 4.1 |
| 4.3 | **[AGENT]** calendar-sync (GH Actions, GCal OAuth) → writes `Calendar/today.md` | writes valid file from mocked API resp | 4.1 |

### Phase 5 — Gmail / Attention
| # | Slice | Test | Dep |
|---|-------|------|-----|
| 5.1 | **[UI]** `Mail/attention.md` contract + parser (label/from/draft ref) | parse fixture | 1.1 |
| 5.2 | **[UI]** "Needs you" stack: arows, icon by label, action buttons, draft-ready state | render fixture, action wired | 5.1 |
| 5.3 | **[AGENT]** email-triage (GH Actions, Gmail OAuth) → classify → write attention + `Mail/drafts/*` | classify fixture emails → valid files | 5.1 |

### Phase 6 — Money
| # | Slice | Test | Dep |
|---|-------|------|-----|
| 6.1 | **[UI]** `Finance/` contracts + parsers: networth-history (append table), portfolio, burn-vs-income, bills-radar | parse each fixture | 1.1 |
| 6.2 | **[UI]** Money tab: net-worth big + sparkline, burn bars, portfolio donut + legend, bills rows | render fixtures; sparkline/donut draw | 6.1 |
| 6.3 | **[UI]** Wire net-worth + burn vital tiles to `Finance/` files | tiles reflect fixture | 6.1, 1.3 |
| 6.4 | **[AGENT]** finance-sync (this PC, Kite Connect + Groww CSV watch) → write `Finance/**` in one atomic commit | sample Kite resp + CSV → valid files | 6.1 |

### Phase 7 — Career
| # | Slice | Test | Dep |
|---|-------|------|-----|
| 7.1 | **[UI]** `Career/pipeline.md` (stage:: kanban) + `Career/courses.md` (progress::) contract + parsers | parse fixtures | 1.1 |
| 7.2 | **[UI]** Career tab: 4-col kanban (group by stage) + hot card; courses w/ progress + next-lesson pointer | render fixtures, stage grouping | 7.1 |
| 7.3 | **[UI]** Wire job-pipeline vital tile; surface course "next" as a mission candidate | pipeline counts; course→mission link | 7.1, 1.3 |
| 7.4 | **[AGENT]** job-scout (GH Actions; escalate→PC if browser session needed) → write pipeline Found entries | sample board results → valid lines | 7.1 |

### Phase 8 — Agent fleet substrate + Health
| # | Slice | Test | Dep |
|---|-------|------|-----|
| 8.1 | **[UI]** Agent-run contract: shared writer helper for `runs.jsonl` + `status.json` + parser | write+parse roundtrip; O(1) status read | 1.1 |
| 8.2 | **[UI]** Fleet mini strip (Home): LED per agent from status.json (ok/bad/idle + staleness) | render fixture; staleness→amber/red | 8.1 |
| 8.3 | **[UI]** Agents tab: fleet table w/ infra badges (GHA/PC/VPS), last-run, note/err | render fixture | 8.1 |
| 8.4 | **[AGENT]** daily-brief (GH Actions) reads vault → `Briefs/<date>.md`; Home surfaces it | compose from fixture vault → valid brief | 8.1 |
| 8.5 | **[AGENT]** telegram-bot logs runs via 8.1 helper so it appears on Health | a capture logs a run | 8.1 |

### Phase 9 — Supervisor (control plane, human-gated)
| # | Slice | Test | Dep |
|---|-------|------|-----|
| 9.1 | **[UI]** `agents/supervisor/<date>.md` + `proposals/<agent>-<date>.md` (`status: pending`) contract + parsers | parse fixtures | 8.1 |
| 9.2 | **[UI]** Supervisor card: render latest report + metrics | render fixture | 9.1 |
| 9.3 | **[UI]** Proposal approval: PWA lists pending, approve flips `status: approved` in vault (confirm-destructive, owner-gated) | approve → file status changes | 9.1 |
| 9.4 | **[AGENT]** supervisor (GH Actions weekly) reads all `runs.jsonl` → accuracy/staleness → report + proposals | fixture runs.jsonl → valid report | 9.1 |

### Phase 10 — Hardening (systems-architect risk list)
| # | Slice | Test | Dep |
|---|-------|------|-----|
| 10.1 | Git-history guard: shallow-clone depth + log rotation (`runs.jsonl` monthly, networth prune) so in-browser clone stays fast | rotation keeps N months; depth set | 8.1 |
| 10.2 | Per-agent scoped tokens + shared push wrapper (`pull --rebase` → push → retry on reject) | simulated rejected push retries | — |

---

## Execution order & parallelism

```
Phase 0 ─▶ Phase 1 ─▶ Phase 2
                    └▶ Phases 3,4,5,6,7  (PARALLEL — path-partitioned, independent)
                    └▶ Phase 8 ─▶ Phase 9
Phase 10 anytime after Phase 8.
```

- **Critical path:** 0 → 1 → 8 → 9. Everything else fans out.
- **All-UI fast track:** ship every `[UI]` slice against fixtures for a fully
  clickable cockpit with zero secrets; land `[AGENT]` slices to make it live.
- ~35 slices; ~24 are `[UI]` (no infra), ~7 are `[AGENT]`, 2 hardening.

## Running a slice AFK

Per slice, hand its row to the pipeline:

```
/afk-pipeline <slice text + its "Test" column + the vault-contract note>
```

It grills (architect + engineer), writes a PRD, and cuts tracer-bullet issues a
Sonnet agent grabs. Each slice already IS a tracer bullet, so most will produce
1 issue. Feed the `docs/DESIGN_LANGUAGE.md` reference into every `[UI]` slice so
the agent builds to the locked look.
