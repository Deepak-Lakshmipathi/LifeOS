---
type: community
cohesion: 0.11
members: 23
---

# Vault Sync Slices & Kanban

**Cohesion:** 0.11 - loosely connected
**Members:** 23 nodes

## Members
- [[ADR-0009 Vault Read Transport]] - document - docs/adr/0009-vault-read-transport.md
- [[ADR-0010 Vault Write]] - document - docs/adr/0010-vault-write.md
- [[Claude intent classification + structured extraction]] - concept - docs/slices/slice-S16-bot-text-create.md
- [[File is both data and UI (one source of truth)]] - rationale - kanban.html
- [[Fuzzy task-search  disambiguation helper]] - concept - docs/slices/slice-S17-bot-confirm-edits.md
- [[Layered emulation tiers (VitestPlaywrightLighthouseAVD)]] - concept - docs/testing/pwa-emulation-protocol.md
- [[Owner chat-id guard]] - rationale - docs/slices/slice-S16-bot-text-create.md
- [[PWA Emulation Testing Protocol]] - document - docs/testing/pwa-emulation-protocol.md
- [[S15 Vault Write Deploy Tables]] - document - afk-pipeline-out/s15-vault-write-deploy.md
- [[Slice S14 Vault Read]] - document - docs/slices/slice-S14-vault-read.md
- [[Slice S15 — Obsidian vault write]] - document - docs/slices/slice-S15-vault-write.md
- [[Slice S16 — Telegram bot text → create]] - document - docs/slices/slice-S16-bot-text-create.md
- [[Slice S17 — Telegram bot confirm updatedelete]] - document - docs/slices/slice-S17-bot-confirm-edits.md
- [[Slice S18 — Telegram bot voice notes]] - document - docs/slices/slice-S18-bot-voice.md
- [[Slice S19 — Telegram bot photos (vision)]] - document - docs/slices/slice-S19-bot-photo.md
- [[Telegram bot service (servicesbot)]] - concept - docs/slices/slice-S16-bot-text-create.md
- [[Transcription adapter (swappable STT)]] - concept - docs/slices/slice-S18-bot-voice.md
- [[Vault as live source of truth (dashboard ⇄ Obsidian)]] - rationale - docs/slices/slice-S15-vault-write.md
- [[VaultSync write methods (toggleDoneaddupdatedelete)]] - concept - docs/slices/slice-S15-vault-write.md
- [[board-data canonical JSON block]] - concept - kanban.html
- [[index.html (PWA entry  manifest link)]] - document - index.html
- [[kanban.html (single-file board UI + data)]] - document - kanban.html
- [[serializeTaskLine + round-trip parse]] - rationale - docs/slices/slice-S15-vault-write.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Vault_Sync_Slices__Kanban
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_Domain Model & Seed ADRs]]

## Top bridge nodes
- [[Slice S19 — Telegram bot photos (vision)]] - degree 4, connects to 1 community