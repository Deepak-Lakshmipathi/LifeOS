/**
 * intents/delete — the delete intent handler (S17, ADR-0013 Decision 4).
 *
 * Self-registers into the shared registry as a side effect of being
 * imported (via intents/index.ts), mirroring create.ts's shape exactly.
 *
 * Never mutates the vault directly: finds the target task (taskMatch.ts)
 * and calls setPending with a 'confirm' or 'disambiguate' action, returning
 * the prompt text. The actual removal happens exclusively in
 * confirm/gate.ts's resolvePending on a confirmed "y".
 */

import { registerIntentHandler } from './registry'
import type { BotContext, IntentHandler } from './types'
import { classifyMatches, tasksFromFiles } from '../taskMatch'
import { setPending, clearPending } from '../confirm/store'
import { buildConfirmPrompt, buildDisambiguatePrompt } from '../confirm/gate'

/** Params shape produced by nlu.ts's classifyAndExtract for a 'delete' intent. */
export interface DeleteParams {
  target_reference?: string
  domain?: string
}

const UNCLEAR_REPLY = "Couldn't tell which task to delete from that — try again with a clearer reference."
const NO_MATCH_REPLY = "Couldn't find a task matching that."

export async function handleDelete(params: unknown, ctx: BotContext): Promise<string> {
  const input = (params ?? {}) as DeleteParams

  const targetRef = input.target_reference?.trim()
  if (!targetRef) return UNCLEAR_REPLY

  // nlu.ts already gates domain through isDomain() before this handler ever
  // sees it (same normalization create.ts relies on) — used only as a
  // search-narrowing hint here, delete has no patch to apply.
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
      intent: 'delete',
      match: result.match,
      promptedAt: Date.now(),
    })
    return buildConfirmPrompt('delete', result.match)
  }

  setPending(ctx.chatId, {
    kind: 'disambiguate',
    intent: 'delete',
    candidates: result.candidates,
  })
  return buildDisambiguatePrompt(result.candidates)
}

export const deleteHandler: IntentHandler = {
  name: 'delete',
  handle: handleDelete,
}

registerIntentHandler(deleteHandler)
