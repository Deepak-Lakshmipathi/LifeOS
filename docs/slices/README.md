# LifeOS v2 — slice tickets (S20–S57)

One file per slice. Each ticket is **dispatch-ready**: hand it whole to a Sonnet 5
subagent running `/afk-pipeline auto` and it has everything needed — context,
write-set, subtasks, numbered Definition of Done, tests, design refs.

## The end goal (read this before any slice)

LifeOS v1 shipped a task tracker: installable offline PWA + Telegram bot + a
private git **vault** of markdown (`LiveOS-VaultRepo`) as the single source of
truth. v2 turns it into a **life cockpit** ("Glass Cockpit", design LOCKED in
`docs/DESIGN_LANGUAGE.md`): a time-aware check-in surface — morning brief,
midday check, evening review — showing Today's Mission (1–3 balance-brain
picks), a unified Needs-You attention stack (Gmail-fed), Life Vitals, calendar
blocks with gap hints, habits that heat domain warmth, money (net worth / burn
/ portfolio / bills), a career pipeline kanban, and an agent fleet with a
human-gated supervisor.

**Architecture contract (microkernel, do not re-litigate):**
- The **vault is the bus**. Core = vault + PWA + balance brain. Integrations
  and agents are plugins whose only contract is markdown files in the vault.
  Plugins NEVER call each other.
- **Path-partitioning**: every writer owns a disjoint file set — finance-sync
  owns `Finance/**`, email-triage owns `Mail/**`, etc. Git auto-merges;
  no write conflicts by construction.
- New vault folders: `Mail/ Calendar/ Finance/ Career/ Habits/ Briefs/
  agents/<name>/{runs.jsonl,status.json} agents/supervisor/ proposals/`.
- **Fixture-first**: every [UI] slice tests against a committed fixture
  markdown file — zero network, zero secrets. Its producer [AGENT] slice is
  separate and lands later. The whole cockpit is clickable before any OAuth.
- Agent placement: pure API + cron → GitHub Actions (default); needs live
  browser/daily login → owner's PC; always-on inbound → VPS.

## Ticket anatomy

Every `slice-S##-*.md` has: **Context** (why, where it fits) · **Write-set**
(exact files; the parallelism ground truth) · **Subtasks** · **Definition of
Done** (numbered, testable — the eval gate checks the PR against these) ·
**Tests** · **Design refs** (`docs/DESIGN_LANGUAGE.md` sections; [UI] only).

## Dispatch waves (earliest safe slot; within a wave = parallel)

| Wave | Slices | Gate |
|---|---|---|
| 0 | S20 | — |
| 1 | S21 · S22 · S23 | S20 (tokens) |
| 2 | S24 | S21. ALONE — sole `src/App.tsx` toucher; creates all stub views |
| 3 | S25 · S26 · S30 · S33 · S36 · S39 · S43 · S47 | S24 (stubs exist; parsers + Header + VitalsRow all disjoint) |
| 4 | S27 · S31 · S35 · S38 · S40 · S42 · S44 · S46 · S49 · S51 · S52 | phase parsers |
| 5 | S28 · S41 · S53 · S55 · S56 · S57 | chain heads |
| 6 | S29 · S45 · S54 | |
| 7–11 | S32 → S34 → S37 → S48 → S50 | HomeView chain (serial) |

**Hotspot serialization rules (v1 lesson: serialize-don't-batch):**
- `src/App.tsx` — only S24 touches it. Ever.
- `src/components/home/HomeView.tsx` — S27→S28→S29→S32→S34→S37→S48→S50 serialize (each mounts one card; rebase onto prior merge).
- `src/components/cockpit/VitalsRow.tsx` — S26→S41→S45 serialize.
- `src/components/agents/AgentsView.tsx` — S49→S53→S54 serialize.
- Everything else is pairwise-disjoint: parsers (`src/vault/*.ts` one file each), tab views (one dir each), agents (`agents/<name>/` one dir each), bot (S51, `services/bot/`).

## Merge gate — triple green

1. **CI green** (build-test, bot-test where touched).
2. **Review green** (ponytail-review).
3. **Eval green** — a fresh read-only eval subagent compares the PR diff
   against this ticket's numbered DoD, item by item, and design-language
   conformance for [UI] slices. See "Eval gate" in `docs/agents/afk-pipeline.md`.
   No merge on FAIL; 2nd FAIL escalates the implementer one model tier.

## Numbering

S1–S19 = v1 (archived, `docs/archive/V1_ARCHIVE.md`). S20–S57 = v2, per
`docs/LIFEOS_V2_ROADMAP.md`. Kanban cards `s20…s57` in `kanban.html` mirror
these tickets; `blockedBy` encodes the true dep graph + hotspot serialization.
