/**
 * intents/update — the update intent handler (S17, ADR-0013 Decision 4).
 *
 * Self-registers into the shared registry as a side effect of being
 * imported (via intents/index.ts), mirroring create.ts's shape exactly.
 *
 * Never mutates the vault directly: finds the target task (taskMatch.ts),
 * builds the patch to apply, and calls setPending with a 'confirm' or
 * 'disambiguate' action, returning the prompt text. The actual write happens
 * exclusively in confirm/gate.ts's resolvePending on a confirmed "y".
 */

import { registerIntentHandler } from './registry'
import type { BotContext, IntentHandler } from './types'
import { classifyMatches, tasksFromFiles } from '../taskMatch'
import { setPending, clearPending, type TaskPatch } from '../confirm/store'
import { buildConfirmPrompt, buildDisambiguatePrompt } from '../confirm/gate'

/** Params shape produced by nlu.ts's classifyAndExtract for an 'update' intent. */
export interface UpdateParams {
  target_reference?: string
  domain?: string
  project?: string
  done_when?: string
  priority?: 1 | 2 | 3
  mark_done?: boolean
}

const isValidPriority = (p: number): p is 1 | 2 | 3 => p === 1 || p === 2 || p === 3

const UNCLEAR_REPLY = "Couldn't tell which task to update from that — try again with a clearer reference."
const NO_MATCH_REPLY = "Couldn't find a task matching that."

/** Builds the patch to apply from whichever update fields the NLU extraction confidently returned. */
function buildPatch(input: UpdateParams): TaskPatch {
  const patch: TaskPatch = {}

  if (input.mark_done !== undefined) patch.mark_done = input.mark_done
  if (input.priority !== undefined) patch.priority = input.priority

  const doneWhen = input.done_when?.trim()
  if (doneWhen) patch.done_when = doneWhen

  const project = input.project?.trim()
  if (project) patch.project = project

  // nlu.ts already gates domain through isDomain() before this handler ever
  // sees it (same normalization create.ts relies on), so no re-validation
  // here — used both as the search domainHint (below) and as the patch
  // value, per ADR-0013's "flat schema does double duty by intent" note.
  const domain = input.domain?.trim()
  if (domain) patch.domain = domain

  return patch
}

export async function handleUpdate(params: unknown, ctx: BotContext): Promise<string> {
  const input = (params ?? {}) as UpdateParams

  const targetRef = input.target_reference?.trim()
  if (!targetRef) return UNCLEAR_REPLY

  if (input.priority !== undefined && !isValidPriority(input.priority)) {
    return UNCLEAR_REPLY
  }

  const patch = buildPatch(input)
  if (Object.keys(patch).length === 0) return UNCLEAR_REPLY

  const domainHint = input.domain?.trim() || undefined
  const files = await ctx.vaultTransport.readFiles()
  const pool = tasksFromFiles(files)

  const result = classifyMatches(targetRef, pool, domainHint)

  if (result.kind === 'none') {
    clearPending(ctx.chatId)
    return NO_MATCH_REPLY
  }

  if (result.kind === 'confident') {
    setPending(ctx.chatId, {
      kind: 'confirm',
      intent: 'update',
      match: result.match,
      patch,
      promptedAt: Date.now(),
    })
    return buildConfirmPrompt('update', result.match, patch)
  }

  setPending(ctx.chatId, {
    kind: 'disambiguate',
    intent: 'update',
    candidates: result.candidates,
    patch,
  })
  return buildDisambiguatePrompt(result.candidates)
}

export const updateHandler: IntentHandler = {
  name: 'update',
  handle: handleUpdate,
}

registerIntentHandler(updateHandler)
