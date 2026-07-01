---
type: community
cohesion: 0.07
members: 54
---

# Architecture ADRs & NOW View

**Cohesion:** 0.07 - loosely connected
**Members:** 54 nodes

## Members
- [[ADR-0001 PWA over native]] - rationale - docs/adr/0001-pwa-over-native.md
- [[ADR-0002 local-first, sync deferred]] - rationale - docs/adr/0002-local-first-sync-deferred.md
- [[ADR-0004 generic update at seam]] - rationale - docs/adr/0004-task-mutation-via-generic-update.md
- [[ADR-0007 NOW view dumb brain]] - document - docs/adr/0007-now-view-dumb-brain.md
- [[App component]] - code - src/App.tsx
- [[Balance brain (NOW ranking concept)]] - concept - docs/slices/README.md
- [[Balance brain (S10)]] - concept - CONTEXT.md
- [[CI Build Supervisor]] - concept - afk-pipeline-out/slice1-deploy.md
- [[Deploy — Slice S2 done_when]] - document - afk-pipeline-out/s2-done-when-deploy.md
- [[Dispatch — Slice A local-first task loop]] - document - afk-pipeline-out/slice-a-dispatch.md
- [[Dispatch — Slice B PWA shell]] - document - afk-pipeline-out/slice-b-dispatch.md
- [[Domain warmth  computeWarmth (S9)]] - concept - HANDOFF.md
- [[Dual-green merge gate]] - rationale - HANDOFF.md
- [[Dumb brain (pure priority NOW)]] - rationale - CONTEXT.md
- [[FoldSection()]] - code - src/components/NowView.tsx
- [[GlassPanel design system primitive]] - concept - docs/slices/slice-S11-glass-pass.md
- [[Last-write-wins per record]] - rationale - docs/adr/0002-local-first-sync-deferred.md
- [[LifeOS Architecture Report]] - document - architecture-report.html
- [[LifeOS Handoff]] - document - HANDOFF.md
- [[LifeOS Kanban Board]] - document - kanban.html
- [[LifeOS Slice 1 Deploy Tables]] - document - afk-pipeline-out/slice1-deploy.md
- [[NOW (command-center surface)]] - concept - CONTEXT.md
- [[NOW layout top-3 live, rest folded]] - rationale - docs/adr/0007-now-view-dumb-brain.md
- [[NowView()]] - code - src/components/NowView.tsx
- [[Obsidian vault as source of truth]] - concept - docs/slices/README.md
- [[PWA Playwright e2e suite]] - code - e2e/pwa.spec.ts
- [[Product vision one vault, three faces]] - rationale - docs/slices/README.md
- [[Pulse derived metrics]] - concept - docs/slices/slice-S13-pulse.md
- [[Rescue task (coldest domain injection)]] - concept - docs/slices/slice-S10-balance-brain.md
- [[S6 NOW view deploy tables]] - document - afk-pipeline-out/s6-now-view-deploy.md
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
- [[Task (entity)]] - concept - CONTEXT.md
- [[Throwaway NowAll toggle]] - rationale - docs/adr/0007-now-view-dumb-brain.md
- [[Vault transport decision (bridgeFSAgit)]] - rationale - docs/slices/slice-S14-vault-read.md
- [[VaultSync provider]] - concept - docs/slices/slice-S14-vault-read.md
- [[Warmth (derived domain heat)]] - concept - docs/slices/README.md
- [[afk-pipeline ship workflow]] - rationale - HANDOFF.md
- [[done_when field]] - concept - CONTEXT.md
- [[parseCapture shorthand parser]] - concept - docs/slices/slice-S12-smart-capture.md
- [[parseVault markdown parser]] - concept - docs/slices/slice-S14-vault-read.md
- [[priority field]] - concept - CONTEXT.md
- [[rankNow balance algorithm]] - concept - docs/slices/slice-S10-balance-brain.md
- [[rankNow ranking function]] - concept - CONTEXT.md
- [[rankNow unit tests]] - code - src/now/rankNow.test.ts
- [[rankNow()]] - code - src/now/rankNow.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Architecture_ADRs__NOW_View
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_Task Input & Priority UI]]
- 4 edges to [[_COMMUNITY_Domain Model & Seed ADRs]]
- 2 edges to [[_COMMUNITY_Tab Bar, Seed & DB]]
- 2 edges to [[_COMMUNITY_DomainsPulseGlass UI]]
- 1 edge to [[_COMMUNITY_CI PWA Testing]]

## Top bridge nodes
- [[NowView()]] - degree 11, connects to 3 communities
- [[LifeOS Handoff]] - degree 13, connects to 2 communities
- [[Task (entity)]] - degree 10, connects to 2 communities
- [[rankNow()]] - degree 10, connects to 2 communities
- [[Sync seam (SyncProvider)]] - degree 11, connects to 1 community