---
type: community
cohesion: 0.17
members: 16
---

# Vault Write Mechanics

**Cohesion:** 0.17 - loosely connected
**Members:** 16 nodes

## Members
- [[Best-effort push]] - rationale - docs/adr/0010-vault-write.md
- [[Durable id identity]] - rationale - docs/adr/0010-vault-write.md
- [[Git-as-transport]] - rationale - docs/adr/0009-vault-read-transport.md
- [[GitTransport_1]] - code - docs/adr/0010-vault-write.md
- [[In-memory source-map identity]] - rationale - docs/adr/0010-vault-write.md
- [[Inbox home]] - concept - docs/adr/0010-vault-write.md
- [[Local-authoritative commit]] - rationale - docs/adr/0010-vault-write.md
- [[Promise-chain write-queue]] - rationale - docs/adr/0010-vault-write.md
- [[S16 Telegram bot]] - concept - HANDOFF.md
- [[Single-line splice]] - rationale - docs/adr/0010-vault-write.md
- [[VaultSync_1]] - code - docs/adr/0010-vault-write.md
- [[VaultTransport interface]] - concept - docs/adr/0010-vault-write.md
- [[Wipe-reclone data-loss hazard]] - rationale - docs/adr/0010-vault-write.md
- [[parseTaskLine]] - code - docs/adr/0009-vault-read-transport.md
- [[parseVault]] - code - docs/adr/0009-vault-read-transport.md
- [[serializeTaskLine]] - code - docs/adr/0010-vault-write.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Vault_Write_Mechanics
SORT file.name ASC
```
