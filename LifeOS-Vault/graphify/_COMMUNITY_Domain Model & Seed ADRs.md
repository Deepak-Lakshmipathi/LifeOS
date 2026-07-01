---
type: community
cohesion: 0.08
members: 31
---

# Domain Model & Seed ADRs

**Cohesion:** 0.08 - loosely connected
**Members:** 31 nodes

## Members
- [[ADR-0005 Project is an unindexed, denormalized string]] - rationale - docs/adr/0005-project-unindexed-denormalized-string.md
- [[ADR-0006 Seed import on empty DB]] - rationale - docs/adr/0006-seed-import-on-empty-db.md
- [[Claude vision task extraction (batch-confirm)]] - concept - docs/slices/slice-S19-bot-photo.md
- [[Confirm-destructive trust model]] - rationale - docs/slices/slice-S17-bot-confirm-edits.md
- [[Domain (entity)]] - concept - CONTEXT.md
- [[Domain color palette constant]] - concept - docs/slices/slice-S5-domain-and-seed.md
- [[DomainsMap warmth tiles]] - concept - docs/slices/slice-S9-warmth.md
- [[Generic add(input) + update(id, patch) seam]] - rationale - docs/slices/slice-S2-done-when.md
- [[Idempotent seed importer (seed_tasks_detailed.json)]] - concept - docs/slices/slice-S5-domain-and-seed.md
- [[NowView component]] - concept - docs/slices/slice-S6-now-view.md
- [[Per-chat conversation state (pending confirmation)]] - concept - docs/slices/slice-S17-bot-confirm-edits.md
- [[Project (entity)]] - concept - CONTEXT.md
- [[S4 Deploy Tables]] - document - afk-pipeline-out/s4-project-deploy.md
- [[S5 Deploy (Domain + seed)]] - document - afk-pipeline-out/s5-domain-and-seed-deploy.md
- [[Slice S2 — Task gains done_when]] - document - docs/slices/slice-S2-done-when.md
- [[Slice S3 — Task gains priority (1–3)]] - document - docs/slices/slice-S3-priority.md
- [[Slice S4 — Task belongs to a Project]] - document - docs/slices/slice-S4-project.md
- [[Slice S5 — Domains + seed the vault shape]] - document - docs/slices/slice-S5-domain-and-seed.md
- [[Slice S6 — NOW view (dumb brain)]] - document - docs/slices/slice-S6-now-view.md
- [[Slice S7 — Tab bar navigation]] - document - docs/slices/slice-S7-tab-bar.md
- [[Slice S8 — Tap-the-dot complete + undo]] - document - docs/slices/slice-S8-tap-dot-complete.md
- [[Slice S9 — Domain warmth (derived) + Domains map]] - document - docs/slices/slice-S9-warmth.md
- [[TabBar (NowDomainsPulse+)]] - concept - docs/slices/slice-S7-tab-bar.md
- [[Tap-dot completion animation + UndoToast]] - concept - docs/slices/slice-S8-tap-dot-complete.md
- [[Warmth is derived, never logged]] - rationale - docs/slices/slice-S9-warmth.md
- [[computeWarmth(tasks, now) + completed_at]] - concept - docs/slices/slice-S9-warmth.md
- [[domain field (7 domains) + Domain→Project→Task shape]] - concept - docs/slices/slice-S5-domain-and-seed.md
- [[done_when field_1]] - concept - docs/slices/slice-S2-done-when.md
- [[priority field (123) + Dexie v2 index]] - concept - docs/slices/slice-S3-priority.md
- [[project field (denormalized string) + groupByProject]] - concept - docs/slices/slice-S4-project.md
- [[rankNow(tasks) pure ranking helper]] - concept - docs/slices/slice-S6-now-view.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Domain_Model__Seed_ADRs
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_Architecture ADRs & NOW View]]
- 2 edges to [[_COMMUNITY_Tab Bar, Seed & DB]]
- 1 edge to [[_COMMUNITY_Task Input & Priority UI]]
- 1 edge to [[_COMMUNITY_Vault Sync Slices & Kanban]]

## Top bridge nodes
- [[ADR-0005 Project is an unindexed, denormalized string]] - degree 6, connects to 2 communities
- [[ADR-0006 Seed import on empty DB]] - degree 5, connects to 2 communities
- [[Domain (entity)]] - degree 4, connects to 2 communities
- [[Project (entity)]] - degree 4, connects to 1 community
- [[Claude vision task extraction (batch-confirm)]] - degree 2, connects to 1 community