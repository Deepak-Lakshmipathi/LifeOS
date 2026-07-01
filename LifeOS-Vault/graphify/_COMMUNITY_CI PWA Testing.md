---
type: community
cohesion: 0.60
members: 5
---

# CI PWA Testing

**Cohesion:** 0.60 - moderately connected
**Members:** 5 nodes

## Members
- [[ADR-0003 CI-gated emulation PWA testing]] - rationale - docs/adr/0003-emulation-pwa-testing.md
- [[CI build-test job]] - code - .github/workflows/ci.yml
- [[CI pwa-e2e job]] - code - .github/workflows/ci.yml
- [[Tier 1 Playwright PWA tests]] - concept - .github/workflows/ci.yml
- [[Tier 2 Lighthouse PWA installability audit]] - concept - .github/workflows/ci.yml

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/CI_PWA_Testing
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_Architecture ADRs & NOW View]]

## Top bridge nodes
- [[ADR-0003 CI-gated emulation PWA testing]] - degree 4, connects to 1 community