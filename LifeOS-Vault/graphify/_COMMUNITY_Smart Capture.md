---
type: community
cohesion: 0.36
members: 9
---

# Smart Capture

**Cohesion:** 0.36 - loosely connected
**Members:** 9 nodes

## Members
- [[AddInput]] - code - src/components/CaptureSheet.tsx
- [[CaptureSheet()]] - code - src/components/CaptureSheet.tsx
- [[CaptureSheet.tsx]] - code - src/components/CaptureSheet.tsx
- [[CaptureSheetProps]] - code - src/components/CaptureSheet.tsx
- [[TaskInput]] - code - src/capture/parseCapture.ts
- [[fuzzyMatchDomain()]] - code - src/capture/parseCapture.ts
- [[parseCapture()]] - code - src/capture/parseCapture.ts
- [[parseCapture.test.ts]] - code - src/capture/parseCapture.test.ts
- [[parseCapture.ts]] - code - src/capture/parseCapture.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Smart_Capture
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_Task Input & Priority UI]]
- 2 edges to [[_COMMUNITY_Tab Bar, Seed & DB]]

## Top bridge nodes
- [[CaptureSheet.tsx]] - degree 8, connects to 2 communities
- [[parseCapture.ts]] - degree 6, connects to 1 community
- [[CaptureSheet()]] - degree 3, connects to 1 community