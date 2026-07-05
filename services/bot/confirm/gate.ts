/**
 * confirm/gate — the pending-confirmation state machine for update/delete
 * (S17, ADR-0013 Decisions 2-4). `resolvePending` is the ONLY place allowed
 * to commit a vault write for update/delete — intents/update.ts and
 * intents/delete.ts only ever call setPending and return prompt text.
 *
 * Reply parsing here is deliberately forgiving-but-not-clever: exact y/yes,
 * n/no/cancel, or a bare integer pick — no fuzzy NLU is run on confirm
 * replies (ADR-0013 Decision 3: a bare "y" is not itself a classifiable
 * intent, and this gate runs before Claude is ever called).
 */

import { getPending, setPending, clearPending, type PendingAction, type TaskPatch } from './store'
import type { MatchedTask } from '../taskMatch'
import type { BotContext } from '../intents/types'
import type { Task } from '../../../src/types'
import { serializeTaskLine } from '../../../src/vault/serialize'

const CANCELLED_REPLY = 'Cancelled.'
const STALE_REPLY = 'That task changed since I asked — please try again.'

type ConfirmAction = Extract<PendingAction, { kind: 'confirm' }>
type DisambiguateAction = Extract<PendingAction, { kind: 'disambiguate' }>

// ─── Prompt building (shared with intents/update.ts + intents/delete.ts) ──────

function describePatch(patch: TaskPatch): string {
  const parts: string[] = []
  if (patch.priority !== undefined) parts.push(`P${patch.priority}`)
  if (patch.domain !== undefined) parts.push(patch.domain)
  if (patch.project !== undefined) parts.push(patch.project)
  if (patch.done_when !== undefined) parts.push(patch.done_when)
  return parts.join(', ')
}

/**
 * The exact-change confirm prompt (ADR-0013 Decision 3): "Delete '<title>'
 * from <domain-or-Inbox>? (y/n)" for delete, "Set '<title>' to <patch-in-
 * words>? (y/n)" / "Mark '<title>' done? (y/n)" for update.
 */
export function buildConfirmPrompt(intent: 'update' | 'delete', match: MatchedTask, patch?: TaskPatch): string {
  const title = match.task.title

  if (intent === 'delete') {
    const domainLabel = match.task.domain ?? 'Inbox'
    return `Delete '${title}' from ${domainLabel}? (y/n)`
  }

  if (patch?.mark_done !== undefined) {
    return patch.mark_done ? `Mark '${title}' done? (y/n)` : `Mark '${title}' not done? (y/n)`
  }

  return `Set '${title}' to ${describePatch(patch ?? {})}? (y/n)`
}

function formatCandidateLine(index: number, m: MatchedTask): string {
  const domainLabel = m.task.domain ?? 'Inbox'
  const doneWhenSegment = m.task.done_when ? ` · ${m.task.done_when}` : ''
  return `${index + 1}. ${m.task.title} · ${domainLabel}${doneWhenSegment}`
}

/** Numbered disambiguation list (ADR-0013 Decision 2), capped by the caller (taskMatch.ts's MAX_CANDIDATES). */
export function buildDisambiguatePrompt(candidates: MatchedTask[]): string {
  const lines = candidates.map((m, i) => formatCandidateLine(i, m))
  return [...lines, 'Reply with a number to pick.'].join('\n')
}

// ─── Commit-time patch application (mirrors VaultSync.update's patch rules) ───

function applyPatch(task: Task, patch: TaskPatch | undefined): Task {
  const updated: Task = { ...task }
  if (!patch) return updated

  if (patch.mark_done !== undefined) {
    updated.done = patch.mark_done
    if (patch.mark_done) {
      updated.completed_at = Date.now()
    } else {
      delete updated.completed_at
    }
  }

  if (patch.priority !== undefined) updated.priority = patch.priority
  if (patch.done_when !== undefined) updated.done_when = patch.done_when
  if (patch.domain !== undefined) updated.domain = patch.domain
  if (patch.project !== undefined) updated.project = patch.project

  return updated
}

function buildResultReply(intent: 'update' | 'delete', task: Task, patch: TaskPatch | undefined): string {
  if (intent === 'delete') return `✓ deleted '${task.title}'`
  if (patch?.mark_done !== undefined) {
    return patch.mark_done ? `✓ marked '${task.title}' done` : `✓ marked '${task.title}' not done`
  }
  return `✓ updated '${task.title}'`
}

/** Indices of lines exactly equal to `target` (mirrors VaultSync.ts's matchIndices). */
function matchLineIndices(lines: string[], target: string): number[] {
  const out: number[] = []
  for (let i = 0; i < lines.length; i++) if (lines[i] === target) out.push(i)
  return out
}

const PICK_PATTERN = /^\d+$/

function parsePick(normalized: string, max: number): number | null {
  if (!PICK_PATTERN.test(normalized)) return null
  const n = Number(normalized)
  return n >= 1 && n <= max ? n : null
}

// ─── The gate ──────────────────────────────────────────────────────────────

/**
 * Resolves one incoming message against this chat's pending confirmation
 * state. Returns null when there is none (router falls through to NLU as
 * today); otherwise the message was consumed and the returned string is the
 * reply to send back.
 */
export async function resolvePending(chatId: string, text: string, ctx: BotContext): Promise<string | null> {
  const action = getPending(chatId)
  if (!action) return null

  const normalized = text.trim().toLowerCase()

  if (action.kind === 'disambiguate') {
    return handleDisambiguatePick(chatId, normalized, action)
  }

  return handleConfirmDecision(chatId, normalized, action, ctx)
}

function handleDisambiguatePick(chatId: string, normalized: string, action: DisambiguateAction): string {
  const pick = parsePick(normalized, action.candidates.length)

  if (pick === null) {
    // Not a recognized reply — leave state untouched, re-send the list.
    return buildDisambiguatePrompt(action.candidates)
  }

  const match = action.candidates[pick - 1]!
  // Transition disambiguate -> confirm (ADR-0013 Decision 2): every commit
  // still goes through an explicit y/n, even after picking from a list.
  setPending(chatId, {
    kind: 'confirm',
    intent: action.intent,
    match,
    patch: action.patch,
    promptedAt: Date.now(),
  })

  return buildConfirmPrompt(action.intent, match, action.patch)
}

async function handleConfirmDecision(
  chatId: string,
  normalized: string,
  action: ConfirmAction,
  ctx: BotContext,
): Promise<string> {
  if (normalized === 'y' || normalized === 'yes') {
    return commit(chatId, action, ctx)
  }

  if (normalized === 'n' || normalized === 'no' || normalized === 'cancel') {
    clearPending(chatId)
    return CANCELLED_REPLY
  }

  // Not a recognized reply — leave state untouched, re-send the same prompt.
  return buildConfirmPrompt(action.intent, action.match, action.patch)
}

async function commit(chatId: string, action: ConfirmAction, ctx: BotContext): Promise<string> {
  const { match, intent, patch } = action

  // Re-read fresh — the file may have changed since the prompt was sent
  // (ADR-0013 Decision 2's commit-time re-match).
  const files = await ctx.vaultTransport.readFiles()
  const fileEntry = files.find((f) => f.path === match.path)
  const content = fileEntry?.content ?? ''
  const lines = content.split('\n')
  const hits = matchLineIndices(lines, match.rawLine)

  if (hits.length !== 1) {
    clearPending(chatId)
    return STALE_REPLY
  }

  const lineIndex = hits[0]!

  if (intent === 'delete') {
    lines.splice(lineIndex, 1)
  } else {
    const updatedTask = applyPatch(match.task, patch)
    lines[lineIndex] = serializeTaskLine(updatedTask)
  }

  const newContent = lines.join('\n')
  await ctx.vaultTransport.writeFile(match.path, newContent, `${intent} task: ${match.task.id}`)

  clearPending(chatId)
  return buildResultReply(intent, match.task, patch)
}
