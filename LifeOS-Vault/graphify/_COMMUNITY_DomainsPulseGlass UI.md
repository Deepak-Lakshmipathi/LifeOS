---
type: community
cohesion: 0.10
members: 35
---

# Domains/Pulse/Glass UI

**Cohesion:** 0.10 - loosely connected
**Members:** 35 nodes

## Members
- [[Domain]] - code - src/data/domains.ts
- [[DomainsMap()]] - code - src/components/DomainsMap.tsx
- [[DomainsMap.tsx]] - code - src/components/DomainsMap.tsx
- [[DomainsMapProps]] - code - src/components/DomainsMap.tsx
- [[GlassElevation]] - code - src/components/GlassPanel.tsx
- [[GlassPanel()]] - code - src/components/GlassPanel.tsx
- [[GlassPanel.tsx]] - code - src/components/GlassPanel.tsx
- [[GlassPanelProps]] - code - src/components/GlassPanel.tsx
- [[NOW]] - code - src/pulse/metrics.test.ts
- [[NOW_1]] - code - src/warmth/computeWarmth.test.ts
- [[PulseView()]] - code - src/components/PulseView.tsx
- [[PulseView.tsx]] - code - src/components/PulseView.tsx
- [[PulseViewProps]] - code - src/components/PulseView.tsx
- [[RESCUE_ELIGIBLE_STATES]] - code - src/now/rankNow.ts
- [[RankNowOpts]] - code - src/now/rankNow.ts
- [[SHADOW]] - code - src/components/GlassPanel.tsx
- [[WARMTH_BADGE]] - code - src/components/PulseView.tsx
- [[WARMTH_ORDER]] - code - src/components/PulseView.tsx
- [[WARMTH_RANK]] - code - src/now/rankNow.ts
- [[WARMTH_THRESHOLDS]] - code - src/warmth/computeWarmth.ts
- [[WarmthState]] - code - src/warmth/computeWarmth.ts
- [[WarmthVisual]] - code - src/components/DomainsMap.tsx
- [[allWarm()]] - code - src/now/rankNow.test.ts
- [[completionsByDay()]] - code - src/pulse/metrics.ts
- [[computeWarmth()]] - code - src/warmth/computeWarmth.ts
- [[computeWarmth.test.ts]] - code - src/warmth/computeWarmth.test.ts
- [[computeWarmth.ts]] - code - src/warmth/computeWarmth.ts
- [[doneThisWeek()]] - code - src/pulse/metrics.ts
- [[metrics.test.ts]] - code - src/pulse/metrics.test.ts
- [[metrics.ts]] - code - src/pulse/metrics.ts
- [[rankNow.ts]] - code - src/now/rankNow.ts
- [[task()]] - code - src/now/rankNow.test.ts
- [[task()_1]] - code - src/pulse/metrics.test.ts
- [[task()_2]] - code - src/warmth/computeWarmth.test.ts
- [[warmthWith()]] - code - src/now/rankNow.test.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Domains/Pulse/Glass_UI
SORT file.name ASC
```

## Connections to other communities
- 30 edges to [[_COMMUNITY_Task Input & Priority UI]]
- 4 edges to [[_COMMUNITY_Tab Bar, Seed & DB]]
- 2 edges to [[_COMMUNITY_Architecture ADRs & NOW View]]

## Top bridge nodes
- [[PulseView.tsx]] - degree 17, connects to 2 communities
- [[rankNow.ts]] - degree 16, connects to 2 communities
- [[DomainsMap.tsx]] - degree 15, connects to 2 communities
- [[computeWarmth()]] - degree 8, connects to 2 communities
- [[computeWarmth.ts]] - degree 12, connects to 1 community