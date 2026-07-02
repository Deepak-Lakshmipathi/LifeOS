# Bot transport, own PAT, durable id::, and the intent-router seam

Status: **Accepted**. Extends [ADR-0009](0009-vault-read-transport.md) (vault read) and [ADR-0010](0010-vault-write.md) (vault write, §2 upgrade path). Precedes [Slice S16](../slices/slice-S16-bot-text-create.md).

S16 opens Group E — the Telegram bot — the first client of the vault write layer that is **not** the PWA. HANDOFF.md flagged this as a human-gate slice pending a grill on where the bot runs and how it authenticates; this ADR resolves that grill (run in `afk-pipeline auto` mode, self-grilled by the architect/engineer personas per the pipeline's headless protocol) plus two further calls the S16 brief surfaces: durable `id::` identity (ADR-0010 §2's own upgrade trigger) and the intent-router seam shape for the S17–S19 modality slices that follow. All four decisions are recorded here so the S16 (and future S17–S19) implementer tickets carry answers, not open questions.

## Decision 1 — Bot runtime: long-poll worker, not a serverless webhook

**Decision:** the bot is a long-running Node/TS process that polls Telegram's `getUpdates` API (long-poll), not a serverless webhook handler.

**Why:**
- **Warm git clone.** `GitTransport` (S14/S15) clones the vault into a local FS once and pulls thereafter — cheap only because the clone persists across calls. A stateless serverless webhook has no persistent local disk between invocations (or pays to attach one), so every incoming message would re-pay a full clone. A long-lived worker process clones once at boot and reuses the working copy for every message, exactly like the PWA's in-browser model.
- **No public endpoint to run for a single owner.** A webhook needs a stable HTTPS URL, TLS, and a secret-token header check; for a single-user personal bot that's infrastructure with no corresponding benefit. Long-polling needs only outbound HTTPS to Telegram and the vault's git remote — nothing inbound to secure.
- **Execution-time headroom.** Each message triggers a `git pull`, a Claude API call, and a `git commit`/best-effort `push` — comfortably a few seconds, occasionally more under network variance. A long-poll worker has no per-request wall-clock ceiling; a serverless function does (and free/hobby tiers are tight).
- Traffic is a single owner's occasional texts — there is no scale-to-zero cost benefit serverless would otherwise buy that offsets the above.

**Consequence:** the bot needs *some* always-on host (a small VM, a free-tier always-on container service, or even a machine the owner controls). This is an operational choice, not an architectural one — out of scope for S16's code, left to the deploy notes in `services/bot/README.md`. Revisit serverless if/when the vault gets a Node-native fast transport and traffic volume changes this trade-off.

## Decision 2 — Bot auth: its own write-scoped PAT, distinct from the PWA's

**Decision:** the bot authenticates to the vault repo with its own fine-grained GitHub PAT (`Contents: Read` + `Write`, scoped to the single vault repo — same scope shape as the PWA's `VITE_VAULT_PAT`, ADR-0010 §9), stored as a **separate** secret: `BOT_VAULT_PAT`.

**Why:** the PWA (browser, IndexedDB-resident token) and the bot (server process) are different trust boundaries with different exposure profiles. A single shared PAT means compromising either surface compromises both, and neither can be rotated or revoked independently. Two tokens cost nothing extra (GitHub fine-grained PATs are free and repo-scoped) and buy independent revocation.

**Secrets, all via env, never committed:**
- `TELEGRAM_BOT_TOKEN` — from BotFather.
- `BOT_VAULT_PAT` — fine-grained PAT, Contents Read+Write, scoped to the vault repo only.
- `ANTHROPIC_API_KEY` — Claude API key for NLU (see Decision 3).
- `OWNER_TELEGRAM_CHAT_ID` — the single chat id the bot serves; every other chat id is ignored (per the slice's owner-guard requirement).

`services/bot/.env.example` documents the shape; `.env` is gitignored. Config is loaded once at boot (`services/bot/config.ts`), never logged (mirrors ADR-0009/0010's "never log the token" rule).

## Decision 3 — Durable `id::` identity lands now, per ADR-0010 §2's own trigger

ADR-0010 §2 named its own upgrade condition precisely: *"adopt the stamped-`id::` scheme … when a second live mutator — the S16 Telegram bot editing tasks it did not author in the same session — makes in-memory session identity insufficient. That is the slice that pays for `id::`, not S15."* S16 is that slice.

**Decision:** `parseTaskLine` gains an optional `id::` field; `serializeTaskLine` **always** emits it going forward. Existing untouched lines (written before S16) keep no `id::` and are unaffected — identity for them stays ephemeral (per-parse, exactly as S14/S15) **until the next time any mutator writes that line**, at which point the write path mints a UUID and stamps it. No bulk migration, no forced rewrite of the vault.

**Concretely:**
1. **`src/vault/parseVault.ts` (`parseTaskLine`):** extend the field-marker regex from `/\s+(done_when|priority)::\s+/g` to `/\s+(id|done_when|priority)::\s+/g`, and extract `id` the same way as `done_when`/`priority` (slice the value between markers). When present and non-empty, use it as `Task.id` instead of `crypto.randomUUID()`. When absent, unchanged behavior — mint a fresh id (ephemeral, per-parse, as today). Field order in the source text doesn't matter to the parser (it already indexes markers positionally), so this is additive and keeps the 52 existing S14 fixtures green (none of them contain `id::`, so none change behavior).
2. **`src/vault/serialize.ts` (`serializeTaskLine`):** always emit `id:: <task.id>` right after the title, **before** `done_when`/`priority` (metadata-first convention; keeps the "emit-only-when-present" rule for `done_when`/`priority` unchanged — `id` is the one field that's never absent, since every `Task` always has an `id`). New canonical format:
   ```
   - [ ] Title id:: <uuid> done_when:: <text> priority:: <1|2|3>
   - [x] Title id:: <uuid> priority:: 2
   ```
3. **`src/sync/VaultSync.ts`:** no interface change. `list()` already builds `snapshot: Map<id, {path, rawLine, task}>` from whatever `parseTaskLine` returns as `task.id` — once `parseTaskLine` returns a *durable* id (when present in the line), the snapshot is keyed by that durable id automatically. `add()` already calls `serializeTaskLine`, so new tasks get `id::` for free once the serializer changes. `update()`/`toggleDone()`/`delete()` re-serialize via `serializeTaskLine` too, so the **first** time any of them touches a legacy id-less line, the rewritten line gains `id::` — this is the "mints on first write" backfill, falling out naturally from the serializer change with no extra code.
4. **Bot side (`services/bot/`):** every task the bot creates goes through the *same* `serializeTaskLine`, so it's stamped from birth — no separate id-minting logic in the bot.
5. **No `Task` type change.** `id: string` already exists (ADR-0004); only its *durability* changes (persisted when present in the source line vs. synthesized when not). No Dexie migration, no schema bump — this is a vault-markdown-format change only, matching how `priority`/`done_when` were introduced as optional inline fields without touching the Dexie schema.
6. **Scope fence:** S16 does **not** need to *use* durable identity for anything (it only appends new lines — `add()`, never look-up-and-mutate). It ships the parser/serializer support and gets it "for free" on every task it creates. S17 (update/delete) is the first slice that actually *depends on* durable ids to find a task across sessions — this ADR unblocks that without S17 needing its own identity design.

**Rejected:** a separate migration slice that walks the whole vault stamping ids onto every existing line — unnecessary churn on the owner's hand-authored notes; the lazy/first-write backfill above achieves the same end state incrementally and non-destructively, consistent with ADR-0010 §3's "never rewrite more than the touched line" rule.

## Decision 4 — Intent router seam: self-registering handler modules, one append-only barrel line per slice

**Decision:** `services/bot/intents/` holds one file per intent (`create.ts` in S16; `update.ts`/`delete.ts` in S17, `voice.ts` in S18, `photo.ts` in S19). Each file's only shared touchpoint is a **single new import line** in `services/bot/intents/index.ts` — no shared registry object literal is hand-edited by more than one line per slice, and no slice ever edits another slice's handler file.

**Shape:**
```ts
// services/bot/intents/types.ts
export type IntentName = 'create' | 'not_supported' // union grows: 'update' | 'delete' (S17), 'voice' (S18), 'photo' (S19)

export interface IntentHandler {
  name: IntentName
  handle(params: unknown, ctx: BotContext): Promise<string> // returns the reply text
}

// services/bot/intents/registry.ts (written once in S16; not touched again by S17-19)
const handlers = new Map<IntentName, IntentHandler>()
export function registerIntentHandler(h: IntentHandler): void { handlers.set(h.name, h) }
export function getIntentHandler(name: IntentName): IntentHandler | undefined { return handlers.get(name) }

// services/bot/intents/create.ts (S16)
import { registerIntentHandler } from './registry'
export const createHandler: IntentHandler = { name: 'create', handle: async (params, ctx) => { /* ... */ } }
registerIntentHandler(createHandler) // self-registers on import

// services/bot/intents/index.ts — the ONLY file every slice appends one line to
import './create'
// S17 adds: import './update'; import './delete'
// S18 adds: import './voice'
// S19 adds: import './photo'
```

The router (`services/bot/router.ts`) imports `services/bot/intents/index.ts` once at boot (which runs every handler module's self-registration side effect), then does `getIntentHandler(intent.name)?.handle(...) ?? Promise.resolve("not yet supported")`.

**Why this shape:** `registry.ts` and `router.ts` are written once, by S16, and never touched again — they are generic dispatch machinery with no per-intent knowledge. Each future slice's *entire* diff is: one new file under `intents/`, plus one new `import './x'` line in `index.ts`. That import-list append is a documented, intentionally-tiny shared touchpoint (P3's hotspot rule): it is **not** treated as a batching blocker — an append-only single-line diff to a barrel file rebases cleanly even when two such lines land in the same window, unlike a genuine hotspot (e.g. a shared object literal both slices mutate in the same region). If S17–S19 ever *do* need to run in the same dispatch batch, serialize only the `index.ts` line (trivial) rather than the whole slice.

**Rejected:** a single shared `Record<IntentName, Handler>` object literal that every slice adds a key to — same number of touched lines, but object-literal edits are more likely to land on the same line/region and produce a real (if trivial) merge conflict; the self-registering-module + append-only-import-list pattern isolates each slice's edit to its own line at the end of the file. Also rejected: filesystem directory-scanning/dynamic `import()` discovery (no shared file at all) — more "clever," but adds Node/TS build-time indirection (dynamic import resolution, path/extension handling) for a benefit (one fewer line per slice) that doesn't justify the complexity on a 4-intent bot.

## Scope fence — explicitly OUT of S16
- update/delete/voice/photo intents — S17/S18/S19. S16's router replies **"not yet supported"** for any classified intent other than `create`.
- Confirm-destructive UX, conversation state — S17.
- Any change to `parseVault.ts`'s *domain/project*-from-path inference, or to the `VaultTransport` interface — unchanged.
- A Node-native (non-lightning-fs) `VaultTransport` implementation is new code in `services/bot/`, not a change to `src/vault/transport.ts`'s browser-facing `GitTransport` — the interface is reused, the implementation is not (lightning-fs is IndexedDB-backed and doesn't exist in Node).

## HITL flags (documented assumptions — auto-mode; confirm with owner)
- **(A) Bot hosting target:** this ADR specifies *long-poll worker* as the runtime shape but leaves the actual host (VM/container/always-on free tier) unspecified — an infra choice, not a code dependency of S16. **Owner's call, not blocking S16's implementation** (S16 ships the worker process; where it runs is a deploy-notes decision).
- **(B) Claude model pin:** `claude-sonnet-5` for intent+extraction (structured output via `output_config.format` / `client.messages.parse()`). Chosen for cost/latency fit on a single-turn classification+extraction call on a personal low-volume bot; Opus-tier would be strictly more accurate but is not warranted for this task shape. **Assumed; revisit if extraction quality proves insufficient in practice.**
- **(C) Ambiguous-domain fallback:** per the slice's acceptance criteria, an intent with no confidently-matched domain maps to Inbox (mirrors S12's `parseCapture` fuzzy-match-to-Inbox fallback) — **assumed**, not re-litigated here.

## Slicing
S16 ships as a single tracer-bullet slice (thin end-to-end vertical: Telegram text in → Claude NLU → vault write → confirmation reply) plus this ADR + the PRD. See `docs/slices/slice-S16-bot-text-create.md` for acceptance criteria and the to-issues breakdown for the concrete write-set/file list.
