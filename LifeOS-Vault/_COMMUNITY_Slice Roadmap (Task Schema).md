---
type: community
members: 25
---

# Slice Roadmap (Task Schema)

**Members:** 25 nodes

## Members
- [[Claude vision task extraction (batch-confirm)]] - concept - docs/slices/slice-S19-bot-photo.md
- [[Confirm-destructive trust model]] - rationale - docs/slices/slice-S17-bot-confirm-edits.md
- [[Domain color palette constant]] - concept - docs/slices/slice-S5-domain-and-seed.md
- [[DomainsMap warmth tiles]] - concept - docs/slices/slice-S9-warmth.md
- [[Generic add(input) + update(id, patch) seam]] - rationale - docs/slices/slice-S2-done-when.md
- [[Idempotent seed importer (seed_tasks_detailed.json)]] - concept - docs/slices/slice-S5-domain-and-seed.md
- [[NowView component]] - concept - docs/slices/slice-S6-now-view.md
- [[Per-chat conversation state (pending confirmation)]] - concept - docs/slices/slice-S17-bot-confirm-edits.md
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
TABLE source_file, type FROM #community/Slice_Roadmap_Task_Schema
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_Vault & Telegram Bot]]

## Top bridge nodes
- [[Claude vision task extraction (batch-confirm)]] - degree 2, connects to 1 community