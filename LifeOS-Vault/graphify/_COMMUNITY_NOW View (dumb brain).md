---
type: community
cohesion: 0.18
members: 19
---

# NOW View (dumb brain)

**Cohesion:** 0.18 - loosely connected
**Members:** 19 nodes

## Members
- [[ADR-0007 NOW view dumb brain]] - document - docs/adr/0007-now-view-dumb-brain.md
- [[Balance brain (S10)]] - concept - CONTEXT.md
- [[Domain warmth  computeWarmth (S9)]] - concept - HANDOFF.md
- [[Dumb brain (pure priority NOW)]] - rationale - CONTEXT.md
- [[FoldSection()]] - code - src/components/NowView.tsx
- [[FoldSectionProps]] - code - src/components/NowView.tsx
- [[NOW (command-center surface)]] - concept - CONTEXT.md
- [[NOW layout top-3 live, rest folded]] - rationale - docs/adr/0007-now-view-dumb-brain.md
- [[NowView()]] - code - src/components/NowView.tsx
- [[NowView.tsx]] - code - src/components/NowView.tsx
- [[NowViewProps]] - code - src/components/NowView.tsx
- [[S6 NOW view deploy tables]] - document - afk-pipeline-out/s6-now-view-deploy.md
- [[Task (entity)]] - concept - CONTEXT.md
- [[priority field]] - concept - CONTEXT.md
- [[rankNow ranking function]] - concept - CONTEXT.md
- [[rankNow unit tests]] - code - src/now/rankNow.test.ts
- [[rankNow()]] - code - src/now/rankNow.ts
- [[rankNow.ts]] - code - src/now/rankNow.ts
- [[task()]] - code - src/now/rankNow.test.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/NOW_View_dumb_brain
SORT file.name ASC
```

## Connections to other communities
- 7 edges to [[_COMMUNITY_Architecture Decisions & App Shell]]
- 4 edges to [[_COMMUNITY_Task Input & Priority UI]]
- 2 edges to [[_COMMUNITY_Seed Import & Task Hook]]
- 2 edges to [[_COMMUNITY_DomainProject Model & Seed Decisions]]

## Top bridge nodes
- [[Task (entity)]] - degree 10, connects to 3 communities
- [[NowView()]] - degree 10, connects to 2 communities
- [[NowView.tsx]] - degree 9, connects to 2 communities
- [[Dumb brain (pure priority NOW)]] - degree 4, connects to 1 community
- [[NOW (command-center surface)]] - degree 4, connects to 1 community