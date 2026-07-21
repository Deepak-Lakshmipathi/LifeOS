# Graph Report - .  (2026-07-21)

## Corpus Check
- 222 files · ~178,919 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1235 nodes · 2164 edges · 95 communities (77 shown, 18 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 88 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Broker Login OAuth|Broker Login OAuth]]
- [[_COMMUNITY_Calendar-Sync Agent|Calendar-Sync Agent]]
- [[_COMMUNITY_Dependencies & Package Config|Dependencies & Package Config]]
- [[_COMMUNITY_Bot Architecture ADRs|Bot Architecture ADRs]]
- [[_COMMUNITY_Bug-136 Run Manifest|Bug-136 Run Manifest]]
- [[_COMMUNITY_Domains & Warmth UI|Domains & Warmth UI]]
- [[_COMMUNITY_Email-Triage Agent|Email-Triage Agent]]
- [[_COMMUNITY_S40 Run Manifest|S40 Run Manifest]]
- [[_COMMUNITY_Domain Model & Seed ADRs|Domain Model & Seed ADRs]]
- [[_COMMUNITY_Issue-120 Run Manifest|Issue-120 Run Manifest]]
- [[_COMMUNITY_Job-Scout Agent|Job-Scout Agent]]
- [[_COMMUNITY_Task List & Dexie DB|Task List & Dexie DB]]
- [[_COMMUNITY_Home Cards & Habits Slices|Home Cards & Habits Slices]]
- [[_COMMUNITY_Bot ConfirmIntent Tests|Bot Confirm/Intent Tests]]
- [[_COMMUNITY_S20 Run Manifest|S20 Run Manifest]]
- [[_COMMUNITY_S24 Run Manifest|S24 Run Manifest]]
- [[_COMMUNITY_Bot Task Matching|Bot Task Matching]]
- [[_COMMUNITY_Bot Photo Confirm & NLU|Bot Photo Confirm & NLU]]
- [[_COMMUNITY_Impeccable Hook Cache|Impeccable Hook Cache]]
- [[_COMMUNITY_Tab Views & Card Primitive|Tab Views & Card Primitive]]
- [[_COMMUNITY_Bot Confirm Gate|Bot Confirm Gate]]
- [[_COMMUNITY_v2 Architecture Concepts|v2 Architecture Concepts]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 91|Community 91]]

## God Nodes (most connected - your core abstractions)
1. `Task` - 61 edges
2. `DOMAINS` - 21 edges
3. `run()` - 17 edges
4. `compilerOptions` - 16 edges
5. `Slice Backbone README` - 16 edges
6. `isDomain()` - 16 edges
7. `VaultTransport` - 16 edges
8. `Task (entity)` - 15 edges
9. `files` - 15 edges
10. `LocalOnly` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Inbox (derived group)` --conceptually_related_to--> `groupByProject()`  [INFERRED]
  CONTEXT.md → src/lib/groupByProject.ts
- `Sync seam (SyncProvider)` --references--> `SyncProvider`  [INFERRED]
  CONTEXT.md → src/sync/SyncProvider.ts
- `Task (entity)` --references--> `Task`  [INFERRED]
  CONTEXT.md → src/types/index.ts
- `Domain (entity)` --references--> `DOMAINS`  [INFERRED]
  CONTEXT.md → src/data/domains.ts
- `Microkernel vault-as-bus architecture` --semantically_similar_to--> `Sync seam (SyncProvider)`  [INFERRED] [semantically similar]
  docs/LIFEOS_V2_ROADMAP.md → CONTEXT.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Path-partitioned vault-writing agent fleet** — calendar_sync_readme, email_triage_readme, finance_sync_readme, job_scout_readme, docs_lifeos_v2_roadmap_path_partition [EXTRACTED 0.90]
- **Glass Cockpit design-system authoring chain** — docs_fable_design_doc_prompt, docs_design_language, docs_design_language_glass_principle, docs_lifeos_v2_roadmap [EXTRACTED 0.85]
- **Shared commitAndPush wrapper across agents** — calendar_sync_readme, email_triage_readme, job_scout_readme, finance_sync_readme, lib_push [EXTRACTED 0.90]
- **services/bot/router.ts cross-pipeline hotspot (S17/S18/S19b serialize)** — adr_0011_router_ts, adr_0012_bot_photo_vision, adr_0013_bot_confirm_destructive, adr_0014_bot_voice_transcription, agents_afk_pipeline [INFERRED 0.85]
- **Glass Cockpit visual design system (primitives + aurora + time-of-day)** — slices_slice_s21_glass_primitives, slices_slice_s22_aurora_bg, slices_slice_s23_time_of_day, slices_readme_glass_cockpit, mockups_cockpit_glass [INFERRED 0.85]
- **HomeView mount + rebase chain** — slices_slice_s29_day_review, slices_slice_s32_habits_card, slices_slice_s34_today_card, slices_slice_s37_attention_stack, slices_slice_s48_fleet_strip [EXTRACTED 1.00]
- **Vault contract-first parser + fixture slices** — slices_slice_s30_habits_contract, slices_slice_s33_calendar_contract, slices_slice_s36_mail_contract, slices_slice_s39_finance_contracts, slices_slice_s43_career_contracts, slices_slice_s47_agent_run_contract [INFERRED 0.85]
- **Path-partitioned vault producer agents** — slices_slice_s35_calendar_sync_agent, slices_slice_s38_email_triage_agent, slices_slice_s42_finance_sync_agent, slices_slice_s46_job_scout_agent [INFERRED 0.85]
- **Supervisor control plane (contracts, card, approval, agent)** — slices_slice_s52_supervisor_contract, slices_slice_s53_supervisor_card, slices_slice_s54_proposal_approval, slices_slice_s55_supervisor_agent [EXTRACTED 0.90]
- **Owner-gated proposal approval flow** — slices_slice_s55_supervisor_agent, slices_slice_s52_supervisor_contract, slices_slice_s54_proposal_approval [EXTRACTED 0.85]
- **Finance vault data contracts** — fixtures_finance_bills, fixtures_finance_burn, fixtures_finance_networth, fixtures_finance_portfolio [INFERRED 0.75]

## Communities (95 total, 18 thin omitted)

### Community 0 - "Broker Login OAuth"
Cohesion: 0.10
Nodes (42): buildLoginURL(), computeChecksum(), exchangeRequestToken(), login(), openBrowser(), saveAccessToken(), tokenFilePath(), waitForRequestToken() (+34 more)

### Community 1 - "Calendar-Sync Agent"
Cohesion: 0.09
Nodes (28): calendar-sync agent (S35), main(), classifyType(), eventsToMarkdown(), exchangeRefreshToken(), fetchTodayItems(), formatTimeInZone(), mapGcalItemsToEvents() (+20 more)

### Community 2 - "Dependencies & Package Config"
Cohesion: 0.05
Nodes (38): dependencies, buffer, dexie, framer-motion, isomorphic-git, @isomorphic-git/lightning-fs, react, react-dom (+30 more)

### Community 3 - "Bot Architecture ADRs"
Cohesion: 0.09
Nodes (36): ADR-0009 Vault Read Transport, ADR-0010 Vault Write, ADR-0011: Bot Transport, Own PAT, Durable id::, Intent-Router Seam, Durable id:: Task Identity, Intent-Router Seam (self-registering handler modules), claude-sonnet-5 Bot NLU Model Pin, services/bot/router.ts (message-ingest dispatch layer), ADR-0012: Bot Photo Modality (Vision Extraction, Batch-Confirm) (+28 more)

### Community 4 - "Bug-136 Run Manifest"
Cohesion: 0.06
Nodes (32): attempts, branch, bot-test, build-test, pwa-e2e, closes_issue, date, fallbacks_fired (+24 more)

### Community 5 - "Domains & Warmth UI"
Cohesion: 0.12
Nodes (20): DomainsMap(), DomainsMapProps, WarmthVisual, GlassElevation, Domain, DOMAIN_VAR, MissionCard(), MissionCardProps (+12 more)

### Community 6 - "Email-Triage Agent"
Cohesion: 0.11
Nodes (25): buildAttentionItem(), CLASSIFY_SCHEMA, classifyThread(), computeWaitingHours(), exchangeRefreshToken(), fetchAttentionMessages(), KNOWN_LABELS, normalizeClassification() (+17 more)

### Community 7 - "S40 Run Manifest"
Cohesion: 0.07
Nodes (29): attempts, branch, bot-test, build-test, pwa-e2e, date, fallbacks_fired, flake_reruns (+21 more)

### Community 8 - "Domain Model & Seed ADRs"
Cohesion: 0.09
Nodes (29): ADR-0005: Project is an unindexed, denormalized string, ADR-0006: Seed import on empty DB, S4 Deploy Tables, S5 Deploy (Domain + seed), Domain (entity), Inbox (derived group), Project (entity), Slice S2 — Task gains done_when (+21 more)

### Community 9 - "Issue-120 Run Manifest"
Cohesion: 0.07
Nodes (28): attempts, ci_flake_reruns, implement, review_cycles, review_reject, date, fallbacks_fired, gate (+20 more)

### Community 10 - "Job-Scout Agent"
Cohesion: 0.14
Nodes (24): appendToPipelineFile(), buildAppendLines(), decodeXmlEntities(), dedupKey(), existingCompanyRolePairs(), fetchHnRss(), fetchRemoteOk(), listingToPipelineLine() (+16 more)

### Community 11 - "Task List & Dexie DB"
Cohesion: 0.14
Nodes (15): AddTaskInputProps, TaskItemProps, TaskList(), TaskListProps, isDomain(), db, LifeOSDatabase, domainForProject() (+7 more)

### Community 12 - "Home Cards & Habits Slices"
Cohesion: 0.14
Nodes (26): BarMeter component, computeWarmth pure seam, DESIGN_LANGUAGE.md — Glass Cockpit design contract, missionPicks ranking seam, S29 — Evening Day Review card, S30 — Habits vault contract + parser, S31 — Habit hits feed domain warmth, S32 — Habits card: 7-day grid, streaks, tap-today (+18 more)

### Community 13 - "Bot Confirm/Intent Tests"
Cohesion: 0.15
Nodes (10): seedTransport(), getPending(), BotContext, IntentName, FakeTransport, WriteCall, writeFile(), createFakeVaultTransport() (+2 more)

### Community 14 - "S20 Run Manifest"
Cohesion: 0.08
Nodes (23): attempts, date, deviations, eval_rejects, fallbacks_fired, flake_reruns, issue, merge_commit (+15 more)

### Community 15 - "S24 Run Manifest"
Cohesion: 0.09
Nodes (23): date, dispatch, eval_reject_findings, eval_rejects, fallbacks_fired, flake_reruns, gate, ci (+15 more)

### Community 16 - "Bot Task Matching"
Cohesion: 0.17
Nodes (18): classifyMatches(), MatchedTask, MatchResult, matchTasks(), scoreMatch(), tasksFromFiles(), matched(), task() (+10 more)

### Community 17 - "Bot Photo Confirm & NLU"
Cohesion: 0.19
Nodes (19): classifyAndExtract(), clearPending(), getPending(), pending, PendingPhotoConfirmation, setPending(), TASKS, buildConfirmPrompt() (+11 more)

### Community 18 - "Impeccable Hook Cache"
Cohesion: 0.20
Nodes (21): files, updatedAt, editCount, findings, C:\\Users\\ldeep\\Python_Projects\\LifeOS\\kanban.html, C:\\Users\\ldeep\\Python_Projects\\LifeOS-s51\\services\\bot\\index.ts, C:\\Users\\ldeep\\Python_Projects\\LifeOS\\src\\components\\TaskItem.tsx, C:\\Users\\ldeep\\Python_Projects\\LifeOS\\src\\hooks\\useTasks.ts (+13 more)

### Community 19 - "Tab Views & Card Primitive"
Cohesion: 0.15
Nodes (11): AgentsView(), CareerView(), Card(), CardProps, distinctProjects(), MoneyView(), App(), provider (+3 more)

### Community 20 - "Bot Confirm Gate"
Cohesion: 0.18
Nodes (18): applyPatch(), buildConfirmPrompt(), buildResultReply(), commit(), ConfirmAction, describePatch(), DisambiguateAction, handleConfirmDecision() (+10 more)

### Community 21 - "v2 Architecture Concepts"
Cohesion: 0.12
Nodes (20): S16c owner verify checklist (HITL), Confirm-destructive (bot trust model), Intent (Claude-classified bot action), Pending confirmation (per-chat state), Slice (tracer-bullet increment), LifeOS v2 Glass Cockpit roadmap (S20-S57), Agent placement rule (VPS/PC/GH Actions), Microkernel vault-as-bus architecture (+12 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (12): buildCreateReply(), buildHeardPrefix(), ReplyTask, resolveVaultFilePath(), createHandler, CreateParams, handleCreate(), isValidPriority() (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (13): ClaudeClient, ExtractedParams, Intent, INTENT_SCHEMA, isValidPriority(), normalize(), RawExtraction, isValidPriority() (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.11
Nodes (17): dependencies, @anthropic-ai/sdk, isomorphic-git, description, devDependencies, tsx, @types/node, typescript (+9 more)

### Community 26 - "Community 26"
Cohesion: 0.23
Nodes (8): AddTaskInput(), PRIORITY_LABEL, Priority, PriorityControl(), PriorityControlProps, TaskItem(), DOMAIN_COLORS, DOMAINS

### Community 27 - "Community 27"
Cohesion: 0.19
Nodes (7): SnapshotEntry, parseTaskLine(), parseVault(), CTX, serializeTaskLine(), assertRoundTrip(), pickModeled()

### Community 28 - "Community 28"
Cohesion: 0.16
Nodes (17): ADR-0011 bot transport / identity / router, ADR-0014 bot voice transcription, LifeOS Telegram bot (services/bot), S32 habitsWrite transport seam, S39 net-worth history parser, S47 run-log contract (runs.jsonl + status.json), S48 HomeView, S49 AgentsView / fleet table chain (+9 more)

### Community 29 - "Community 29"
Cohesion: 0.23
Nodes (16): ADR-0001 PWA over native, Last-write-wins per record, ADR-0002 local-first, sync deferred, ADR-0004 generic update at seam, LifeOS Architecture Report, done_when field, Sync seam (SyncProvider), LifeOS Handoff (+8 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (16): Git-as-transport, parseTaskLine, parseVault, Best-effort push, GitTransport, Durable id:: identity, Inbox home, Local-authoritative commit (+8 more)

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (15): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+7 more)

### Community 32 - "Community 32"
Cohesion: 0.16
Nodes (10): FoldSectionProps, NowViewProps, UndoToast(), UndoToastProps, RankedTask, RankNowOpts, RESCUE_ELIGIBLE_STATES, allWarm() (+2 more)

### Community 33 - "Community 33"
Cohesion: 0.17
Nodes (12): AddInput, HomeView(), HomeViewProps, baseProps, ALL_BODY_CLASSES, AuroraPalette, BODY_CLASSES_BY_MODE, GREETINGS (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.20
Nodes (10): GlassPanel(), GlassPanelProps, SHADOW, PulseView(), PulseViewProps, WARMTH_BADGE, WARMTH_ORDER, completionsByDay() (+2 more)

### Community 35 - "Community 35"
Cohesion: 0.28
Nodes (11): Habit, HabitHit, hitDaySet(), parseHabitLog(), parseHabits(), serializeHabitHit(), splitFields(), streak() (+3 more)

### Community 36 - "Community 36"
Cohesion: 0.27
Nodes (14): NOW layout: top-3 live, rest folded, ADR-0007 NOW view dumb brain, FoldSection(), NowView(), Balance brain (S10), Dumb brain (pure priority NOW), NOW (command-center surface), priority field (+6 more)

### Community 37 - "Community 37"
Cohesion: 0.18
Nodes (14): AFK Pipeline Per-Repo Config, Triple-Green Merge Gate (CI + Review + Eval), Domain Docs Consumption Guide, CONTEXT.md (single-context domain glossary), Issue Tracker: GitHub Issues Conventions, Triage Labels Mapping, Slice S10 — Balance brain v1, rankNow balance algorithm (+6 more)

### Community 38 - "Community 38"
Cohesion: 0.20
Nodes (10): RouterDeps, fakeClaudeClient(), fakeTranscriber(), sendPhoto(), GetFileResponse, GetUpdatesResponse, TelegramClient, TelegramMessage (+2 more)

### Community 39 - "Community 39"
Cohesion: 0.24
Nodes (5): Seed (one-shot import), seedIfEmpty(), useTasks(), UseTasksResult, SyncProvider

### Community 40 - "Community 40"
Cohesion: 0.14
Nodes (10): board, DOMAINS, FACES, FEATURES, graph, GROUPS, kanban, kanbanForEmbed (+2 more)

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (8): _resetRunsCache(), AgentRun, AgentStatus, Health, healthOf(), parseRuns(), parseStatus(), FIX

### Community 42 - "Community 42"
Cohesion: 0.19
Nodes (8): Header(), HeaderProps, OPTIONS, FIXED, Segmented(), SegmentedOption, SegmentedProps, OPTIONS

### Community 43 - "Community 43"
Cohesion: 0.30
Nodes (12): LifeOS Mockup: The Daily Edition (newspaper style), LifeOS Mockup: Glass Cockpit (frosted glass, LOCKED design), LifeOS Mockup: Ops Terminal (monospace terminal style), Glass Cockpit Design Language (docs/DESIGN_LANGUAGE.md), S21: Glass Primitives (Card, Chip, Vital, Segmented), S22: Aurora Canvas Background, S23: useTimeOfDay Hook (greeting, palette, body class), S24: Cockpit Shell 6-Tab IA (App.tsx hotspot) (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.33
Nodes (9): BOT_DIR, main(), createClaudeClient(), logBotAction(), logHeartbeat(), makeRunRecord(), makeStatus(), RunInfo (+1 more)

### Community 45 - "Community 45"
Cohesion: 0.25
Nodes (4): BOT_AUTHOR, NodeVaultTransport, NodeVaultTransportOptions, scanVaultFiles()

### Community 46 - "Community 46"
Cohesion: 0.20
Nodes (11): GlassPanel design system primitive, Slice S11 — Glass / depth visual pass, parseCapture shorthand parser, Slice S12 — Smart capture, Slice S13 — Pulse tab (light), Pulse derived metrics, parseVault markdown parser, Vault transport decision (bridge/FSA/git) (+3 more)

### Community 47 - "Community 47"
Cohesion: 0.22
Nodes (5): GroqSegment, GroqTranscriber, GroqTranscriptionResponse, isConfident(), TranscriptionResult

### Community 49 - "Community 49"
Cohesion: 0.36
Nodes (6): fuzzyMatchDomain(), parseCapture(), TaskInput, AddInput, CaptureSheet(), CaptureSheetProps

### Community 50 - "Community 50"
Cohesion: 0.28
Nodes (4): DOMAIN_VAR, VitalsRow(), VitalsRowProps, WARMTH_OPACITY

### Community 51 - "Community 51"
Cohesion: 0.22
Nodes (4): TabBar(), TabBarProps, TABS, ViewTab

### Community 52 - "Community 52"
Cohesion: 0.28
Nodes (5): Aurora(), AuroraPalette, AuroraProps, BLOB_LAYOUT, MORNING_PALETTE

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (5): getTimeOfDay(), TIME_GRADIENTS, TIME_SOLID_BG, TimeOfDayBucket, useTimeGradient()

### Community 54 - "Community 54"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 55 - "Community 55"
Cohesion: 0.25
Nodes (5): ALLOWED_HOSTS, ALLOWED_ORIGINS, corsHeaders(), EXPOSE, FWD_REQ

### Community 56 - "Community 56"
Cohesion: 0.36
Nodes (3): clearVaultPat(), getVaultPat(), GitTransport

### Community 57 - "Community 57"
Cohesion: 0.29
Nodes (7): AFK pipeline lessons ledger, S35 calendar-sync deploy table, LifeOS project instructions (CLAUDE.md), Glass Cockpit design language contract, The Glass principle (translucent-over-aurora), Reduced-motion / a11y contract, Fable 5 prompt for design-language doc

### Community 58 - "Community 58"
Cohesion: 0.29
Nodes (6): agent, duration_ms, expected_cadence_min, last_run, note, ok

### Community 59 - "Community 59"
Cohesion: 0.38
Nodes (3): useCountUp(), Vital(), VitalProps

### Community 60 - "Community 60"
Cohesion: 0.29
Nodes (6): agent, duration_ms, expected_cadence_min, last_run, note, ok

### Community 61 - "Community 61"
Cohesion: 0.29
Nodes (6): __dirname, DIST, MIME, results, ROOT, server

### Community 62 - "Community 62"
Cohesion: 0.29
Nodes (6): agent, duration_ms, expected_cadence_min, last_run, note, ok

### Community 64 - "Community 64"
Cohesion: 0.40
Nodes (4): Chip(), ChipProps, ChipVariant, VARIANT_CLASS

### Community 65 - "Community 65"
Cohesion: 0.33
Nodes (4): DayReview(), DayReviewProps, StatPair, NOW

### Community 66 - "Community 66"
Cohesion: 0.60
Nodes (5): ADR-0003 CI-gated emulation PWA testing, CI build-test job, Tier 2 Lighthouse PWA installability audit, Tier 1 Playwright PWA tests, CI pwa-e2e job

### Community 67 - "Community 67"
Cohesion: 0.50
Nodes (3): BotConfig, loadConfig(), REQUIRED_VARS

### Community 68 - "Community 68"
Cohesion: 0.50
Nodes (5): Bot (Telegram capture face), id:: durable identity (vault-markdown field), LifeOS git CORS proxy (Cloudflare Worker), LifeOS PWA deployment (GitHub Pages + vault), Deploy to GitHub Pages workflow

### Community 69 - "Community 69"
Cohesion: 0.40
Nodes (3): NOW, TODAY_9AM, YESTERDAY_9PM

### Community 70 - "Community 70"
Cohesion: 0.40
Nodes (4): generated_at, note, projects, version

### Community 71 - "Community 71"
Cohesion: 0.67
Nodes (4): Throwaway Now/All toggle, App component, Tab bar navigation (S7), PWA Playwright e2e suite

### Community 75 - "Community 75"
Cohesion: 1.00
Nodes (3): PWA App Icon 192px, PWA App Icon 512px, PWA Maskable App Icon 512px

## Knowledge Gaps
- **426 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+421 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Task` connect `Task List & Dexie DB` to `Community 32`, `Community 65`, `Community 34`, `Community 33`, `Community 36`, `Domains & Warmth UI`, `Community 69`, `Community 39`, `Bot Task Matching`, `Community 50`, `Tab Views & Card Primitive`, `Bot Confirm Gate`, `Community 22`, `Community 26`, `Community 27`, `Community 63`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Why does `Task (entity)` connect `Community 36` to `Community 68`, `Community 39`, `Domain Model & Seed ADRs`, `Task List & Dexie DB`, `Community 57`, `Community 29`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `Sync seam (SyncProvider)` connect `Community 29` to `Community 36`, `Community 37`, `Community 39`, `Community 46`, `v2 Architecture Concepts`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Task` (e.g. with `Task (entity)` and `domainForProject()`) actually correct?**
  _`Task` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `DOMAINS` (e.g. with `Domain (entity)` and `seedIfEmpty()`) actually correct?**
  _`DOMAINS` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _437 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Broker Login OAuth` be split into smaller, more focused modules?**
  _Cohesion score 0.09929078014184398 - nodes in this community are weakly interconnected._