---
type: community
members: 37
---

# ADRs & Domain Model

**Members:** 37 nodes

## Members
- [[ADR-0001 PWA over native]] - rationale - docs/adr/0001-pwa-over-native.md
- [[ADR-0002 local-first, sync deferred]] - rationale - docs/adr/0002-local-first-sync-deferred.md
- [[ADR-0004 generic update at seam]] - rationale - docs/adr/0004-task-mutation-via-generic-update.md
- [[Balance brain (NOW ranking concept)]] - concept - docs/slices/README.md
- [[CI Build Supervisor]] - concept - afk-pipeline-out/slice1-deploy.md
- [[Deploy — Slice S2 done_when]] - document - afk-pipeline-out/s2-done-when-deploy.md
- [[Dispatch — Slice A local-first task loop]] - document - afk-pipeline-out/slice-a-dispatch.md
- [[Dispatch — Slice B PWA shell]] - document - afk-pipeline-out/slice-b-dispatch.md
- [[Domain (entity)]] - concept - CONTEXT.md
- [[GlassPanel design system primitive]] - concept - docs/slices/slice-S11-glass-pass.md
- [[Last-write-wins per record]] - rationale - docs/adr/0002-local-first-sync-deferred.md
- [[LifeOS Handoff]] - document - HANDOFF.md
- [[LifeOS Slice 1 Deploy Tables]] - document - afk-pipeline-out/slice1-deploy.md
- [[Obsidian vault as source of truth]] - concept - docs/slices/README.md
- [[Product vision one vault, three faces]] - rationale - docs/slices/README.md
- [[Project (entity)]] - concept - CONTEXT.md
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
- [[Task (entity)]] - concept - CONTEXT.md
- [[Vault transport decision (bridgeFSAgit)]] - rationale - docs/slices/slice-S14-vault-read.md
- [[VaultSync provider]] - concept - docs/slices/slice-S14-vault-read.md
- [[Warmth (derived domain heat)]] - concept - docs/slices/README.md
- [[afk-pipeline ship workflow]] - rationale - HANDOFF.md
- [[done_when field]] - concept - CONTEXT.md
- [[parseCapture shorthand parser]] - concept - docs/slices/slice-S12-smart-capture.md
- [[parseVault markdown parser]] - concept - docs/slices/slice-S14-vault-read.md
- [[priority field]] - concept - CONTEXT.md
- [[rankNow balance algorithm]] - concept - docs/slices/slice-S10-balance-brain.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/ADRs__Domain_Model
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_PWA CI Testing]]

## Top bridge nodes
- [[LifeOS Handoff]] - degree 8, connects to 1 community