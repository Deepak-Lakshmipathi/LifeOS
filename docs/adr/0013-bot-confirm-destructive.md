# Bot confirm-destructive: pending state, task targeting, and the router gate

Status: **Accepted**. Extends [ADR-0011](0011-bot-transport-identity-router.md) (bot transport, identity, intent-router seam). Precedes [Slice S17](../slices/slice-S17-bot-confirm-edits.md).

S17 gives the bot its first destructive powers — update and delete — and the brief's core requirement is a **confirm-destructive** trust model: the bot must never mutate a task the user didn't clearly ask it to touch. This ADR resolves the design calls the S17 brief leaves open, headlessly (`afk-pipeline auto`, self-grilled by the architect and engineer personas), so the tracer-bullet issues below carry decisions, not open questions.

Four decisions, per the brief: the pending-confirmation state model, how a task is targeted for update/delete, the confirm UX, and — because confirm-destructive is a cross-cutting concern that sits above per-intent dispatch — how much of `router.ts` this slice may touch given ADR-0011 Decision 4 fenced that file as "written once."

**Cross-pipeline note (S17/S18/S19 run as parallel siblings off S16, per the current kanban):** `docs/adr/0012-bot-photo-vision.md` (S19's ADR, drafted concurrently on a sibling branch) independently reaches the same in-memory-`Map`-in-`router.ts` shape for its own photo batch-confirm state, and explicitly flags `router.ts` as a **cross-pipeline hotspot** with S17/S18. This ADR's Decision 4 flags the same collision from the S17 side — see the PRD/deploy-table write-up for the reconciliation ask.

## Decision 1 — Pending-confirmation state: in-memory `Map<chatId, PendingAction>`, lazy expiry, no persistence

**Decision:** a new module, `services/bot/confirm/store.ts`, holds a module-scope `Map<string, PendingAction>` keyed by Telegram chat id. No file, database, or vault-backed persistence.

```ts
export interface MatchedTask { task: Task; path: string; rawLine: string }

export type PendingAction =
  | { kind: 'confirm'; intent: 'update' | 'delete'; match: MatchedTask; patch?: TaskPatch; promptedAt: number; expiresAt: number }
  | { kind: 'disambiguate'; intent: 'update' | 'delete'; candidates: MatchedTask[]; patch?: TaskPatch; expiresAt: number }

export const CONFIRM_TTL_MS = 2 * 60 * 1000 // 2 minutes

export function setPending(chatId: string, action: Omit<PendingAction, 'expiresAt'>): void
export function getPending(chatId: string): PendingAction | undefined // undefined if absent or expired (lazy check)
export function clearPending(chatId: string): void
```

**Why:** the bot is a single always-on long-poll process serving a single owner (ADR-0011 Decision 1 — not serverless, no cold-start/multi-instance concern that would otherwise force externalizing state). A `Map` costs nothing and satisfies the brief's "keep confirmation state minimal and expiring" exactly. Expiry is a stored `expiresAt` timestamp checked lazily on the next `getPending` call, not a `setTimeout` — a `setTimeout` per pending item is one more thing to `clearTimeout` on confirm/cancel for no behavioral difference on a single-user, low-traffic bot; a stale entry that nobody re-reads costs nothing sitting inert in the Map, and a process restart clears it anyway (acceptable: losing a pending confirm on a rare restart just means the user re-issues the request).

**Rejected:** a file-, vault-, or DB-backed store. The vault has no database and this state is explicitly pre-commit / not-yet-true — writing it to the vault (the source of truth) or to a new sidecar store would be new persistence infrastructure with no second consumer, for state that is correct to lose on restart.

## Decision 2 — Task targeting: token-overlap fuzzy match against a fresh read, committed by exact `rawLine` splice

**Decision:** targeting is **fuzzy title match only** — not by a user-typed `id::` (invisible to the user; nobody types a UUID into Telegram) and not by a "last created" shorthand (rejected below).

**Matching algorithm**, in a new pure module `services/bot/taskMatch.ts`:

```ts
export function scoreMatch(query: string, title: string): number {
  const q = new Set(query.toLowerCase().split(/\s+/).filter(Boolean))
  if (q.size === 0) return 0
  if (title.toLowerCase().includes(query.trim().toLowerCase()) && query.trim().length > 0) return 1
  const t = new Set(title.toLowerCase().split(/\s+/).filter(Boolean))
  let hits = 0
  for (const w of q) if (t.has(w)) hits++
  return hits / q.size
}
```

- Search space: **every task in the vault** (`ctx.vaultTransport.readFiles()` → `parseVault(files)`, importing the existing pure parser exactly as `create.ts` imports `serializeTaskLine` — done and not-done both included, since delete may legitimately target a completed task).
- If the NLU extraction also confidently identifies a `domain` for the reference (e.g. "the GST thing in Finance"), the candidate pool is filtered to that domain first, then scored; otherwise the full task list is scored.
- **Zero results with `scoreMatch >= 0.5`** → no match; reply "Couldn't find a task matching that." and clear any prior pending state. No mutation.
- **Exactly one result with `scoreMatch >= 0.6`, and no other candidate `>= 0.5`** → confident single match → proceeds straight to `kind: 'confirm'` (Decision 3).
- **Two or more results with `scoreMatch >= 0.5`** → ambiguous → `kind: 'disambiguate'`: reply with a numbered list (title + domain + `done_when` if present), capped at the top 5 by score (ties broken by `created_at` descending — newest first), and set pending state. The user's next message is expected to be a number.
- Selecting a valid number from a `disambiguate` list **transitions** the pending state to `kind: 'confirm'` for that one candidate (re-prompting with the exact-change text) rather than committing immediately — every destructive commit goes through an explicit y/n, with no shortcut, per the brief's literal acceptance criterion ("update/delete are not applied until the user confirms").

**Commit-time re-match:** on a confirmed "y", the handler re-reads (`readFiles()`) and looks for the stored `rawLine` as an **exact, unique string match** in the file at `path` — identical to `src/sync/VaultSync.ts`'s `update()`/`delete()` line-splice pattern (its own `matchIndices` + "ambiguous or stale snapshot" check), replicated here rather than importing `VaultSync.ts` (browser-only, out of the bot's import graph per the S16b "do NOT touch" fence). Zero or more-than-one matches (the line changed or vanished since the prompt) → cancel the pending action and reply "That task changed since I asked — please try again." rather than falling back to an `id::`-based re-search. This mirrors `VaultSync`'s own behavior exactly (it doesn't attempt an id-based re-lookup fallback either) — adding one here would be new complexity this codebase's own reference implementation doesn't have.

**Rejected — "last created" shorthand:** named as an option in the brief but not implemented. It would need a special-cased phrase detector in `nlu.ts`'s extraction prompt/schema (recognizing "the last one", "what I just added", etc.) with unclear precedence against a literal fuzzy match, and it isn't named in the slice's acceptance criteria. Deferred; can be added as a small follow-up if the owner asks for it.

## Decision 3 — Confirm UX: bare text y/n, checked before Claude NLU, 2-minute lazy-expiring window

**Decision:** confirmation is a plain text reply — `y`/`yes` (case-insensitive) commits, `n`/`no`/`cancel` cancels, anything else is treated as **not a confirmation reply**: the pending state is left untouched (no premature clear) and the bot re-sends the exact-change prompt once. Telegram inline-keyboard buttons (`callback_query`) are rejected: `services/bot/telegramClient.ts` today only handles `getUpdates` text messages — wiring a second Telegram update type (`answerCallbackQuery`, keyboard markup, a new update-shape branch) is new transport surface with no payoff for a single user typing in the same chat already.

**Pipeline placement:** in `handleIncomingMessage`, the pending-confirmation check runs **immediately after the owner guard and before the Claude NLU call** — a bare "y" is not itself a classifiable intent, and running it through `classifyAndExtract` would be a wasted API call at best and a misclassification risk at worst. This also means voice transcripts (S18) and any other text-shaped input pass through the same gate for free, since they re-enter this same `handleIncomingMessage` path per S18's own brief ("feed the transcript into the existing intent pipeline").

**Timeout:** `CONFIRM_TTL_MS = 2 * 60 * 1000` (2 minutes), a single named constant, hardcoded — not configurable (no config surface exists or is warranted for a single-user bot). Expiry is **silent and lazy**: nothing proactively messages the user when a pending action expires; the next `getPending` call after `expiresAt` simply returns `undefined`, and a late "y"/"n" reply falls through to the normal NLU path (classified as "other" → "not yet supported", an acceptable edge case). A proactive "your confirmation expired" push would require a background timer/scheduler — infrastructure a reactive long-poll worker has no other use for.

## Decision 4 — Router integration: a new `confirm/` module pair + a ~5-line `router.ts` gate; `IntentName`/`BotContext` widen additively

**Decision:** two new files own all confirm-destructive logic:

- `services/bot/confirm/store.ts` — the `Map` + `setPending`/`getPending`/`clearPending` (Decision 1). Pure state, zero imports of Telegram/Claude/git — unit-testable in total isolation with plain chatId/string fixtures, same bar as `create.test.ts`.
- `services/bot/confirm/gate.ts` — `resolvePending(chatId: string, text: string, ctx: BotContext): Promise<string | null>`: returns `null` when there is no pending action for this chat (router falls through to NLU as today); otherwise interprets `text` against the pending action's `kind` (disambiguate-pick, confirm y/n, or "not a recognized reply") and, on a confirmed "y", performs the actual re-match-and-splice commit via `ctx.vaultTransport` (Decision 2's commit-time re-match) and returns the result string to send back.

`router.ts`'s diff is additive and small:

```ts
const ctx: BotContext = { vaultTransport: deps.vaultTransport, chatId: msg.chatId }

const pendingReply = await resolvePending(msg.chatId, msg.text, ctx)
if (pendingReply !== null) {
  await deps.telegramClient.sendMessage(msg.chatId, pendingReply)
  return
}

const extracted = await classifyAndExtract(deps.claudeClient, msg.text)
const reply = await dispatchIntent(extracted.intent, extracted, ctx)
await deps.telegramClient.sendMessage(msg.chatId, reply)
```

**Why editing `router.ts` does not violate ADR-0011 Decision 4:** that decision fenced the **registry/dispatch machinery** (`registry.ts`'s `Map` + `registerIntentHandler`/`getIntentHandler`) as written-once-by-S16, extended only via `intents/index.ts`'s one-import-per-slice convention — it never claimed `router.ts` itself was frozen. Confirm-destructive is architecturally a gate that sits *above* per-intent dispatch (a bare "y" is not an intent at all), so it belongs in the message-ingest layer (`router.ts`), not smeared into each destructive handler — putting a duplicate confirm-check inside both `update.ts` and `delete.ts` would violate DRY and break for any future destructive intent that forgets to add it. `registry.ts` and `intents/index.ts`'s append-only convention are untouched by this decision.

**`intents/types.ts` widens additively, not rewritten:**

```ts
export type IntentName = 'create' | 'update' | 'delete'

export interface BotContext {
  vaultTransport: VaultTransport
  chatId: string // new — S17; intent handlers need it to register a pending confirmation
}
```

`create.ts` is unaffected (it never reads `ctx.chatId`); this is a pure addition to an existing interface, the same category of change ADR-0011 itself made to `parseTaskLine`/`serializeTaskLine` for `id::`.

**`update.ts`/`delete.ts` never mutate directly.** They only: extract `target_reference` (+ optional patch fields for update) from the NLU params, run the match (Decision 2), and call `setPending` with a `confirm` or `disambiguate` action, returning the prompt text. The actual vault write happens exclusively inside `confirm/gate.ts`'s `resolvePending` on a confirmed "y" — this keeps "who is allowed to write to the vault on this destructive path" to one function, auditable in one place.

**Cross-pipeline hotspot flag (do not resolve unilaterally here):** `docs/adr/0012-bot-photo-vision.md` (S19, sibling branch) independently plans its own `router.ts` edit (a photo branch + a confirm-check branch for its batch-confirm flow) and explicitly names `router.ts` as a hotspot risk with S17/S18. S17's `router.ts` diff above and S19's are **both** small, additive, early-in-function insertions — they do not logically conflict, but as literal same-file edits landing from two different branches they cannot be same-batch-dispatched without one rebasing onto the other. Flagged for the orchestrator's central reconciliation (see this slice's PRD/deploy table for the explicit ask): either serialize S17 and S19's dispatch (whichever merges first, the other rebases its `router.ts` hunk), or extract the "pending-check-before-NLU" shape into a tiny shared prerequisite both slices call into. Not resolved here — S17 ships its own correct, complete `router.ts` diff now, same posture ADR-0012 took for its side of this exact collision.

## `nlu.ts` schema growth (supporting change, not a separate decision point)

`services/bot/nlu.ts`'s `Intent` union grows to `'create' | 'update' | 'delete' | 'other'`, and the JSON-schema `intent` enum gains `'update'`/`'delete'`. Two fields are added to `ExtractedParams`/the schema:

- `target_reference?: string` — the free-text description of which task update/delete refers to (e.g. "the GST thing", "call CA"). Required by the handler for update/delete; absent → `UNCLEAR_REPLY`-style fallback, mirroring `create.ts`'s existing `UNCLEAR_REPLY` pattern.
- `mark_done?: boolean` — set when the message asks to mark a task done or not-done (e.g. "mark X done" → `true`). Distinct from the existing `priority`/`done_when`/`domain`/`project` fields, which for an `update` intent are **reinterpreted as the patch to apply** rather than a new task's initial values (the same flat schema does double duty by intent — `create.ts` and `update.ts` each read the fields their own intent cares about; this keeps the schema small rather than growing two near-duplicate field sets). Only fields Claude actually returns are ever applied as a patch — the extraction's existing "omit when not confidently implied" normalization (`normalize()` in `nlu.ts`) already gives update.ts exactly the omit-vs-present distinction it needs, no new sentinel required.

Title *rename* via update is explicitly **out of scope** for S17 (not in the brief's acceptance criteria — "mark X done" / "delete X" / "change X priority" are the three named verbs); the patch fields recognized are `priority`, `done_when`, `domain`, `project`, and `mark_done`. This can be extended later without a schema-breaking change.

## Scope fence — explicitly OUT of S17

- Voice (S18), photo (S19), multi-step batch edits — per the slice brief.
- Title rename via update (see above).
- Any change to `services/bot/intents/registry.ts` or `services/bot/intents/create.ts` — imported/called, never edited. `intents/index.ts` gains exactly two lines: `import './update'` and `import './delete'`.
- Any change to `src/vault/serialize.ts`, `src/vault/parseVault.ts`, `src/sync/VaultSync.ts`, or `src/vault/transport.ts` — all imported and reused exactly as written; the bot replicates VaultSync's rawLine-splice pattern locally (as `create.ts` already replicates `resolveFilePath` locally) rather than importing the browser-only `VaultSync.ts`.
- An `id::`-based commit-time re-match fallback (see Decision 2) — deferred; `VaultSync.ts` itself doesn't have one either.
- Generalizing `confirm/store.ts` into a shared module with S19's `photoConfirm.ts` — flagged for a post-merge reconciliation pass (Decision 4), not attempted here.

## HITL flags (documented assumptions — auto-mode; confirm with owner)

- **(A) 2-minute confirm TTL** (Decision 3) — assumed; shorter than S19's independently-chosen 10-minute batch-confirm TTL because a single-task y/n is a smaller cognitive load than reviewing a numbered batch list — revisit if 2 minutes proves too tight in practice.
- **(B) Match thresholds `0.6` (confident) / `0.5` (candidate floor)** (Decision 2) — assumed; a token-overlap heuristic tuned by inspection, not by a labeled dataset. Revisit if real usage shows too many false disambiguation prompts (raise the confident threshold) or too many missed matches (lower the candidate floor).
- **(C) Candidate list capped at 5** (Decision 2) — assumed; keeps a disambiguation prompt legible as one Telegram message on a phone screen, mirrors ADR-0012's independent 20-task cap reasoning for the same "keep the prompt legible" concern.
- **(D) `router.ts` cross-pipeline hotspot with S19 (and possibly S18)** (Decision 4) — not an assumption but an explicit unresolved coordination point, flagged for the orchestrator, not the owner.

## Slicing

S17 ships as a single tracer-bullet slice (thin end-to-end vertical: fuzzy-match → confirm prompt → y/n gate → vault write, all wired through `router.ts` in one pass) plus this ADR + the PRD — the confirm gate, the matcher, and the two new intent handlers are tightly coupled (the gate can't be tested meaningfully without the matcher producing its `PendingAction` shape, and the handlers can't be tested meaningfully without the gate consuming what they produce) so splitting them into independently-dispatchable slices would just recreate the same single write-set across two tickets. See `docs/slices/slice-S17-bot-confirm-edits.md` for acceptance criteria and the to-issues breakdown for the concrete write-set/file list.
