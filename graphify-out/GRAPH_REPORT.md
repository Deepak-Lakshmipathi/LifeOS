# Graph Report - .  (2026-06-29)

## Corpus Check
- 31 files · ~48,027 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 255 nodes · 395 edges · 22 communities (18 shown, 4 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.81)
- Token cost: 91,130 input · 4,000 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Task UI Components|Task UI Components]]
- [[_COMMUNITY_ADRs & Architecture Spine|ADRs & Architecture Spine]]
- [[_COMMUNITY_Slice Roadmap & Domain Model|Slice Roadmap & Domain Model]]
- [[_COMMUNITY_Data Layer & Seed Import|Data Layer & Seed Import]]
- [[_COMMUNITY_Vault & Telegram Bot|Vault & Telegram Bot]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_Dev Dependencies & Tooling|Dev Dependencies & Tooling]]
- [[_COMMUNITY_Node TS Config|Node TS Config]]
- [[_COMMUNITY_Lighthouse PWA Audit|Lighthouse PWA Audit]]
- [[_COMMUNITY_PWA CI Testing|PWA CI Testing]]
- [[_COMMUNITY_Seed Tasks (basic)|Seed Tasks (basic)]]
- [[_COMMUNITY_Icon Generation|Icon Generation]]
- [[_COMMUNITY_PWA App Icons|PWA App Icons]]
- [[_COMMUNITY_Seed Tasks (detailed)|Seed Tasks (detailed)]]
- [[_COMMUNITY_PWA Build Test|PWA Build Test]]
- [[_COMMUNITY_Three-Faces Vision|Three-Faces Vision]]

## God Nodes (most connected - your core abstractions)
1. `Task` - 26 edges
2. `compilerOptions` - 16 edges
3. `LocalOnly` - 13 edges
4. `Sync seam (SyncProvider)` - 11 edges
5. `SyncProvider` - 10 edges
6. `LifeOS Handoff` - 10 edges
7. `Slice Backbone README` - 10 edges
8. `DOMAINS` - 9 edges
9. `seedIfEmpty()` - 9 edges
10. `scripts` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Sync seam (SyncProvider)` --references--> `SyncProvider`  [INFERRED]
  CONTEXT.md → src/sync/SyncProvider.ts
- `Task (entity)` --references--> `Task`  [INFERRED]
  CONTEXT.md → src/types/index.ts
- `Domain (entity)` --references--> `DOMAINS`  [INFERRED]
  CONTEXT.md → src/data/domains.ts
- `Seed (one-shot import)` --references--> `seedIfEmpty()`  [INFERRED]
  CONTEXT.md → src/data/seed.ts
- `ADR-0005: Project is an unindexed, denormalized string` --rationale_for--> `distinctProjects()`  [INFERRED]
  docs/adr/0005-project-unindexed-denormalized-string.md → src/lib/distinctProjects.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Group A Task field-growth (done_when, priority, project, domain)** — context_done_when, context_priority, context_project, context_domain [INFERRED 0.85]
- **Denormalized unindexed-string field pattern** — context_project, context_domain, adr_0005_project_unindexed_denormalized_string, adr_0006_seed_import_on_empty_db [INFERRED 0.80]
- **Nested Domain to Project to Task grouping/render flow** — lib_groupbydomain_groupbydomain, lib_groupbyproject_groupbyproject, components_tasklist_tasklist [INFERRED 0.85]

## Communities (22 total, 4 thin omitted)

### Community 0 - "Task UI Components"
Cohesion: 0.12
Nodes (21): AddTaskInput(), AddTaskInputProps, Priority, PriorityControl(), PriorityControlProps, priorityLabel(), TaskItem(), TaskItemProps (+13 more)

### Community 1 - "ADRs & Architecture Spine"
Cohesion: 0.09
Nodes (37): ADR-0001 PWA over native, Last-write-wins per record, ADR-0002 local-first, sync deferred, ADR-0004 generic update at seam, LifeOS Architecture Report, done_when field, priority field, Slice (tracer-bullet increment) (+29 more)

### Community 2 - "Slice Roadmap & Domain Model"
Cohesion: 0.08
Nodes (31): ADR-0005: Project is an unindexed, denormalized string, ADR-0006: Seed import on empty DB, S4 Deploy Tables, S5 Deploy (Domain + seed), Domain (entity), Project (entity), Confirm-destructive trust model, Per-chat conversation state (pending confirmation) (+23 more)

### Community 3 - "Data Layer & Seed Import"
Cohesion: 0.14
Nodes (13): Seed (one-shot import), isDomain(), seedIfEmpty(), db, useTasks(), UseTasksResult, distinctProjects(), App() (+5 more)

### Community 4 - "Vault & Telegram Bot"
Cohesion: 0.14
Nodes (19): index.html (PWA entry / manifest link), kanban.html (single-file board UI + data), board-data canonical JSON block, File is both data and UI (one source of truth), serializeTaskLine + round-trip parse, Vault as live source of truth (dashboard ⇄ Obsidian), Slice S15 — Obsidian vault write, VaultSync write methods (toggleDone/add/update/delete) (+11 more)

### Community 5 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 6 - "Runtime Dependencies"
Cohesion: 0.11
Nodes (17): dependencies, dexie, framer-motion, react, react-dom, name, private, scripts (+9 more)

### Community 7 - "Dev Dependencies & Tooling"
Cohesion: 0.11
Nodes (18): devDependencies, autoprefixer, fake-indexeddb, jsdom, lighthouse, @playwright/test, postcss, tailwindcss (+10 more)

### Community 8 - "Node TS Config"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

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
- **88 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+83 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Task` connect `Task UI Components` to `ADRs & Architecture Spine`, `Data Layer & Seed Import`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Task` (e.g. with `Task (entity)` and `domainForProject()`) actually correct?**
  _`Task` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `Sync seam (SyncProvider)` (e.g. with `LifeOS Architecture Report` and `SyncProvider`) actually correct?**
  _`Sync seam (SyncProvider)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _94 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Task UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.12010796221322537 - nodes in this community are weakly interconnected._
- **Should `ADRs & Architecture Spine` be split into smaller, more focused modules?**
  _Cohesion score 0.0945945945945946 - nodes in this community are weakly interconnected._
- **Should `Slice Roadmap & Domain Model` be split into smaller, more focused modules?**
  _Cohesion score 0.08172043010752689 - nodes in this community are weakly interconnected._