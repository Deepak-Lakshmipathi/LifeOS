---
type: community
cohesion: 0.08
members: 40
---

# Architecture Decisions & App Shell

**Cohesion:** 0.08 - loosely connected
**Members:** 40 nodes

## Members
- [[ADR-0001 PWA over native]] - rationale - docs/adr/0001-pwa-over-native.md
- [[ADR-0002 local-first, sync deferred]] - rationale - docs/adr/0002-local-first-sync-deferred.md
- [[ADR-0004 generic update at seam]] - rationale - docs/adr/0004-task-mutation-via-generic-update.md
- [[App component]] - code - src/App.tsx
- [[Balance brain (NOW ranking concept)]] - concept - docs/slices/README.md
- [[CI Build Supervisor]] - concept - afk-pipeline-out/slice1-deploy.md
- [[Deploy — Slice S2 done_when]] - document - afk-pipeline-out/s2-done-when-deploy.md
- [[Dispatch — Slice A local-first task loop]] - document - afk-pipeline-out/slice-a-dispatch.md
- [[Dispatch — Slice B PWA shell]] - document - afk-pipeline-out/slice-b-dispatch.md
- [[Dual-green merge gate]] - rationale - HANDOFF.md
- [[GlassPanel design system primitive]] - concept - docs/slices/slice-S11-glass-pass.md
- [[Last-write-wins per record]] - rationale - docs/adr/0002-local-first-sync-deferred.md
- [[LifeOS Architecture Report]] - document - architecture-report.html
- [[LifeOS Handoff]] - document - HANDOFF.md
- [[LifeOS Kanban Board]] - document - kanban.html
- [[LifeOS Slice 1 Deploy Tables]] - document - afk-pipeline-out/slice1-deploy.md
- [[Obsidian vault as source of truth]] - concept - docs/slices/README.md
- [[PWA Playwright e2e suite]] - code - e2e/pwa.spec.ts
- [[Product vision one vault, three faces]] - rationale - docs/slices/README.md
- [[Pulse derived metrics]] - concept - docs/slices/slice-S13-pulse.md
- [[Rescue task (coldest domain injection)]] - concept - docs/slices/slice-S10-balance-brain.md
- [[Slice (tracer-bullet increment)]] - concept - CONTEXT.md
- [[Slice Backbone README]] - document - docs/slices/README.md
- [[Slice S10 — Balance brain v1]] - document - docs/slices/slice-S10-balance-brain.md
- [[Slice S11 — Glass  depth visual pass]] - document - docs/slices/slice-S11-glass-pass.md
- [[Slice S12 — Smart capture]] - document - docs/slices/slice-S12-smart-capture.md
- [[Slice S13 — Pulse tab (light)]] - document - docs/slices/slice-S13-pulse.md
- [[Slice S14 — Obsidian vault read (VaultSync)]] - document - docs/slices/slice-S14-vault-read.md
- [[Slice S4 — project field (next)]] - concept - HANDOFF.md
- [[Sync seam (SyncProvider)]] - concept - CONTEXT.md
- [[Tab bar navigation (S7)]] - concept - HANDOFF.md
- [[Throwaway NowAll toggle]] - rationale - docs/adr/0007-now-view-dumb-brain.md
- [[Vault transport decision (bridgeFSAgit)]] - rationale - docs/slices/slice-S14-vault-read.md
- [[VaultSync provider]] - concept - docs/slices/slice-S14-vault-read.md
- [[Warmth (derived domain heat)]] - concept - docs/slices/README.md
- [[afk-pipeline ship workflow]] - rationale - HANDOFF.md
- [[done_when field]] - concept - CONTEXT.md
- [[parseCapture shorthand parser]] - concept - docs/slices/slice-S12-smart-capture.md
- [[parseVault markdown parser]] - concept - docs/slices/slice-S14-vault-read.md
- [[rankNow balance algorithm]] - concept - docs/slices/slice-S10-balance-brain.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Architecture_Decisions__App_Shell
SORT file.name ASC
```

## Connections to other communities
- 7 edges to [[_COMMUNITY_NOW View (dumb brain)]]
- 2 edges to [[_COMMUNITY_DomainProject Model & Seed Decisions]]
- 1 edge to [[_COMMUNITY_Seed Import & Task Hook]]
- 1 edge to [[_COMMUNITY_CI & PWA Testing Gates]]

## Top bridge nodes
- [[LifeOS Handoff]] - degree 13, connects to 3 communities
- [[Sync seam (SyncProvider)]] - degree 11, connects to 2 communities
- [[ADR-0004 generic update at seam]] - degree 7, connects to 1 community
- [[Dispatch — Slice A local-first task loop]] - degree 6, connects to 1 community
- [[Slice (tracer-bullet increment)]] - degree 4, connects to 1 community