# Graph Report - .  (2026-06-29)

## Corpus Check
- 10 files · ~50,551 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 277 nodes · 440 edges · 22 communities (18 shown, 4 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Task Input & Priority UI|Task Input & Priority UI]]
- [[_COMMUNITY_Architecture Decisions & App Shell|Architecture Decisions & App Shell]]
- [[_COMMUNITY_Dependencies & Build Config|Dependencies & Build Config]]
- [[_COMMUNITY_DomainProject Model & Seed Decisions|Domain/Project Model & Seed Decisions]]
- [[_COMMUNITY_Seed Import & Task Hook|Seed Import & Task Hook]]
- [[_COMMUNITY_Kanban Board & Vault Sync|Kanban Board & Vault Sync]]
- [[_COMMUNITY_NOW View (dumb brain)|NOW View (dumb brain)]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Node TS Config|Node TS Config]]
- [[_COMMUNITY_PWA Installability Audit|PWA Installability Audit]]
- [[_COMMUNITY_CI & PWA Testing Gates|CI & PWA Testing Gates]]
- [[_COMMUNITY_Seed Data (basic)|Seed Data (basic)]]
- [[_COMMUNITY_PWA Icon Generation|PWA Icon Generation]]
- [[_COMMUNITY_PWA App Icons|PWA App Icons]]
- [[_COMMUNITY_Detailed Seed Data|Detailed Seed Data]]
- [[_COMMUNITY_PWA Build Test|PWA Build Test]]
- [[_COMMUNITY_Three-Faces Vision|Three-Faces Vision]]

## God Nodes (most connected - your core abstractions)
1. `Task` - 28 edges
2. `compilerOptions` - 16 edges
3. `LocalOnly` - 13 edges
4. `LifeOS Handoff` - 13 edges
5. `Sync seam (SyncProvider)` - 11 edges
6. `SyncProvider` - 10 edges
7. `Task (entity)` - 10 edges
8. `Slice Backbone README` - 10 edges
9. `NowView()` - 10 edges
10. `rankNow()` - 10 edges

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
- **NOW ranking flow (App -> NowView -> rankNow)** — app_app, components_nowview_nowview, now_ranknow_ranknow [EXTRACTED 1.00]
- **S6 dumb-brain NOW design decision** — adr_0007_now_view_dumb_brain, context_dumb_brain, now_ranknow_ranknow, components_nowview_nowview [INFERRED 0.85]

## Communities (22 total, 4 thin omitted)

### Community 0 - "Task Input & Priority UI"
Cohesion: 0.11
Nodes (23): AddTaskInput(), AddTaskInputProps, Priority, PriorityControl(), PriorityControlProps, priorityLabel(), TaskItem(), TaskItemProps (+15 more)

### Community 1 - "Architecture Decisions & App Shell"
Cohesion: 0.08
Nodes (40): ADR-0001 PWA over native, Last-write-wins per record, ADR-0002 local-first, sync deferred, ADR-0004 generic update at seam, Throwaway Now/All toggle, App component, LifeOS Architecture Report, done_when field (+32 more)

### Community 2 - "Dependencies & Build Config"
Cohesion: 0.06
Nodes (35): dependencies, dexie, framer-motion, react, react-dom, devDependencies, autoprefixer, fake-indexeddb (+27 more)

### Community 3 - "Domain/Project Model & Seed Decisions"
Cohesion: 0.09
Nodes (30): ADR-0005: Project is an unindexed, denormalized string, ADR-0006: Seed import on empty DB, S4 Deploy Tables, S5 Deploy (Domain + seed), Domain (entity), Project (entity), Confirm-destructive trust model, Per-chat conversation state (pending confirmation) (+22 more)

### Community 4 - "Seed Import & Task Hook"
Cohesion: 0.15
Nodes (11): Seed (one-shot import), seedIfEmpty(), db, useTasks(), UseTasksResult, distinctProjects(), App(), provider (+3 more)

### Community 5 - "Kanban Board & Vault Sync"
Cohesion: 0.13
Nodes (20): index.html (PWA entry / manifest link), kanban.html (single-file board UI + data), board-data canonical JSON block, File is both data and UI (one source of truth), serializeTaskLine + round-trip parse, Vault as live source of truth (dashboard ⇄ Obsidian), Slice S15 — Obsidian vault write, VaultSync write methods (toggleDone/add/update/delete) (+12 more)

### Community 6 - "NOW View (dumb brain)"
Cohesion: 0.18
Nodes (16): NOW layout: top-3 live, rest folded, ADR-0007 NOW view dumb brain, FoldSection(), FoldSectionProps, NowView(), NowViewProps, Balance brain (S10), Dumb brain (pure priority NOW) (+8 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 8 - "Node TS Config"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 9 - "PWA Installability Audit"
Cohesion: 0.29
Nodes (6): __dirname, DIST, MIME, results, ROOT, server

### Community 10 - "CI & PWA Testing Gates"
Cohesion: 0.60
Nodes (5): ADR-0003 CI-gated emulation PWA testing, CI build-test job, Tier 2 Lighthouse PWA installability audit, Tier 1 Playwright PWA tests, CI pwa-e2e job

### Community 11 - "Seed Data (basic)"
Cohesion: 0.40
Nodes (4): generated_at, note, projects, version

### Community 13 - "PWA App Icons"
Cohesion: 1.00
Nodes (3): PWA App Icon 192px, PWA App Icon 512px, PWA Maskable App Icon 512px

## Knowledge Gaps
- **91 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+86 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Task (entity)` connect `NOW View (dumb brain)` to `Task Input & Priority UI`, `Architecture Decisions & App Shell`, `Domain/Project Model & Seed Decisions`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `Task` connect `Task Input & Priority UI` to `Seed Import & Task Hook`, `NOW View (dumb brain)`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Task` (e.g. with `Task (entity)` and `domainForProject()`) actually correct?**
  _`Task` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _98 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Task Input & Priority UI` be split into smaller, more focused modules?**
  _Cohesion score 0.10963455149501661 - nodes in this community are weakly interconnected._
- **Should `Architecture Decisions & App Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.08205128205128205 - nodes in this community are weakly interconnected._
- **Should `Dependencies & Build Config` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._