# Graph Report - .  (2026-08-04)

## Corpus Check
- 354 files · ~272,386 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1677 nodes · 3233 edges · 108 communities (100 shown, 8 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 156 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Agent Status + Daily Brief|Agent Status + Daily Brief]]
- [[_COMMUNITY_Mission + Day Review Slices|Mission + Day Review Slices]]
- [[_COMMUNITY_Fleet Strip + Agents Tab Slices|Fleet Strip + Agents Tab Slices]]
- [[_COMMUNITY_Architecture Decision Records|Architecture Decision Records]]
- [[_COMMUNITY_Calendar Sync Agent|Calendar Sync Agent]]
- [[_COMMUNITY_Supervisor + Agents View|Supervisor + Agents View]]
- [[_COMMUNITY_Email Triage Agent|Email Triage Agent]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_Habits Contract + Card|Habits Contract + Card]]
- [[_COMMUNITY_Pipeline Run bug-136 Confirm Gate|Pipeline Run: bug-136 Confirm Gate]]
- [[_COMMUNITY_Finance Sync Login (Kite)|Finance Sync Login (Kite)]]
- [[_COMMUNITY_Pipeline Run S40 Money Tab|Pipeline Run: S40 Money Tab]]
- [[_COMMUNITY_Pipeline Run issue-120 Unmount|Pipeline Run: issue-120 Unmount]]
- [[_COMMUNITY_Career Pipeline + Career View|Career Pipeline + Career View]]
- [[_COMMUNITY_Now Ranknow|Now Ranknow]]
- [[_COMMUNITY_Daystats|Daystats]]
- [[_COMMUNITY_Afk Pipeline|Afk Pipeline]]
- [[_COMMUNITY_Afk Pipeline|Afk Pipeline]]
- [[_COMMUNITY_Agents Supervisorcard|Agents Supervisorcard]]
- [[_COMMUNITY_Vitalsdata|Vitalsdata]]
- [[_COMMUNITY_Vault|Vault]]
- [[_COMMUNITY_Vault|Vault]]
- [[_COMMUNITY_Sync Vaultsync|Sync Vaultsync]]
- [[_COMMUNITY_Vault Finance|Vault Finance]]
- [[_COMMUNITY_Bot|Bot]]
- [[_COMMUNITY_Components|Components]]
- [[_COMMUNITY_Components Tabbar|Components Tabbar]]
- [[_COMMUNITY_Confirm|Confirm]]
- [[_COMMUNITY_Intents|Intents]]
- [[_COMMUNITY_Intents|Intents]]
- [[_COMMUNITY_Home Missioncard|Home Missioncard]]
- [[_COMMUNITY_Sync|Sync]]
- [[_COMMUNITY_Bot|Bot]]
- [[_COMMUNITY_Tsconfig|Tsconfig]]
- [[_COMMUNITY_Bot Package|Bot Package]]
- [[_COMMUNITY_Components|Components]]
- [[_COMMUNITY_Hooks Usetimeofday|Hooks Usetimeofday]]
- [[_COMMUNITY_Agents Proposallist|Agents Proposallist]]
- [[_COMMUNITY_Cors Proxy|Cors Proxy]]
- [[_COMMUNITY_Tasks Tasksview|Tasks Tasksview]]
- [[_COMMUNITY_Home Homeview|Home Homeview]]
- [[_COMMUNITY_Bot Tsconfig|Bot Tsconfig]]
- [[_COMMUNITY_Job Scout|Job Scout]]
- [[_COMMUNITY_Archive V1|Archive V1]]
- [[_COMMUNITY_Bot|Bot]]
- [[_COMMUNITY_Bot|Bot]]
- [[_COMMUNITY_Bot|Bot]]
- [[_COMMUNITY_Cockpit Header|Cockpit Header]]
- [[_COMMUNITY_Missionpicks|Missionpicks]]
- [[_COMMUNITY_Scripts Build|Scripts Build]]
- [[_COMMUNITY_Afk Pipeline|Afk Pipeline]]
- [[_COMMUNITY_Bot|Bot]]
- [[_COMMUNITY_Workflows Agent|Workflows Agent]]
- [[_COMMUNITY_Money|Money]]
- [[_COMMUNITY_Vault|Vault]]
- [[_COMMUNITY_Agents|Agents]]
- [[_COMMUNITY_Slices Slice|Slices Slice]]
- [[_COMMUNITY_Usetasksoptimistic|Usetasksoptimistic]]
- [[_COMMUNITY_Adr 0015|Adr 0015]]
- [[_COMMUNITY_Afk Pipeline|Afk Pipeline]]
- [[_COMMUNITY_Bot Taskmatch|Bot Taskmatch]]
- [[_COMMUNITY_Money Barmeter|Money Barmeter]]
- [[_COMMUNITY_Context|Context]]
- [[_COMMUNITY_Archive V1|Archive V1]]
- [[_COMMUNITY_Components Capturesheet|Components Capturesheet]]
- [[_COMMUNITY_Rotate|Rotate]]
- [[_COMMUNITY_Money Donut|Money Donut]]
- [[_COMMUNITY_Adr|Adr]]
- [[_COMMUNITY_Adr|Adr]]
- [[_COMMUNITY_Intents|Intents]]
- [[_COMMUNITY_Handoff|Handoff]]
- [[_COMMUNITY_Glass Aurora|Glass Aurora]]
- [[_COMMUNITY_Handoff|Handoff]]
- [[_COMMUNITY_Tsconfig Node|Tsconfig Node]]
- [[_COMMUNITY_Design Language|Design Language]]
- [[_COMMUNITY_Context|Context]]
- [[_COMMUNITY_Sync Vaultsync|Sync Vaultsync]]
- [[_COMMUNITY_Failed Status|Failed Status]]
- [[_COMMUNITY_Glass Vital|Glass Vital]]
- [[_COMMUNITY_Good Status|Good Status]]
- [[_COMMUNITY_Money Sparkline|Money Sparkline]]
- [[_COMMUNITY_Scripts Lh|Scripts Lh]]
- [[_COMMUNITY_Stale Status|Stale Status]]
- [[_COMMUNITY_Sync Localonly|Sync Localonly]]
- [[_COMMUNITY_Bot Telegramclient|Bot Telegramclient]]
- [[_COMMUNITY_Slices|Slices]]
- [[_COMMUNITY_Bot Reply|Bot Reply]]
- [[_COMMUNITY_Daily Brief|Daily Brief]]
- [[_COMMUNITY_Claude|Claude]]
- [[_COMMUNITY_Scripts Gen|Scripts Gen]]
- [[_COMMUNITY_Handoff|Handoff]]
- [[_COMMUNITY_Bot Ambient|Bot Ambient]]
- [[_COMMUNITY_Bot|Bot]]
- [[_COMMUNITY_Vite Env|Vite Env]]
- [[_COMMUNITY_Handoff Responsive|Handoff Responsive]]
- [[_COMMUNITY_Handoff Tasks|Handoff Tasks]]
- [[_COMMUNITY_Pwa Build|Pwa Build]]

## God Nodes (most connected - your core abstractions)
1. `Task` - 88 edges
2. `VaultTransport` - 38 edges
3. `isDomain()` - 25 edges
4. `DOMAINS` - 19 edges
5. `computeWarmth()` - 19 edges
6. `run()` - 17 edges
7. `serializeTaskLine()` - 16 edges
8. `compilerOptions` - 16 edges
9. `commitAndPush()` - 15 edges
10. `Domain` - 15 edges

## Surprising Connections (you probably didn't know these)
- `NodeVaultTransport` --semantically_similar_to--> `GitTransport`  [INFERRED] [semantically similar]
  services/bot/vaultTransport.ts → src/vault/transport.ts
- `ADR-0007: NOW view dumb brain (pure priority rank)` --references--> `rankNow()`  [EXTRACTED]
  docs/adr/0007-now-view-dumb-brain.md → src/now/rankNow.ts
- `LifeOS Telegram capture bot service` --shares_data_with--> `serializeTaskLine()`  [INFERRED]
  services/bot/README.md → src/vault/serialize.ts
- `Confirm-destructive (bot trust model)` --semantically_similar_to--> `Workflow — weekly supervisor fleet audit (S55)`  [INFERRED] [semantically similar]
  CONTEXT.md → .github/workflows/agent-supervisor.yml
- `Pending confirmation (per-chat TTL state)` --semantically_similar_to--> `S72 — undo window (toast at click, countdown from settle)`  [INFERRED] [semantically similar]
  CONTEXT.md → HANDOFF.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Vault agent fleet — cron workflows writing disjoint vault path-partitions with their own scoped PATs** — workflows_agent_calendar_sync_sync, workflows_agent_daily_brief_brief, workflows_agent_email_triage_triage, workflows_agent_job_scout_scout, workflows_agent_rotate_rotate, workflows_agent_supervisor_audit, calendar_sync_readme_path_partition, calendar_sync_readme_run_log_contract, handoff_live_vault_repo [EXTRACTED 1.00]
- **Triple-green merge gate — every CI job plus ponytail-review plus a fresh eval subagent** — handoff_triple_green_gate, workflows_ci_build_test, workflows_ci_bot_test, workflows_ci_pwa_e2e, handoff_eval_subagent_gate, afk_pipeline_out_lessons_mutation_test_guard [EXTRACTED 1.00]
- **Wave 14 slice set sequenced by serial hotspot lanes** — kanban_wave_14, handoff_hotspot_lanes, handoff_shell_owns_no_presence_protocol, handoff_optimistic_task_writes, handoff_lightning_fs_lock_safety, handoff_capture_write_failure_surface, handoff_undo_window, handoff_selfloadtasks_memo [EXTRACTED 1.00]
- **Path-partitioned vault-writing agent fleet** — finance_sync_readme_finance_sync_agent, job_scout_readme_job_scout_agent, supervisor_readme_supervisor_agent, docs_lifeos_v2_roadmap_path_partitioning, lib_push_commitandpush [EXTRACTED 1.00]
- **Vault read→write→durable-identity evolution** — adr_0009_vault_read_transport_git_as_transport, adr_0010_vault_write_single_line_splice, adr_0010_vault_write_in_memory_source_map, adr_0011_bot_transport_identity_router_durable_id_identity, vault_parsevault_parsetaskline, vault_serialize_serializetaskline [EXTRACTED 1.00]
- **Glass Cockpit visual system** — docs_design_language_design_tokens, docs_design_language_glass_principle, docs_design_language_aurora_canvas, docs_design_language_cursor_spotlight, docs_design_language_time_of_day_system, docs_design_language_reduced_motion_contract [EXTRACTED 1.00]
- **Confirm-destructive commit flow (match → pending state → y/n gate → rawLine splice)** — adr_0013_bot_confirm_destructive_confirm_destructive_trust_model, adr_0013_bot_confirm_destructive_scorematch, adr_0013_bot_confirm_destructive_pendingaction_store, adr_0013_bot_confirm_destructive_resolvepending_gate, adr_0013_bot_confirm_destructive_rawline_splice_rematch [EXTRACTED 1.00]
- **Three cockpit design explorations for the same content model (Glass chosen)** — mockups_cockpit_glass, mockups_cockpit_edition, mockups_cockpit_terminal [INFERRED 0.85]
- **Glass Cockpit shell phase — primitives, aurora, time-of-day, shell, header, vitals, mission** — slices_slice_s21_glass_primitives, slices_slice_s22_aurora_bg, slices_slice_s23_time_of_day, slices_slice_s24_cockpit_shell_tabs, slices_slice_s25_cockpit_header, slices_slice_s26_vitals_row, slices_slice_s27_todays_mission [EXTRACTED 1.00]
- **Vault-contract parser family — markdown contract + pure parser + committed fixture** — slices_slice_s30_habits_contract_habits, slices_slice_s33_calendar_contract_calendar, slices_slice_s36_mail_contract_mail, slices_slice_s39_finance_contracts_finance, slices_slice_s43_career_contracts_career, slices_slice_s47_agent_run_contract_agentstatus [INFERRED 0.85]
- **Producer agent fleet — path-partitioned writers logging through the S47 run contract** — slices_slice_s35_calendar_sync_agent_s35, slices_slice_s38_email_triage_agent_s38, slices_slice_s42_finance_sync_agent_s42, slices_slice_s46_job_scout_agent_s46, slices_slice_s47_agent_run_contract_runlog [EXTRACTED 1.00]
- **HomeView serial chain — each card slice rebases on the previous merge** — slices_slice_s28_mission_complete_s28, slices_slice_s29_day_review_s29, slices_slice_s32_habits_card_s32, slices_slice_s34_today_card_s34, slices_slice_s37_attention_stack_s37 [EXTRACTED 1.00]
- **Supervisor control plane: audit → report → proposal → owner approval** — slices_slice_s52_supervisor_contract, slices_slice_s53_supervisor_card, slices_slice_s54_proposal_approval, slices_slice_s55_supervisor_agent, slices_slice_s55_supervisor_agent_proposals_only_invariant [EXTRACTED 1.00]
- **Wave-14 useTasks write-path chain (S64 → S68 → S72)** — slices_slice_s64_optimistic_task_writes, slices_slice_s68_surface_capture_write_failures, slices_slice_s72_undo_window, slices_slice_s64_optimistic_task_writes_optimistic_write, slices_slice_s68_surface_capture_write_failures_refresh_never_rejects [EXTRACTED 1.00]
- **Anti-vacuity test discipline shared across wave-14 slices** — slices_slice_s64_optimistic_task_writes_antivacuity_harness, slices_slice_s63_nav_exit_trap, slices_slice_s64_optimistic_task_writes, slices_slice_s66_lightning_fs_lock_safety, slices_slice_s72_undo_window [INFERRED 0.85]
- **Golden-file contract suite for the vault parsers** — __fixtures___inline_field_syntax, __fixtures___malformed_line_tolerance, __fixtures___pinned_reference_today, __fixtures___habits_log_fixture, __fixtures___mail_attention_fixture, __fixtures___career_pipeline_fixture, __fixtures___finance_bills_fixture, __fixtures___calendar_today_fixture [INFERRED 0.85]
- **PWA emulation tier ladder (cheapest-first, stop when confident)** — testing_pwa_emulation_protocol_tier0_build_artifacts, testing_pwa_emulation_protocol_tier1_playwright_chromium, testing_pwa_emulation_protocol_tier2_lighthouse_installability, testing_pwa_emulation_protocol_tier3_android_emulator, testing_pwa_emulation_protocol_merge_gate [EXTRACTED 1.00]
- **Telegram voice note → vault write flow** — bot_telegramclient_realtelegramclient, bot_transcription_groqtranscriber, bot_readme_transcript_confidence_gate, bot_nlu_classifyandextract, bot_vaulttransport_nodevaulttransport [EXTRACTED 1.00]
- **AFK pipeline dispatch discipline (ticket -> agent -> merge)** — archive_v1_archive_deploy_table, archive_v1_archive_tracer_bullet_slice, archive_v1_archive_write_set_fence, archive_v1_archive_sonnet_readiness_check, archive_v1_archive_ci_build_supervisor, archive_v1_archive_dual_green_merge_gate, archive_v1_archive_hitl_flag, archive_v1_archive_hotspot_serialization [EXTRACTED 1.00]
- **Bot capture modalities over one intent pipeline** — archive_v1_archive_telegram_bot, archive_v1_archive_intent_router_seam, archive_v1_archive_confirm_destructive_gate, archive_v1_archive_voice_transcription_gate, archive_v1_archive_photo_vision_batch_confirm, archive_v1_archive_durable_id_field [EXTRACTED 1.00]
- **Group B — the v1 cockpit surface (Now, tabs, complete, warmth)** — archive_v1_archive_now_view, now_ranknow_ranknow, archive_v1_archive_tab_bar_navigation, archive_v1_archive_tap_dot_complete_undo, archive_v1_archive_domain_warmth, warmth_computewarmth_computewarmth [EXTRACTED 1.00]

## Communities (108 total, 8 thin omitted)

### Community 0 - "Agent Status + Daily Brief"
Cohesion: 0.07
Nodes (44): main(), BRIEF_SCHEMA, briefFilePath(), buildContextPack(), callClaudeForBrief(), composeBrief(), digestFile(), EXCLUDED_TOP_DIRS (+36 more)

### Community 1 - "Mission + Day Review Slices"
Cohesion: 0.05
Nodes (63): Reuse the existing complete/undo write seam, do not reimplement, S28 — Mission dot-tap completes task, warms domain, dayStats pure selector (missionDone, tasksCompleted, domainsWarmed), Render-gated pm visibility, not CSS-only, so tests can assert it, S29 — Evening Day Review card, Fixture-first rule — ship contract + parser + committed fixture before any UI, src/vault/habits.ts — parseHabits / parseHabitLog / weekGrid / streak, S30 — Habits vault contract + parser (+55 more)

### Community 2 - "Fleet Strip + Agents Tab Slices"
Cohesion: 0.06
Nodes (52): S48 — Fleet mini strip on Home, Agent LED health mapping (ok / amber / red / idle), S49 — Agents tab: fleet table, agentManifest static roster, S50 — daily-brief agent + Home surface, Token-capped vault context pack, S51 — Telegram bot logs runs → appears on Health, Always-on bot heartbeat cadence (+44 more)

### Community 3 - "Architecture Decision Records"
Cohesion: 0.05
Nodes (51): ADR-0001: Installable PWA over Tauri/Flutter/native, ADR-0002: Local-first, sync deferred, SyncProvider seam (no-op LocalOnly), ADR-0003: CI-gated emulation for PWA acceptance, ADR-0004: Task mutation via generic update at the seam, ADR-0005: Project as unindexed denormalized string, ?noseed test escape hatch, ADR-0006: Seed the vault shape on an empty DB (+43 more)

### Community 4 - "Calendar Sync Agent"
Cohesion: 0.08
Nodes (36): Fixture — calendar-today.md (day's events), classifyType(), eventsToMarkdown(), exchangeRefreshToken(), fetchTodayItems(), formatTimeInZone(), mapGcalItemsToEvents(), run() (+28 more)

### Community 5 - "Supervisor + Agents View"
Cohesion: 0.08
Nodes (38): Fixture — supervisor-report.md (weekly fleet report), AgentRow(), AgentRowProps, AgentsView(), AgentsViewProps, formatLastRun(), INFRA_BADGE, LED_CLASS (+30 more)

### Community 6 - "Email Triage Agent"
Cohesion: 0.09
Nodes (34): Fixture — mail-attention.md (email-triage attention queue), buildAttentionItem(), CLASSIFY_SCHEMA, classifyThread(), computeWaitingHours(), exchangeRefreshToken(), fetchAttentionMessages(), KNOWN_LABELS (+26 more)

### Community 7 - "Package Dependencies"
Cohesion: 0.05
Nodes (38): dependencies, buffer, dexie, framer-motion, isomorphic-git, @isomorphic-git/lightning-fs, react, react-dom (+30 more)

### Community 8 - "Habits Contract + Card"
Cohesion: 0.14
Nodes (26): Fixture — habits.md (habit definitions), Fixture — habits-log.md (append-only hit log), Pinned reference 'today' in fixtures, DOMAIN_VAR, HabitRow(), HabitRowProps, HabitsCard(), HabitsCardProps (+18 more)

### Community 9 - "Pipeline Run: bug-136 Confirm Gate"
Cohesion: 0.06
Nodes (32): attempts, branch, bot-test, build-test, pwa-e2e, closes_issue, date, fallbacks_fired (+24 more)

### Community 10 - "Finance Sync Login (Kite)"
Cohesion: 0.16
Nodes (28): buildLoginURL(), computeChecksum(), exchangeRequestToken(), login(), openBrowser(), saveAccessToken(), tokenFilePath(), waitForRequestToken() (+20 more)

### Community 11 - "Pipeline Run: S40 Money Tab"
Cohesion: 0.07
Nodes (29): attempts, branch, bot-test, build-test, pwa-e2e, date, fallbacks_fired, flake_reruns (+21 more)

### Community 12 - "Pipeline Run: issue-120 Unmount"
Cohesion: 0.07
Nodes (28): attempts, ci_flake_reruns, implement, review_cycles, review_reject, date, fallbacks_fired, gate (+20 more)

### Community 13 - "Career Pipeline + Career View"
Cohesion: 0.15
Nodes (20): Fixture — career-pipeline.md (job pipeline), CareerView(), CareerViewProps, fixture(), fixtureCourses(), fixtureJobs(), HERE, CoursesCard() (+12 more)

### Community 14 - "Now Ranknow"
Cohesion: 0.15
Nodes (17): BOT_AUTHOR, NodeVaultTransportOptions, Domain, DOMAINS, DOMAIN_HEX, hexToRgb(), WARMTH_OPACITY, warmthTint (+9 more)

### Community 15 - "Daystats"
Cohesion: 0.14
Nodes (15): DayReview(), DayReviewProps, StatPair, NOW, dayStats, startOfDay(), NOW, TODAY_9AM (+7 more)

### Community 16 - "Afk Pipeline"
Cohesion: 0.08
Nodes (24): date, dispatch, eval_reject_findings, eval_rejects, fallbacks_fired, flake_reruns, gate, ci (+16 more)

### Community 17 - "Afk Pipeline"
Cohesion: 0.08
Nodes (23): attempts, date, deviations, eval_rejects, fallbacks_fired, flake_reruns, issue, merge_commit (+15 more)

### Community 18 - "Agents Supervisorcard"
Cohesion: 0.10
Nodes (15): ADR-0012 D3: Batch-confirm UX (all/none/subset, 10-min TTL), SupervisorCard(), SupervisorCardProps, HERE, REPORT_MD, Fleet LED (only failures animate), O(1) staleness health via agents/*/status.json, Card() (+7 more)

### Community 19 - "Vitalsdata"
Cohesion: 0.19
Nodes (14): SOME_TASKS, VitalsRow(), VitalsRowProps, burnVital(), completionVital(), hottestNext(), netWorthVital(), NO_DATA (+6 more)

### Community 20 - "Vault"
Cohesion: 0.15
Nodes (12): Inline (key:: value) field syntax, Malformed-line tolerance contract, In-memory source-map identity (no id:: in markdown), ADR-0011 D3: Durable id:: identity with lazy first-write backfill, Transcript confidence gate (mean no_speech_prob), SnapshotEntry, parseTaskLine(), parseVault() (+4 more)

### Community 21 - "Vault"
Cohesion: 0.16
Nodes (17): Fixture — proposal-approved.md (same proposal, approved), Fixture — proposal-pending.md (agent proposal, pending), Proposal status lifecycle (pending | approved | rejected), flipProposal(), WriteCall, findFrontmatter(), parseProposal(), Proposal (+9 more)

### Community 22 - "Sync Vaultsync"
Cohesion: 0.10
Nodes (8): ProposalListProps, FakeTransport, FakeTransport, FakeTransport, WriteCall, FakeVaultTransport, FakeTransport, VaultTransport

### Community 23 - "Vault Finance"
Cohesion: 0.22
Nodes (17): Fixture — career-courses.md (course progress), Fixture — finance-bills.md (upcoming bills), Fixture — finance-burn.md (monthly income vs spend), Fixture — finance-networth.md (append-only markdown table), Fixture — finance-portfolio.md (allocation slices), INR shorthand amount parsing (₹1.2k / ₹2.05L / ₹17.2L), fixture(), fixtureProps() (+9 more)

### Community 24 - "Bot"
Cohesion: 0.16
Nodes (15): BotConfig, loadConfig(), REQUIRED_VARS, BOT_DIR, main(), createClaudeClient(), Separate bot/PWA vault PATs, Owner chat-id guard (+7 more)

### Community 25 - "Components"
Cohesion: 0.15
Nodes (15): DomainsMapProps, WARMTH_VISUAL, WarmthVisual, GlassElevation, GlassPanel(), GlassPanelProps, SHADOW, PulseView() (+7 more)

### Community 26 - "Components Tabbar"
Cohesion: 0.12
Nodes (10): TabBar(), TabBarProps, TABS, CHAR_WIDTH_PER_1000, LABELS, ViewTab, distinctProjects(), TAB_FADE (+2 more)

### Community 27 - "Confirm"
Cohesion: 0.18
Nodes (18): applyPatch(), buildConfirmPrompt(), buildResultReply(), commit(), ConfirmAction, describePatch(), DisambiguateAction, handleConfirmDecision() (+10 more)

### Community 28 - "Intents"
Cohesion: 0.18
Nodes (7): fakeClaudeClient(), fakeTranscriber(), sendPhoto(), seedTransport(), getPending(), BotContext, createFakeVaultTransport()

### Community 29 - "Intents"
Cohesion: 0.18
Nodes (12): resolveVaultFilePath(), createHandler, CreateParams, handleCreate(), isValidPriority(), deleteHandler, DeleteParams, getIntentHandler() (+4 more)

### Community 30 - "Home Missioncard"
Cohesion: 0.12
Nodes (10): UndoToast(), UndoToastProps, Chip(), ChipProps, ChipVariant, VARIANT_CLASS, DOMAIN_VAR, MissionCardProps (+2 more)

### Community 31 - "Sync"
Cohesion: 0.20
Nodes (6): seedIfEmpty(), LocalOnly, __resetSelfLoadTasksCache(), selfLoadTasks(), TASKS, SyncProvider

### Community 32 - "Bot"
Cohesion: 0.15
Nodes (12): HITL-by-construction verification boundary (S16c vs S18), Local-authoritative commit, best-effort push, Wipe-and-reclone guard on readFiles, NodeVaultTransport, scanVaultFiles(), Merge gate for #6 (Tier 0+1+2 required, Tier 3 nice-to-have), Offline cold-start persistence criterion, PWA Emulation Testing Protocol (+4 more)

### Community 33 - "Tsconfig"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 34 - "Bot Package"
Cohesion: 0.11
Nodes (17): dependencies, @anthropic-ai/sdk, isomorphic-git, description, devDependencies, tsx, @types/node, typescript (+9 more)

### Community 35 - "Components"
Cohesion: 0.19
Nodes (9): AddTaskInput(), AddTaskInputProps, Priority, PRIORITY_LABELS, PriorityControl(), PriorityControlProps, priorityLabel(), TaskItem() (+1 more)

### Community 36 - "Hooks Usetimeofday"
Cohesion: 0.18
Nodes (11): ALL_BODY_CLASSES, AuroraPalette, BODY_CLASSES_BY_MODE, GREETINGS, PALETTES, UseTimeOfDayResult, cockpitMode, getTimeOfDay() (+3 more)

### Community 37 - "Agents Proposallist"
Cohesion: 0.12
Nodes (11): ActionButtonProps, Armed, ARMED_GLOW, ProposalList(), ProposalRowProps, APPROVED_MD, FIX, HERE (+3 more)

### Community 38 - "Cors Proxy"
Cohesion: 0.15
Nodes (7): RealTelegramClient, ALLOWED_HOSTS, ALLOWED_ORIGINS, corsHeaders(), EXPOSE, fetch(), FWD_REQ

### Community 39 - "Tasks Tasksview"
Cohesion: 0.16
Nodes (11): DomainsMap(), FoldSectionProps, NowView(), NowViewProps, rankNow(), SegmentId, SEGMENTS, TasksView() (+3 more)

### Community 40 - "Home Homeview"
Cohesion: 0.17
Nodes (9): db, LifeOSDatabase, AddInput, HomeView(), HomeViewProps, baseProps, FIVE_BRIEF_LINES, UP_NEXT_FIXTURE (+1 more)

### Community 41 - "Bot Tsconfig"
Cohesion: 0.12
Nodes (15): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+7 more)

### Community 42 - "Job Scout"
Cohesion: 0.30
Nodes (14): appendToPipelineFile(), buildAppendLines(), decodeXmlEntities(), dedupKey(), existingCompanyRolePairs(), fetchHnRss(), fetchRemoteOk(), listingToPipelineLine() (+6 more)

### Community 43 - "Archive V1"
Cohesion: 0.20
Nodes (15): CI Build Supervisor (paired agent), Confirm-destructive gate (update/delete), AFK deploy table (issue / task / context / model / parallel group), Dual-green merge gate (CI + ponytail-review ultra), Durable `id::` identity in vault markdown, HITL flag (not CI-verifiable), Cross-pipeline hotspot: serialize, don't same-batch, Intent router seam (self-registering intents) (+7 more)

### Community 44 - "Bot"
Cohesion: 0.16
Nodes (10): classifyAndExtract(), Voice-note capture pipeline, RouterDeps, TelegramClient, GroqSegment, GroqTranscriber, GroqTranscriptionResponse, isConfident() (+2 more)

### Community 45 - "Bot"
Cohesion: 0.22
Nodes (11): clearPending(), getPending(), pending, PendingPhotoConfirmation, TASKS, ExtractedTask, isValidPriority(), normalize() (+3 more)

### Community 46 - "Bot"
Cohesion: 0.30
Nodes (12): setPending(), buildConfirmPrompt(), ConfirmParseResult, dispatchIntent(), emitAction(), handleConfirmReply(), handleIncomingMessage(), handlePhotoMessage() (+4 more)

### Community 47 - "Cockpit Header"
Cohesion: 0.19
Nodes (9): Header(), HeaderProps, OPTIONS, FIXED, Segmented(), SegmentedOption, SegmentedProps, OPTIONS (+1 more)

### Community 48 - "Missionpicks"
Cohesion: 0.22
Nodes (11): MissionCard(), COURSE_CANDIDATE_PRIORITY, CourseCandidate, missionPicks(), MissionPicksResult, synthesizeCourseCandidate(), synthesizeWhy(), allWarm() (+3 more)

### Community 49 - "Scripts Build"
Cohesion: 0.14
Nodes (10): board, DOMAINS, FACES, FEATURES, graph, GROUPS, kanban, kanbanForEmbed (+2 more)

### Community 50 - "Afk Pipeline"
Cohesion: 0.21
Nodes (13): Lesson — run the state machine to REST against a stateful mock, Lesson — a flake fingerprint match is a hypothesis, not a verdict, AFK pipeline lessons ledger, Lesson — pre-cut ticket takes the light path (resume at P5), Lesson — mutation-test every guard/race regression test, S35 calendar-sync deploy table (AFK dispatch record), AFK pipeline per-repo constitution, Fresh eval subagent vs numbered DoD (+5 more)

### Community 51 - "Bot"
Cohesion: 0.19
Nodes (8): ClaudeClient, ExtractedParams, Intent, INTENT_SCHEMA, isValidPriority(), normalize(), RawExtraction, IMAGE

### Community 52 - "Workflows Agent"
Cohesion: 0.29
Nodes (13): calendar-sync agent (S35), Strict vault path-partition per agent, S47 run-status contract (runs.jsonl + status.json), email-triage agent (S38), Prompt change policy (routes through supervisor proposals), LiveOS-VaultRepo (private vault repo, source of truth), S57 per-agent fine-grained vault PAT pattern, Workflow — calendar-sync cron job (+5 more)

### Community 53 - "Money"
Cohesion: 0.27
Nodes (8): BillsList(), BillsListProps, HERE, MoneyView(), useCountUp(), Bill, formatINR(), networthDelta()

### Community 54 - "Vault"
Cohesion: 0.26
Nodes (5): appendHabitHit(), clearVaultPat(), getVaultPat(), GitTransport, h

### Community 55 - "Agents"
Cohesion: 0.24
Nodes (12): AFK pipeline — per-repo config (constitution), CI flake fingerprints ledger (offline-persistence e2e, syncProvider seam-isolation timeout), Eval subagent gate — fresh read-only Sonnet checks each numbered DoD against the diff, Model tiers for P5 dispatch routing (Haiku / Sonnet / Opus escalation), Triple-green merge gate (CI + review + eval), Issue tracker: GitHub Issues on Deepak-Lakshmipathi/LifeOS via gh CLI, Wayfinder map + child tickets + native issue dependencies for blocking, Triage labels — role-to-label mapping (+4 more)

### Community 56 - "Slices Slice"
Cohesion: 0.32
Nodes (12): Balance brain — priority ranking capped ~2/domain plus a coldest-domain rescue inject, Mockup — The Daily Edition (newspaper/editorial cockpit direction), Mockup — Glass Cockpit (chosen direction: aurora, frosted panels, pill tabs), Mockup — Ops Terminal (monospace section-stack cockpit direction), S21 — Glass primitives: Card, Chip, Vital, Segmented [UI], S22 — Aurora canvas background [UI], S23 — useTimeOfDay: greeting, body class, aurora palette [UI], S24 — Cockpit shell: 6-tab IA restructure [UI] (App.tsx hotspot) (+4 more)

### Community 57 - "Usetasksoptimistic"
Cohesion: 0.21
Nodes (8): useTasks(), UseTasksResult, App(), A, B, deferred(), makeDeferredProvider(), mountWith()

### Community 58 - "Adr 0015"
Cohesion: 0.20
Nodes (11): ADR-0015 — The shell hosts no presence-acknowledgement protocol, Enter-only is the rule for panel roots (exit is now a cut), Two implicit registration classes — declaring exit, or declaring layout/layoutId, Shell is a microkernel, tab panels are plugins — a plugin must not hang the core, AnimatePresence acknowledgement protocol (untimed, edge-triggered, one-shot), shellNavigation.test.tsx — structural guard that App.tsx contains no AnimatePresence, Domain docs — how skills consume CONTEXT.md and docs/adr/, Single-context repo — one CONTEXT.md glossary + one docs/adr/ for PWA and bot (+3 more)

### Community 59 - "Afk Pipeline"
Cohesion: 0.18
Nodes (10): board_delta, cap_respected, date, issues_closed, issues_filed, mode, run, slices (+2 more)

### Community 60 - "Bot Taskmatch"
Cohesion: 0.33
Nodes (8): classifyMatches(), MatchedTask, MatchResult, matchTasks(), scoreMatch(), matched(), task(), MATCH

### Community 61 - "Money Barmeter"
Cohesion: 0.27
Nodes (8): CourseRow(), CoursesCardProps, courseVariant(), useCountUp(), BarMeter(), BarMeterProps, BarMeterVariant, VARIANT_GRADIENT

### Community 62 - "Context"
Cohesion: 0.22
Nodes (11): Balance brain (per-domain cap + coldest-domain injection), Domain (7 fixed life areas), done_when (written acceptance criterion), NOW (command-center queue), priority (1|2|3, first Dexie-indexed field), Project (denormalized string on Task), rankNow (pure ranking seam), Seed (idempotent one-shot import) (+3 more)

### Community 63 - "Archive V1"
Cohesion: 0.36
Nodes (10): LifeOS V1 archive — collapsed S1–S19 planning docs + pipeline run artifacts, Apple-feel polish as acceptance, not decoration, Domain warmth (derived, never logged), NOW view (command-center surface), PWA shell (installable + offline), Slice backbone — tracer-bullet vertical increment sized for the afk-pipeline, The sync seam — UI depends only on SyncProvider; only LifeOSDb imports Dexie, Tab bar navigation shape (Now/Domains/Pulse/+) (+2 more)

### Community 64 - "Components Capturesheet"
Cohesion: 0.31
Nodes (7): fuzzyMatchDomain(), parseCapture(), TaskInput, AddInput, CaptureSheet(), CaptureSheetProps, PRIORITY_LABEL

### Community 65 - "Rotate"
Cohesion: 0.33
Nodes (5): atomicWrite(), isSeparatorRow(), monthOf(), pruneNetworth(), rotateJsonl()

### Community 66 - "Money Donut"
Cohesion: 0.33
Nodes (7): Donut(), DONUT_PALETTE, DonutProps, DonutSegment, donutSegments(), SLICES, PortfolioSlice

### Community 67 - "Adr"
Cohesion: 0.31
Nodes (9): ADR-0011 — Bot transport, identity, intent-router seam, ADR-0014 — Bot voice notes: Groq Whisper, no transcoding, confidence-gated retype, Confidence gate — never throw, mean no_speech_prob <= 0.5, else ask to retype, GroqTranscriber — hosted whisper-large-v3-turbo via raw fetch, no vendor SDK, OGG/Opus pass-through — no ffmpeg, no transcoding, Transcriber interface + createTranscriber factory (TranscriptionResult), Voice is a modality, not an intent, LifeOS Telegram capture bot service (+1 more)

### Community 68 - "Adr"
Cohesion: 0.36
Nodes (9): ADR-0012 — Bot photo vision (S19 batch confirm), ADR-0013 — Bot confirm-destructive: pending state, task targeting, router gate, Confirm-destructive trust model, PendingAction store — in-memory Map<chatId, PendingAction>, lazy expiry, no persistence, Commit-time exact rawLine splice re-match (VaultSync pattern, replicated not imported), resolvePending — confirm gate above per-intent dispatch, checked before Claude NLU, router.ts cross-pipeline hotspot (S17/S18/S19 same-file collision), scoreMatch — token-overlap fuzzy task targeting (0.6 confident / 0.5 candidate floor) (+1 more)

### Community 69 - "Intents"
Cohesion: 0.36
Nodes (8): tasksFromFiles(), buildDisambiguatePrompt(), handleDelete(), buildPatch(), handleUpdate(), isValidPriority(), updateHandler, UpdateParams

### Community 70 - "Handoff"
Cohesion: 0.22
Nodes (9): Single-context domain docs rule, LifeOS (personal life tracker), Slice (tracer-bullet vertical increment), Self-hosted Cloudflare Worker CORS proxy, Glass Cockpit design lock (DESIGN_LANGUAGE.md), Runtime PAT (localStorage, never baked into the bundle), window.prompt in a load path blocks browser automation, PWA HTML entry shell (manifest + root mount) (+1 more)

### Community 71 - "Glass Aurora"
Cohesion: 0.28
Nodes (5): Aurora(), AuroraPalette, AuroraProps, BLOB_LAYOUT, MORNING_PALETTE

### Community 72 - "Handoff"
Cohesion: 0.33
Nodes (9): S68 — surface capture write failures, S60 — Completion vital in the first tile slot, S66 — LightningFS lock safety (7 AbortErrors), S64 — optimistic task writes, selfLoadTasks permanently-memoized reader (#186/#167), S63 — the shell owns no presence protocol (ADR-0015), S72 — undo window (toast at click, countdown from settle), Wave 14 card set (S63/S64/S66/S68/S72) (+1 more)

### Community 73 - "Tsconfig Node"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 74 - "Design Language"
Cohesion: 0.29
Nodes (8): ADR-0007: NOW view dumb brain (pure priority rank), ADR-0008: Balance brain, Coldest-domain rescue injection (anti-rot), Per-domain cap (anti-flood), Seven-domain color system + fixed domain order, Mission task card (why + done_when always visible), Vital tile (count-up metric), Warmth as page-background tint (S60 owner feedback)

### Community 75 - "Context"
Cohesion: 0.29
Nodes (8): S16c owner verify checklist (5 live cases), Bot (Telegram capture face), Confirm-destructive (bot trust model), id:: durable vault identity, Inbox (derived project-less group), Intent (Claude-classified bot action), Pending confirmation (per-chat TTL state), S16c owner-only live verify (the one human gate)

### Community 77 - "Failed Status"
Cohesion: 0.29
Nodes (6): agent, duration_ms, expected_cadence_min, last_run, note, ok

### Community 78 - "Glass Vital"
Cohesion: 0.38
Nodes (3): useCountUp(), Vital(), VitalProps

### Community 79 - "Good Status"
Cohesion: 0.29
Nodes (6): agent, duration_ms, expected_cadence_min, last_run, note, ok

### Community 80 - "Money Sparkline"
Cohesion: 0.38
Nodes (4): Sparkline(), sparklinePoints(), SparklineProps, SparkPoint

### Community 81 - "Scripts Lh"
Cohesion: 0.29
Nodes (6): __dirname, DIST, MIME, results, ROOT, server

### Community 82 - "Stale Status"
Cohesion: 0.29
Nodes (6): agent, duration_ms, expected_cadence_min, last_run, note, ok

### Community 83 - "Sync Localonly"
Cohesion: 0.40
Nodes (4): Canonical seven-domain enum validation, isDomain(), MissionTaskRow(), isValidPriority()

### Community 84 - "Bot Telegramclient"
Cohesion: 0.40
Nodes (4): GetFileResponse, GetUpdatesResponse, TelegramMessage, TelegramUpdate

### Community 85 - "Slices"
Cohesion: 0.47
Nodes (6): LifeOS v2 slice tickets README (S20–S62), Dispatch waves + hotspot serialization rules (serialize-don't-batch), Fixture-first — every [UI] slice tests against committed fixture markdown, zero network/secrets, The vault is the bus — microkernel core, integrations and agents are markdown-only plugins, Path-partitioning — every writer owns a disjoint file set so git auto-merges, App.tsx sole-toucher rule — S24 leaves stub mount points so later slices edit only their own file

### Community 86 - "Bot Reply"
Cohesion: 0.60
Nodes (3): buildCreateReply(), buildHeardPrefix(), ReplyTask

### Community 87 - "Daily Brief"
Cohesion: 0.40
Nodes (5): Sync seam (SyncProvider interface), daily-brief agent (S50), Fail-loud brief policy (missing beats malformed), Git-as-transport vault sync (GitTransport), _readFiles() flat folder allowlist gap (#158)

### Community 88 - "Claude"
Cohesion: 0.50
Nodes (4): Issue tracker convention (GitHub Issues via gh), Canonical triage labels, #board-data canonical board JSON, Kanban card schema (id/column/slice/issue/pr/blockedBy)

### Community 90 - "Handoff"
Cohesion: 1.00
Nodes (3): Lesson — slices sharing a hotspot file must serialize, Hotspot lanes (strictly serial within a lane), Worktree isolation for parallel git-writing subagents

## Ambiguous Edges - Review These
- `S68 — surface capture write failures` → `window.prompt in a load path blocks browser automation`  [AMBIGUOUS]
  HANDOFF.md · relation: conceptually_related_to

## Knowledge Gaps
- **493 isolated node(s):** `slice`, `title`, `mode`, `type`, `path` (+488 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `S68 — surface capture write failures` and `window.prompt in a load path blocks browser automation`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Task` connect `Daystats` to `Calendar Sync Agent`, `Now Ranknow`, `Vitalsdata`, `Vault`, `Components`, `Components Tabbar`, `Confirm`, `Intents`, `Home Missioncard`, `Sync`, `Components`, `Tasks Tasksview`, `Home Homeview`, `Missionpicks`, `Usetasksoptimistic`, `Bot Taskmatch`, `Glass Aurora`, `Sync Vaultsync`, `Sync Localonly`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `VaultTransport` connect `Sync Vaultsync` to `Bot`, `Calendar Sync Agent`, `Agents Proposallist`, `Supervisor + Agents View`, `Email Triage Agent`, `Habits Contract + Card`, `Home Homeview`, `Bot`, `Sync Vaultsync`, `Bot`, `Now Ranknow`, `Vault`, `Vault`, `Vault`, `Bot`, `Intents`, `Intents`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `rankNow()` connect `Tasks Tasksview` to `Architecture Decision Records`, `Calendar Sync Agent`, `Design Language`, `Now Ranknow`, `Missionpicks`, `Sync Localonly`, `Slices Slice`, `Archive V1`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `slice`, `title`, `mode` to the rest of the system?**
  _528 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Agent Status + Daily Brief` be split into smaller, more focused modules?**
  _Cohesion score 0.06646825396825397 - nodes in this community are weakly interconnected._
- **Should `Mission + Day Review Slices` be split into smaller, more focused modules?**
  _Cohesion score 0.05069124423963134 - nodes in this community are weakly interconnected._