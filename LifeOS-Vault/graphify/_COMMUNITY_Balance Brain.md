---
type: community
cohesion: 1.00
members: 2
---

# Balance Brain

**Cohesion:** 1.00 - tightly connected
**Members:** 2 nodes

## Members
- [[ADR-0008 Balance Brain]] - document - docs/adr/0008-balance-brain.md
- [[rankNow balance brain]] - code - docs/adr/0008-balance-brain.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Balance_Brain
SORT file.name ASC
```
