---
type: community
cohesion: 0.09
members: 42
---

# Tab Bar, Seed & DB

**Cohesion:** 0.09 - loosely connected
**Members:** 42 nodes

## Members
- [[.delete()]] - code - src/sync/LocalOnly.ts
- [[.list()]] - code - src/sync/LocalOnly.ts
- [[.toggleDone()]] - code - src/sync/LocalOnly.ts
- [[AddIcon()]] - code - src/components/TabBar.tsx
- [[App()]] - code - src/App.tsx
- [[App.tsx]] - code - src/App.tsx
- [[DomainsIcon()]] - code - src/components/TabBar.tsx
- [[LocalOnly]] - code - src/sync/LocalOnly.ts
- [[LocalOnly.ts]] - code - src/sync/LocalOnly.ts
- [[NowIcon()]] - code - src/components/TabBar.tsx
- [[PulseIcon()]] - code - src/components/TabBar.tsx
- [[Seed (one-shot import)]] - concept - CONTEXT.md
- [[SyncProvider]] - code - src/sync/SyncProvider.ts
- [[SyncProvider.ts]] - code - src/sync/SyncProvider.ts
- [[TIME_GRADIENTS]] - code - src/lib/timeOfDay.ts
- [[TIME_SOLID_BG]] - code - src/lib/timeOfDay.ts
- [[TabBar()]] - code - src/components/TabBar.tsx
- [[TabBar.tsx]] - code - src/components/TabBar.tsx
- [[TabBarProps]] - code - src/components/TabBar.tsx
- [[TimeOfDayBucket]] - code - src/lib/timeOfDay.ts
- [[UseTasksResult]] - code - src/hooks/useTasks.ts
- [[ViewTab]] - code - src/components/TabBar.tsx
- [[db]] - code - src/db/LifeOSDb.ts
- [[distinctProjects()]] - code - src/lib/distinctProjects.ts
- [[distinctProjects.ts]] - code - src/lib/distinctProjects.ts
- [[getTimeOfDay()]] - code - src/lib/timeOfDay.ts
- [[main.tsx]] - code - src/main.tsx
- [[makeProvider()_1]] - code - src/test/seed.test.ts
- [[makeProvider()]] - code - src/test/syncProvider.test.ts
- [[makeTask()_2]] - code - src/test/distinctProjects.test.ts
- [[provider]] - code - src/App.tsx
- [[pwa.spec.ts]] - code - e2e/pwa.spec.ts
- [[rootEl]] - code - src/main.tsx
- [[seed.test.ts]] - code - src/test/seed.test.ts
- [[seed.ts]] - code - src/data/seed.ts
- [[seedIfEmpty()]] - code - src/data/seed.ts
- [[timeOfDay.test.ts]] - code - src/lib/timeOfDay.test.ts
- [[timeOfDay.ts]] - code - src/lib/timeOfDay.ts
- [[tsAtHour()]] - code - src/lib/timeOfDay.test.ts
- [[useTasks()]] - code - src/hooks/useTasks.ts
- [[useTasks.ts]] - code - src/hooks/useTasks.ts
- [[useTimeGradient()]] - code - src/App.tsx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Tab_Bar_Seed__DB
SORT file.name ASC
```

## Connections to other communities
- 26 edges to [[_COMMUNITY_Task Input & Priority UI]]
- 4 edges to [[_COMMUNITY_DomainsPulseGlass UI]]
- 3 edges to [[_COMMUNITY_VaultSync Implementation & Tests]]
- 2 edges to [[_COMMUNITY_Smart Capture]]
- 2 edges to [[_COMMUNITY_Architecture ADRs & NOW View]]
- 2 edges to [[_COMMUNITY_Domain Model & Seed ADRs]]

## Top bridge nodes
- [[App.tsx]] - degree 35, connects to 5 communities
- [[SyncProvider]] - degree 11, connects to 2 communities
- [[seedIfEmpty()]] - degree 9, connects to 2 communities
- [[distinctProjects()]] - degree 6, connects to 2 communities
- [[LocalOnly]] - degree 13, connects to 1 community