# Bot photo modality: vision extraction, batch-confirm, and image fetch

Status: **Accepted**. Extends [ADR-0011](0011-bot-transport-identity-router.md) (bot transport, identity, intent-router seam). Precedes [Slice S19](../slices/slice-S19-bot-photo.md).

S19 adds the third and final capture modality to the Group E bot pipeline: a Telegram photo → Claude vision reads it → one or more tasks are extracted → the owner confirms the batch → confirmed tasks land in the vault via the existing S16b write path. Per the slice brief this is scoped as depending on **S16 only** (not S18 voice) — S17/S18/S19 are three siblings extending the same S16 foundation in parallel (kanban `s19.blockedBy = ["s16"]`, already recorded pre-S19). This ADR resolves the design calls the S19 brief leaves open, headlessly (`afk-pipeline auto`), so the tracer-bullet issues below carry decisions, not open questions.

Three decisions to resolve, per the brief: the vision model + multi-task structured-output schema, the batch-confirm UX, and Telegram image-fetch handling. A fourth — how batch-confirm state relates to S17's (not-yet-merged, sibling in-flight) generic confirmation state — is resolved as an explicit, narrow, convergence-flagged choice rather than blocked on S17 landing first.

## Decision 1 — Vision model: `claude-sonnet-5`, same pin as the S16 NLU call

**Decision:** the photo-extraction call uses `claude-sonnet-5` — the same model `services/bot/nlu.ts` already pins for text intent/extraction (`CLAUDE_MODEL = 'claude-sonnet-5'`, ADR-0011 Decision/HITL-flag (B)).

**Why:**
- **Vision support at the fidelity this task needs.** Claude Sonnet 5 is the first Sonnet-tier model with high-resolution vision (2576px long edge, vs 1568px on Sonnet 4.6) — sufficient for a whiteboard photo, a handwritten list, or a receipt taken on a phone camera. Opus-tier would be strictly more accurate but, exactly as ADR-0011 reasoned for text NLU, is not warranted for a single-turn extraction call on a personal, low-volume bot (the traffic profile is unchanged by adding a second modality).
- **One model across both bot NLU paths.** Keeping vision and text extraction on the same model avoids a second cost/latency profile to reason about, and both calls are structurally the same shape (single-turn, structured-output, classify-then-extract).
- **Structured output, not prefill.** As with `nlu.ts`, extraction uses `output_config: { format: { type: 'json_schema', schema } }` — never assistant-turn prefill (removed on the 4.6+/5 family per `claude-api`).

**Consequence:** `services/bot/visionExtract.ts` (new, S19a) re-exports/reuses the same `CLAUDE_MODEL` constant and `ClaudeClient` interface from `nlu.ts` (imported, not duplicated) — one seam for "the Claude model the bot talks to," matching how `create.ts` imports `serializeTaskLine` rather than reimplementing it.

**Assumed (auto-mode); revisit if extraction quality on dense/handwritten photos proves insufficient in practice** — same escape hatch ADR-0011 left for the text NLU pin.

## Decision 2 — Multi-task structured-output schema

**Decision:** one Claude call per photo, returning a JSON object with a `tasks` array (0–20 entries), each entry shaped identically to `nlu.ts`'s per-task fields minus `intent` (the photo path never needs intent classification — see Decision 4):

```json
{
  "type": "object",
  "properties": {
    "tasks": {
      "type": "array",
      "maxItems": 20,
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "domain": { "type": "string" },
          "project": { "type": "string" },
          "done_when": { "type": "string" },
          "priority": { "type": "integer", "enum": [1, 2, 3] }
        },
        "required": ["title"],
        "additionalProperties": false
      }
    }
  },
  "required": ["tasks"],
  "additionalProperties": false
}
```

**Why an array, not N separate calls:** a single photo (whiteboard, list) is naturally one extraction pass over one image — one call amortizes the image's token cost (images are billed once per call) across however many tasks it contains, instead of paying for the image N times.

**Why capped at 20:** a dense whiteboard photo could in principle yield dozens of low-quality fragments; a cap keeps the batch-confirm prompt (Decision 3) legible as a single Telegram message and bounds worst-case vault writes from one photo. **Assumed or revisit-if-needed; not a hard product requirement** — if Claude returns more than 20 in practice (it's asked not to, but structured output only constrains shape, not count beyond `maxItems`), the handler truncates to the first 20 and appends "(showing first 20 of N found)" to the confirm prompt.

**Domain normalization reused, not reimplemented:** exactly like `nlu.ts`, `domain` is normalized against `isDomain()` (`src/data/domains.ts`) in `visionExtract.ts` itself (same "drop to undefined if not a confident match" rule) — the downstream write step (Decision 4) then sees only valid-or-absent domains, identical to how `create.ts` already assumes.

**Caption handling:** when the Telegram message carries a caption, it's appended to the vision prompt as guiding context ("The user's caption for this photo: `<caption>`") — the brief's "caption text augments/guides extraction" requirement. No caption → the instruction is simply omitted; this is a prompt-construction detail inside `visionExtract.ts`, not a schema change.

## Decision 3 — Batch-confirm UX: numbered list, all/none/subset by reply

**Decision:** after extraction, the bot replies with a numbered list of the extracted tasks (title · domain · priority) and a one-line instruction: reply `all` (or `y`) to create every task, `none` (or `n`) to discard the batch, or a comma-separated subset of numbers (e.g. `1,3`) to create only those. The **next incoming text message from the owner chat** is consumed as the confirmation response — intercepted before it reaches Claude NLU (Decision 4) — rather than requiring a reply-to-message thread (Telegram's native "reply" UX adds friction with no benefit for a single pending batch per chat).

```
Found 3 tasks in that photo:
1. Renew passport · Life Admin · P2
2. Call plumber · Life Admin
3. Book dentist · Body & Mind · P1

Reply 'all' to create all 3, 'none' to cancel, or numbers (e.g. '1,3') for a subset.
```

**Why "confirm the whole set," not "confirm each task individually":** the slice brief frames this explicitly — "bulk creation is effectively destructive-by-volume" — a single yes/no-per-item flow would be N round-trips for one photo, defeating the "photograph it and go" value the slice exists for. All/none/subset in one reply is the minimum viable batch-confirm that still lets the owner drop a misread line without discarding the whole photo.

**State shape — narrow, chat-scoped, expiring:**

```ts
// services/bot/photoConfirm.ts (new, S19b)
export interface PendingPhotoConfirmation {
  chatId: string
  tasks: ExtractedTask[]   // from visionExtract.ts — post-normalization
  expiresAt: number        // Date.now() + 10 * 60 * 1000
}

export function setPending(chatId: string, tasks: ExtractedTask[]): void
export function getPending(chatId: string): PendingPhotoConfirmation | undefined  // undefined if absent or expired
export function clearPending(chatId: string): void
```

In-memory `Map<chatId, PendingPhotoConfirmation>` inside the module (mirrors the bot process's existing pattern of module-level state — `RealTelegramClient`'s `offset`/`polling` fields are the closest precedent; no external store, matching the bot's single-process, single-owner deployment shape from ADR-0011 Decision 1).

- **TTL: 10 minutes.** Mirrors S17's brief language ("keep confirmation state minimal and expiring") even though S17 itself hasn't landed — same trust-model ethos (reversible, bounded, no silent stale-state action).
- **One pending batch per chat; a new photo overwrites the old pending state.** Single-owner bot — there is exactly one chat id ever active, so queueing multiple concurrent photo batches has no real use case and would add complexity (a queue, an index into it) for a scenario that can't occur in practice. **Assumed.**
- **An invalid reply (not `all`/`none`/a number list) leaves the pending state untouched** and re-sends the instruction line — no retry-count cap; the 10-minute TTL is the only bound. Simpler than tracking attempts, and consistent with "never mutate on a low-confidence input" (mirroring S17's brief).
- **Expiry is silent.** If the owner replies after 10 minutes, `getPending` returns `undefined` and the router falls through to the normal text/NLU path — the stale reply is then classified as a normal message (almost always "other" → not yet supported), which is an acceptable edge case for a personal low-volume bot. **Assumed.**

## Decision 4 — Router integration: a photo branch + a confirm-check, not a new intent

**Decision:** `services/bot/router.ts`'s `handleIncomingMessage` — the message-ingest layer per the slice's scope fence, *not* the intent registry — gains two additions, both ahead of the existing NLU call:

1. **Photo branch:** if the incoming Telegram message carries a photo, skip NLU entirely — download the image (Decision 5), call `extractTasksFromImage` (Decision 2), `setPending`, and reply with the batch-confirm prompt (Decision 3).
2. **Confirm-check branch:** if the incoming message is text and `getPending(chatId)` returns a non-expired batch, parse the reply as all/none/subset (Decision 3) instead of calling `classifyAndExtract`. On `all`/subset, write each selected task by calling `services/bot/intents/create.ts`'s **existing, unmodified, already-exported** `handleCreate(params, ctx)` once per task — sequentially, awaited in order — collecting each returned confirmation line into one consolidated reply. On `none`, clear pending and reply with a cancellation line.
3. Otherwise (text, no pending batch): existing NLU flow, byte-for-byte unchanged.

**Why reuse `handleCreate` instead of a batch-write helper:** `handleCreate` already does exactly "validate one task's fields, resolve its vault path, serialize via the existing `serializeTaskLine`, write via `ctx.vaultTransport`, return a confirmation string" — the full single-task write path S15/S16b built and S19's brief says to reuse ("create via the existing vault write"). Calling it N times sequentially is simpler and safer than inventing a `handleCreateBatch` that touches `create.ts`/`vaultTransport.ts` internals: no new write API, no risk of diverging from the single-task path's validation rules, and the slice's own scope fence forbids rewriting `create.ts`. Sequential (not concurrent) calls avoid any question of concurrent writes to the same vault working copy — the bot already processes one Telegram message at a time, so this is simply "handle N logical tasks inside one physical message" with no new concurrency surface. Cost: one git commit per task instead of one batch commit (`NodeVaultTransport.writeFile` commits per call) — acceptable for a personal, low-volume bot; not a case worth adding batch-commit machinery for.

**Why this doesn't need `IntentName` to grow a `'photo'` member:** ADR-0011 Decision 4's registry (`services/bot/intents/registry.ts`, `getIntentHandler`) dispatches a **Claude-classified intent name** extracted from free text. A photo is not classified by NLU at all in this design — there is no `intent` field to classify (Decision 2's schema has none), so there is nothing to register a `'photo'` handler for. The photo path is a structurally different message shape (image, not text) handled by a structurally different branch of the *transport* layer, exactly matching the slice's own framing ("a photo branch in the Telegram handler + a vision-extract step"), and exactly matching S18's voice design (voice also doesn't register an intent — it transcribes and re-enters the *text* NLU path, per its own brief: "feed the transcript into the existing intent pipeline"). Photo is the one modality that does **not** re-enter NLU, because vision extraction already produces structured tasks directly — routing those through a text-shaped intent classifier would be a lossy, pointless round-trip.

**Convergence with S17 (documented, not blocking):** S17's brief describes a **per-chat pending-confirmation state** for update/delete confirm-destructive prompts. `PendingPhotoConfirmation` (Decision 3) is deliberately scoped and named for the photo case only — it does not attempt to anticipate S17's eventual shape, because S17 hasn't landed and guessing its interface risks a rewrite either way. **Flagged for the orchestrator's central reconciliation pass** once S17 merges: if S17's confirmation state module is generic enough, a follow-up slice can fold `photoConfirm.ts` into it (rename/generalize, update `router.ts`'s two call sites); if not, both remain as sibling per-purpose state modules. This ADR does not block on that outcome — S19 ships its own minimal, correct, expiring state now, per the slice brief's explicit fallback ("reuse S17's confirm model if present; otherwise a simple confirm").

## Decision 5 — Telegram image-fetch handling

**Decision:** `TelegramMessage` (`services/bot/telegramClient.ts`) gains two optional fields — `photoFileId?: string` and `caption?: string` — populated from `update.message.photo` (Telegram sends an array of the same image at multiple resolutions; the **last** element is the highest-resolution variant per the Bot API's own ordering guarantee) and `update.message.caption`. `TelegramClient` gains one method:

```ts
export interface TelegramClient {
  pollUpdates(onMessage: (msg: TelegramMessage) => void | Promise<void>): void
  sendMessage(chatId: string, text: string): Promise<void>
  downloadPhoto(fileId: string): Promise<{ data: Buffer; mediaType: string }>  // new, S19a
}
```

**Why a two-step fetch, matching the Bot API's own shape:** Telegram's file access is `getFile(file_id) → { file_path }` then a plain HTTPS GET against `https://api.telegram.org/file/bot<token>/<file_path>` — `RealTelegramClient.downloadPhoto` performs both calls internally and returns raw bytes + media type, so callers (`visionExtract.ts`) never see the two-step shape or the token-bearing URL.

**Why `mediaType` is hardcoded to `'image/jpeg'`, not sniffed:** Telegram always re-encodes photos sent through the compressed `photo` message type as JPEG server-side — this is a Bot API guarantee, not an assumption about user input. (Sending an image as an uncompressed `document` is a different Telegram message type entirely and is explicitly out of scope — see the slice brief's "Anything beyond task extraction... unless trivial.") No content-sniffing library, no `Content-Type` header trust needed.

**Why `Buffer`, then base64 at the Claude-call boundary, not base64 all the way through:** `downloadPhoto` returns raw bytes so the interface stays testable with a plain fixture buffer (mirrors `VaultTransport.readFiles()` returning plain strings, not vault-format-encoded ones); `visionExtract.ts` does the one `.toString('base64')` conversion immediately before building the Claude `image` content block (`{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }`), keeping the base64-encoding concern local to the one place that needs it.

**Size/format limits:** no client-side resize or format conversion — Claude's vision input limits (documented in `claude-api`) comfortably cover a phone-camera photo of a whiteboard or receipt at Telegram's own compression, and the slice's scope fence excludes PDF/multi-page and anything beyond single-photo extraction. If a photo is rejected by Claude for size, `visionExtract.ts` catches the API error and returns an empty task list with a reply explaining the photo couldn't be read — no bespoke pre-validation.

## Scope fence — explicitly OUT of S19 (mirrors the slice brief)

- Storing the photo itself as a vault attachment — task extraction only.
- PDF or multi-page input; Telegram `document`-type image uploads (uncompressed originals).
- Any change to `services/bot/intents/registry.ts`, `services/bot/intents/types.ts`, or `services/bot/intents/create.ts` — all imported/called, never edited.
- Any change to `src/vault/serialize.ts`, `src/sync/VaultSync.ts`, or `src/vault/transport.ts` — the write path is reused exactly as S16b built it.
- Generalizing `photoConfirm.ts` into a shared confirmation-state module — deferred to a post-S17 reconciliation pass (Decision 4).
- Multi-photo batches (e.g. a Telegram media-group album of several photos in one message) — treated as N independent single-photo messages if Telegram delivers them as separate updates (the common case); explicit media-group grouping is not implemented.

## HITL flags (documented assumptions — auto-mode; confirm with owner)

- **(A) 20-task cap per photo** (Decision 2) — assumed; revisit if a real whiteboard photo needs more, or if 20 proves too generous for the confirm prompt's legibility on a phone screen.
- **(B) 10-minute confirm TTL** (Decision 3) — assumed, matches S17's brief language; not re-litigated here.
- **(C) `claude-sonnet-5` vision pin** (Decision 1) — assumed, same escape hatch as ADR-0011's NLU model pin.
- **(D) Single pending batch per chat, latest photo wins** (Decision 3) — assumed; a single-owner bot has no concurrent-batch use case today.

## Slicing

S19 ships as two tracer-bullet slices, serialized by a real dependency (S19b needs the module S19a builds), not merely batched apart for hotspot avoidance:

- **S19a** — photo ingest capability: `telegramClient.ts` photo detection + `downloadPhoto`, and the new `visionExtract.ts` module. No wiring into the live message pipeline yet — purely additive, independently testable with fixtures/mocks.
- **S19b** — batch-confirm state (`photoConfirm.ts`, new) + `router.ts` wiring (photo branch + confirm-check branch), reusing `intents/create.ts`'s `handleCreate` for the actual writes. Blocked by S19a.

See `docs/slices/slice-S19-bot-photo.md` for acceptance criteria; the to-issues breakdown below carries the concrete write-sets.
