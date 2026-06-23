---
type: community
members: 5
---

# PWA CI Testing

**Members:** 5 nodes

## Members
- [[ADR-0003 CI-gated emulation PWA testing]] - rationale - docs/adr/0003-emulation-pwa-testing.md
- [[CI build-test job]] - code - .github/workflows/ci.yml
- [[CI pwa-e2e job]] - code - .github/workflows/ci.yml
- [[Tier 1 Playwright PWA tests]] - concept - .github/workflows/ci.yml
- [[Tier 2 Lighthouse PWA installability audit]] - concept - .github/workflows/ci.yml

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/PWA_CI_Testing
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_ADRs & Domain Model]]

## Top bridge nodes
- [[ADR-0003 CI-gated emulation PWA testing]] - degree 4, connects to 1 community