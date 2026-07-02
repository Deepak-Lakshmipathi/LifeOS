/**
 * intents/create — the create intent handler (S16b, ADR-0011 Decision 4).
 *
 * Self-registers into the shared registry as a side effect of being imported
 * (via intents/index.ts). First registered handler — the pattern S17/S18/S19
 * extend without editing this file or the registry.
 *
 * Builds a Task using the same validation LocalOnly/VaultSync already apply
 * (trim title, reject empty; validate priority membership), resolves the
 * vault file path via the same domain+project rules as VaultSync.add
 * (vaultPath.ts — replicated, not imported; VaultSync.ts is out of scope),
 * then serializes via the EXISTING, UNMODIFIED serializeTaskLine
 * (src/vault/serialize.ts) — imported, never reimplemented. Every task the
 * bot creates carries a durable id:: for free (S16a).
 */

import { registerIntentHandler } from './registry'
import type { BotContext, IntentHandler } from './types'
import type { Task } from '../../../src/types'
import { serializeTaskLine } from '../../../src/vault/serialize'
import { resolveVaultFilePath } from '../vaultPath'
import { buildCreateReply } from '../reply'

/** Params shape produced by nlu.ts's classifyAndExtract for a 'create' intent. */
export interface CreateParams {
  title?: string
  domain?: string
  project?: string
  done_when?: string
  priority?: 1 | 2 | 3
}

const isValidPriority = (p: number): p is 1 | 2 | 3 => p === 1 || p === 2 || p === 3

const UNCLEAR_REPLY = "Couldn't tell what to create from that — try again with a clearer task."

export async function handleCreate(params: unknown, ctx: BotContext): Promise<string> {
  const input = (params ?? {}) as CreateParams

  const trimmedTitle = input.title?.trim()
  if (!trimmedTitle) return UNCLEAR_REPLY

  if (input.priority !== undefined && !isValidPriority(input.priority)) {
    return UNCLEAR_REPLY
  }

  const task: Task = {
    id: crypto.randomUUID(),
    title: trimmedTitle,
    done: false,
    created_at: Date.now(),
  }

  const doneWhen = input.done_when?.trim()
  if (doneWhen) task.done_when = doneWhen

  if (input.priority !== undefined) task.priority = input.priority

  const project = input.project?.trim()
  if (project) task.project = project

  // nlu.ts already gates domain through isDomain() before this handler ever
  // sees it, so no re-validation here — an already-normalized valid domain
  // string, or nothing (Inbox fallback).
  const domain = input.domain?.trim()
  if (domain) task.domain = domain

  const filePath = resolveVaultFilePath(task.domain, task.project)
  const files = await ctx.vaultTransport.readFiles()
  const current = files.find((f) => f.path === filePath)?.content ?? ''

  const newLine = serializeTaskLine(task)
  // Trailing-newline discipline mirrors VaultSync.add — every task starts on
  // its own line.
  const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : ''
  const newContent = current + separator + newLine + '\n'

  await ctx.vaultTransport.writeFile(filePath, newContent, `add task: ${task.title}`)

  return buildCreateReply(task)
}

export const createHandler: IntentHandler = {
  name: 'create',
  handle: handleCreate,
}

registerIntentHandler(createHandler)
