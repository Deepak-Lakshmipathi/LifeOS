# Graph Report - .  (2026-06-23)

## Corpus Check
- Corpus is ~25,585 words - fits in a single context window. You may not need a graph.

## Summary
- 228 nodes · 304 edges · 23 communities (19 shown, 4 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.82)
- Token cost: 106,508 input · 18,794 output

## Community Hubs (Navigation)
- [[_COMMUNITY_ADRs & Domain Model|ADRs & Domain Model]]
- [[_COMMUNITY_React App Shell & Data Layer|React App Shell & Data Layer]]
- [[_COMMUNITY_Build Dependencies|Build Dependencies]]
- [[_COMMUNITY_Slice Roadmap (Task Schema)|Slice Roadmap (Task Schema)]]
- [[_COMMUNITY_Vault & Telegram Bot|Vault & Telegram Bot]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Task UI Components|Task UI Components]]
- [[_COMMUNITY_Node TS Config|Node TS Config]]
- [[_COMMUNITY_NPM Scripts|NPM Scripts]]
- [[_COMMUNITY_Lighthouse PWA Audit|Lighthouse PWA Audit]]
- [[_COMMUNITY_PWA CI Testing|PWA CI Testing]]
- [[_COMMUNITY_Seed Tasks (basic)|Seed Tasks (basic)]]
- [[_COMMUNITY_Icon Generation|Icon Generation]]
- [[_COMMUNITY_PWA App Icons|PWA App Icons]]
- [[_COMMUNITY_Seed Tasks (detailed)|Seed Tasks (detailed)]]
- [[_COMMUNITY_PWA Build Test|PWA Build Test]]
- [[_COMMUNITY_Three-Faces Vision|Three-Faces Vision]]

## God Nodes (most connected - your core abstractions)
1. `Task` - 17 edges
2. `compilerOptions` - 16 edges
3. `Slice Backbone README` - 10 edges
4. `LocalOnly` - 9 edges
5. `Sync seam (SyncProvider)` - 9 edges
6. `scripts` - 8 edges
7. `LifeOS Handoff` - 8 edges
8. `ADR-0002 local-first, sync deferred` - 8 edges
9. `compilerOptions` - 7 edges
10. `ADR-0004 generic update at seam` - 7 edges

## Surprising Connections (you probably didn't know these)
- `File is both data and UI (one source of truth)` --semantically_similar_to--> `Vault as live source of truth (dashboard ⇄ Obsidian)`  [INFERRED] [semantically similar]
  kanban.html → docs/slices/slice-S15-vault-write.md
- `ADR-0001 PWA over native` --references--> `Slice (tracer-bullet increment)`  [INFERRED]
  docs/adr/0001-pwa-over-native.md → CONTEXT.md
- `ADR-0004 generic update at seam` --references--> `priority field`  [EXTRACTED]
  docs/adr/0004-task-mutation-via-generic-update.md → CONTEXT.md
- `Slice Backbone README` --references--> `Slice (tracer-bullet increment)`  [EXTRACTED]
  docs/slices/README.md → CONTEXT.md
- `LifeOS Handoff` --references--> `ADR-0003 CI-gated emulation PWA testing`  [EXTRACTED]
  HANDOFF.md → docs/adr/0003-emulation-pwa-testing.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Slice 1 dispatch flow (deploy tables → A → B)** — slice1_deploy, slice_a_dispatch, slice_b_dispatch [EXTRACTED 0.90]
- **Group C skin slice chain (S11→S12→S13)** — slice_s11_glass_pass, slice_s12_smart_capture, slice_s13_pulse [EXTRACTED 0.90]
- **Task model field-growth sequence** — context_task, context_done_when, context_priority, adr_0004_task_mutation_generic_update [INFERRED 0.85]
- **Telegram bot capture pipeline (text/voice/photo → intent → vault)** — slices_slice_s16_bot_text_create, slices_slice_s17_bot_confirm_edits, slices_slice_s18_bot_voice, slices_slice_s19_bot_photo [EXTRACTED 0.90]
- **Domain → Project → Task vault shape** — slices_slice_s2_done_when_field, slices_slice_s3_priority_field, slices_slice_s4_project_field, slices_slice_s5_domain_field [INFERRED 0.85]
- **NOW + warmth command-center surface** — slices_slice_s6_ranknow, slices_slice_s7_tabbar, slices_slice_s9_computewarmth [INFERRED 0.80]

## Communities (23 total, 4 thin omitted)

### Community 0 - "ADRs & Domain Model"
Cohesion: 0.09
Nodes (37): ADR-0001 PWA over native, Last-write-wins per record, ADR-0002 local-first, sync deferred, ADR-0004 generic update at seam, Domain (entity), done_when field, priority field, Project (entity) (+29 more)

### Community 1 - "React App Shell & Data Layer"
Cohesion: 0.15
Nodes (13): TaskList(), TaskListProps, db, LifeOSDatabase, useTasks(), UseTasksResult, App(), provider (+5 more)

### Community 2 - "Build Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, dexie, framer-motion, react, react-dom, devDependencies, autoprefixer, fake-indexeddb (+19 more)

### Community 3 - "Slice Roadmap (Task Schema)"
Cohesion: 0.10
Nodes (25): Confirm-destructive trust model, Per-chat conversation state (pending confirmation), Claude vision task extraction (batch-confirm), Slice S2 — Task gains done_when, done_when field, Generic add(input) + update(id, patch) seam, Slice S3 — Task gains priority (1–3), priority field (1|2|3) + Dexie v2 index (+17 more)

### Community 4 - "Vault & Telegram Bot"
Cohesion: 0.14
Nodes (19): index.html (PWA entry / manifest link), kanban.html (single-file board UI + data), board-data canonical JSON block, File is both data and UI (one source of truth), serializeTaskLine + round-trip parse, Vault as live source of truth (dashboard ⇄ Obsidian), Slice S15 — Obsidian vault write, VaultSync write methods (toggleDone/add/update/delete) (+11 more)

### Community 5 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 6 - "Task UI Components"
Cohesion: 0.19
Nodes (9): AddTaskInput(), AddTaskInputProps, Priority, PRIORITY_LABELS, PriorityControl(), PriorityControlProps, priorityLabel(), TaskItem() (+1 more)

### Community 7 - "Node TS Config"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 8 - "NPM Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, preview, test, test:e2e, test:pwa-audit, test:watch

### Community 9 - "Lighthouse PWA Audit"
Cohesion: 0.29
Nodes (6): __dirname, DIST, MIME, results, ROOT, server

### Community 10 - "PWA CI Testing"
Cohesion: 0.60
Nodes (5): ADR-0003 CI-gated emulation PWA testing, CI build-test job, Tier 2 Lighthouse PWA installability audit, Tier 1 Playwright PWA tests, CI pwa-e2e job

### Community 11 - "Seed Tasks (basic)"
Cohesion: 0.40
Nodes (4): generated_at, note, projects, version

### Community 13 - "PWA App Icons"
Cohesion: 1.00
Nodes (3): PWA App Icon 192px, PWA App Icon 512px, PWA Maskable App Icon 512px

## Knowledge Gaps
- **84 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+79 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Slice S19 — Telegram bot: photos (vision)` connect `Vault & Telegram Bot` to `Slice Roadmap (Task Schema)`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _90 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ADRs & Domain Model` be split into smaller, more focused modules?**
  _Cohesion score 0.0945945945945946 - nodes in this community are weakly interconnected._
- **Should `React App Shell & Data Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.1477832512315271 - nodes in this community are weakly interconnected._
- **Should `Build Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Slice Roadmap (Task Schema)` be split into smaller, more focused modules?**
  _Cohesion score 0.09666666666666666 - nodes in this community are weakly interconnected._
- **Should `Vault & Telegram Bot` be split into smaller, more focused modules?**
  _Cohesion score 0.14035087719298245 - nodes in this community are weakly interconnected._