---
type: community
cohesion: 0.09
members: 51
---

# Task Input & Priority UI

**Cohesion:** 0.09 - loosely connected
**Members:** 51 nodes

## Members
- [[.add()]] - code - src/sync/LocalOnly.ts
- [[.constructor()]] - code - src/db/LifeOSDb.ts
- [[.update()]] - code - src/sync/LocalOnly.ts
- [[AddTaskInput()]] - code - src/components/AddTaskInput.tsx
- [[AddTaskInput.tsx]] - code - src/components/AddTaskInput.tsx
- [[AddTaskInputProps]] - code - src/components/AddTaskInput.tsx
- [[DOMAINS]] - code - src/data/domains.ts
- [[DOMAIN_COLORS]] - code - src/data/domains.ts
- [[DomainGroup]] - code - src/lib/groupByDomain.ts
- [[FoldSectionProps]] - code - src/components/NowView.tsx
- [[Inbox (derived group)]] - concept - CONTEXT.md
- [[LifeOSDatabase]] - code - src/db/LifeOSDb.ts
- [[LifeOSDb.ts]] - code - src/db/LifeOSDb.ts
- [[NowView.tsx]] - code - src/components/NowView.tsx
- [[NowViewProps]] - code - src/components/NowView.tsx
- [[PRIORITY_LABEL]] - code - src/components/CaptureSheet.tsx
- [[Priority]] - code - src/components/PriorityControl.tsx
- [[PriorityControl()]] - code - src/components/PriorityControl.tsx
- [[PriorityControl.tsx]] - code - src/components/PriorityControl.tsx
- [[PriorityControlProps]] - code - src/components/PriorityControl.tsx
- [[ProjectGroup]] - code - src/lib/groupByProject.ts
- [[RankedTask]] - code - src/now/rankNow.ts
- [[Task]] - code - src/types/index.ts
- [[TaskItem()]] - code - src/components/TaskItem.tsx
- [[TaskItem.tsx]] - code - src/components/TaskItem.tsx
- [[TaskItemProps]] - code - src/components/TaskItem.tsx
- [[TaskList()]] - code - src/components/TaskList.tsx
- [[TaskList.tsx]] - code - src/components/TaskList.tsx
- [[TaskListProps]] - code - src/components/TaskList.tsx
- [[UndoToast()]] - code - src/components/UndoToast.tsx
- [[UndoToast.tsx]] - code - src/components/UndoToast.tsx
- [[UndoToastProps]] - code - src/components/UndoToast.tsx
- [[domainForProject()]] - code - src/lib/groupByDomain.ts
- [[domains.ts]] - code - src/data/domains.ts
- [[doneWhenUi.test.tsx]] - code - src/test/doneWhenUi.test.tsx
- [[groupByDomain()]] - code - src/lib/groupByDomain.ts
- [[groupByDomain.ts]] - code - src/lib/groupByDomain.ts
- [[groupByProject()]] - code - src/lib/groupByProject.ts
- [[groupByProject.ts]] - code - src/lib/groupByProject.ts
- [[index.ts]] - code - src/types/index.ts
- [[isDomain()]] - code - src/data/domains.ts
- [[isValidPriority()]] - code - src/sync/LocalOnly.ts
- [[makeTask()]] - code - src/test/doneWhenUi.test.tsx
- [[makeTask()_3]] - code - src/test/groupByDomain.test.ts
- [[makeTask()_4]] - code - src/test/groupByProject.test.ts
- [[makeTask()_1]] - code - src/test/priorityUi.test.tsx
- [[makeTask()_5]] - code - src/test/tapDotComplete.test.tsx
- [[noop()]] - code - src/test/doneWhenUi.test.tsx
- [[noop()_1]] - code - src/test/priorityUi.test.tsx
- [[priorityUi.test.tsx]] - code - src/test/priorityUi.test.tsx
- [[tapDotComplete.test.tsx]] - code - src/test/tapDotComplete.test.tsx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Task_Input__Priority_UI
SORT file.name ASC
```

## Connections to other communities
- 30 edges to [[_COMMUNITY_DomainsPulseGlass UI]]
- 26 edges to [[_COMMUNITY_Tab Bar, Seed & DB]]
- 16 edges to [[_COMMUNITY_VaultSync Implementation & Tests]]
- 4 edges to [[_COMMUNITY_Architecture ADRs & NOW View]]
- 3 edges to [[_COMMUNITY_Smart Capture]]
- 1 edge to [[_COMMUNITY_Domain Model & Seed ADRs]]

## Top bridge nodes
- [[DOMAINS]] - degree 16, connects to 5 communities
- [[Task]] - degree 48, connects to 4 communities
- [[index.ts]] - degree 26, connects to 3 communities
- [[NowView.tsx]] - degree 16, connects to 3 communities
- [[isDomain()]] - degree 11, connects to 3 communities