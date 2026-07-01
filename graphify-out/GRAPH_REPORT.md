# Graph Report - .  (2026-07-01)

## Corpus Check
- 42 files · ~90,058 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 404 nodes · 704 edges · 27 communities (21 shown, 6 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 51 edges (avg confidence: 0.83)
- Token cost: 51,537 input · 2,000 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Architecture ADRs & NOW View|Architecture ADRs & NOW View]]
- [[_COMMUNITY_Task Input & Priority UI|Task Input & Priority UI]]
- [[_COMMUNITY_Tab Bar, Seed & DB|Tab Bar, Seed & DB]]
- [[_COMMUNITY_Dependencies & Package Config|Dependencies & Package Config]]
- [[_COMMUNITY_VaultSync Implementation & Tests|VaultSync Implementation & Tests]]
- [[_COMMUNITY_DomainsPulseGlass UI|Domains/Pulse/Glass UI]]
- [[_COMMUNITY_Domain Model & Seed ADRs|Domain Model & Seed ADRs]]
- [[_COMMUNITY_Vault Sync Slices & Kanban|Vault Sync Slices & Kanban]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Vault Write Mechanics|Vault Write Mechanics]]
- [[_COMMUNITY_Smart Capture|Smart Capture]]
- [[_COMMUNITY_Node TS Config|Node TS Config]]
- [[_COMMUNITY_PWA Lighthouse Audit|PWA Lighthouse Audit]]
- [[_COMMUNITY_CI PWA Testing|CI PWA Testing]]
- [[_COMMUNITY_Seed Tasks Data|Seed Tasks Data]]
- [[_COMMUNITY_Icon Generation|Icon Generation]]
- [[_COMMUNITY_PWA App Icons|PWA App Icons]]
- [[_COMMUNITY_Detailed Seed Data|Detailed Seed Data]]
- [[_COMMUNITY_Vite Env Types|Vite Env Types]]
- [[_COMMUNITY_Balance Brain|Balance Brain]]
- [[_COMMUNITY_PWA Build Test|PWA Build Test]]
- [[_COMMUNITY_Three Faces Vision|Three Faces Vision]]

## God Nodes (most connected - your core abstractions)
1. `Task` - 48 edges
2. `compilerOptions` - 16 edges
3. `DOMAINS` - 16 edges
4. `LocalOnly` - 13 edges
5. `LifeOS Handoff` - 13 edges
6. `SyncProvider` - 11 edges
7. `Sync seam (SyncProvider)` - 11 edges
8. `isDomain()` - 11 edges
9. `NowView()` - 11 edges
10. `VaultSync` - 11 edges

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
- **Vault-write mutation flow (splice to commit to push)** — adr_0010_vault_write_serializetaskline, adr_0010_vault_write_single_line_splice, adr_0010_vault_write_local_authoritative_commit, adr_0010_vault_write_best_effort_push [EXTRACTED 1.00]
- **VaultTransport adapter pattern** — adr_0010_vault_write_vaulttransport, adr_0010_vault_write_gittransport, adr_0010_vault_write_vaultsync [EXTRACTED 1.00]
- **Task identity evolution (source-map to durable id::)** — adr_0010_vault_write_source_map_identity, adr_0010_vault_write_id_identity, handoff_s16_bot [INFERRED 0.85]

## Communities (27 total, 6 thin omitted)

### Community 0 - "Architecture ADRs & NOW View"
Cohesion: 0.07
Nodes (54): ADR-0001 PWA over native, Last-write-wins per record, ADR-0002 local-first, sync deferred, ADR-0004 generic update at seam, Throwaway Now/All toggle, NOW layout: top-3 live, rest folded, ADR-0007 NOW view dumb brain, App component (+46 more)

### Community 1 - "Task Input & Priority UI"
Cohesion: 0.09
Nodes (27): AddTaskInput(), AddTaskInputProps, PRIORITY_LABEL, FoldSectionProps, NowViewProps, Priority, PriorityControl(), PriorityControlProps (+19 more)

### Community 2 - "Tab Bar, Seed & DB"
Cohesion: 0.09
Nodes (19): TabBar(), TabBarProps, ViewTab, Seed (one-shot import), seedIfEmpty(), db, useTasks(), UseTasksResult (+11 more)

### Community 3 - "Dependencies & Package Config"
Cohesion: 0.05
Nodes (37): dependencies, dexie, framer-motion, isomorphic-git, @isomorphic-git/lightning-fs, react, react-dom, devDependencies (+29 more)

### Community 4 - "VaultSync Implementation & Tests"
Cohesion: 0.09
Nodes (13): SnapshotEntry, FakeTransport, WriteCall, writeFile(), VaultSync, parseTaskLine(), parseVault(), CTX (+5 more)

### Community 5 - "Domains/Pulse/Glass UI"
Cohesion: 0.10
Nodes (24): DomainsMap(), DomainsMapProps, WarmthVisual, GlassElevation, GlassPanel(), GlassPanelProps, SHADOW, PulseView() (+16 more)

### Community 6 - "Domain Model & Seed ADRs"
Cohesion: 0.08
Nodes (31): ADR-0005: Project is an unindexed, denormalized string, ADR-0006: Seed import on empty DB, S4 Deploy Tables, S5 Deploy (Domain + seed), Domain (entity), Project (entity), Confirm-destructive trust model, Per-chat conversation state (pending confirmation) (+23 more)

### Community 7 - "Vault Sync Slices & Kanban"
Cohesion: 0.11
Nodes (23): ADR-0009 Vault Read Transport, ADR-0010 Vault Write, S15 Vault Write Deploy Tables, index.html (PWA entry / manifest link), kanban.html (single-file board UI + data), board-data canonical JSON block, File is both data and UI (one source of truth), Slice S14 Vault Read (+15 more)

### Community 8 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 9 - "Vault Write Mechanics"
Cohesion: 0.17
Nodes (16): Git-as-transport, parseTaskLine, parseVault, Best-effort push, GitTransport, Durable id:: identity, Inbox home, Local-authoritative commit (+8 more)

### Community 10 - "Smart Capture"
Cohesion: 0.36
Nodes (6): fuzzyMatchDomain(), parseCapture(), TaskInput, AddInput, CaptureSheet(), CaptureSheetProps

### Community 11 - "Node TS Config"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 12 - "PWA Lighthouse Audit"
Cohesion: 0.29
Nodes (6): __dirname, DIST, MIME, results, ROOT, server

### Community 13 - "CI PWA Testing"
Cohesion: 0.60
Nodes (5): ADR-0003 CI-gated emulation PWA testing, CI build-test job, Tier 2 Lighthouse PWA installability audit, Tier 1 Playwright PWA tests, CI pwa-e2e job

### Community 14 - "Seed Tasks Data"
Cohesion: 0.40
Nodes (4): generated_at, note, projects, version

### Community 16 - "PWA App Icons"
Cohesion: 1.00
Nodes (3): PWA App Icon 192px, PWA App Icon 512px, PWA Maskable App Icon 512px

## Knowledge Gaps
- **112 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+107 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Task` connect `Task Input & Priority UI` to `Architecture ADRs & NOW View`, `Tab Bar, Seed & DB`, `VaultSync Implementation & Tests`, `Domains/Pulse/Glass UI`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `Task (entity)` connect `Architecture ADRs & NOW View` to `Task Input & Priority UI`, `Domain Model & Seed ADRs`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Task` (e.g. with `Task (entity)` and `domainForProject()`) actually correct?**
  _`Task` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `DOMAINS` (e.g. with `Domain (entity)` and `seedIfEmpty()`) actually correct?**
  _`DOMAINS` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _121 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Architecture ADRs & NOW View` be split into smaller, more focused modules?**
  _Cohesion score 0.06568832983927324 - nodes in this community are weakly interconnected._
- **Should `Task Input & Priority UI` be split into smaller, more focused modules?**
  _Cohesion score 0.09333333333333334 - nodes in this community are weakly interconnected._