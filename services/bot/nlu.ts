/**
 * nlu — Claude intent classification + extraction (S16b, ADR-0011 Decision 3 /
 * PRD "NLU: Claude, structured output").
 *
 * One single-turn call per incoming text message, model pinned to
 * `claude-sonnet-5`, using a JSON-schema-constrained structured output
 * (output_config.format) — deliberately a separate mechanism from S12's
 * regex parseCapture; do not import or couple to it.
 *
 * Domain normalization happens here (not in the intent handler): an extracted
 * domain that doesn't confidently match one of the 7 canonical domains is
 * dropped (mapped to undefined), matching how VaultSync.add/update already
 * normalize an invalid domain string to undefined — the create handler then
 * falls back to Inbox exactly as it would for any other domain-less task.
 */

import Anthropic from '@anthropic-ai/sdk'
import { isDomain } from '../../src/data/domains'

export const CLAUDE_MODEL = 'claude-sonnet-5'

export type Intent = 'create' | 'update' | 'delete' | 'other'

/** The structured-output shape this module extracts and normalizes. */
export interface ExtractedParams {
  intent: Intent
  title?: string
  domain?: string
  project?: string
  done_when?: string
  priority?: 1 | 2 | 3
  /** Free-text description of which task an update/delete refers to (S17, ADR-0013). */
  target_reference?: string
  /** Set when the message asks to mark a task done/not-done (S17, ADR-0013 — update only). */
  mark_done?: boolean
}

/** Raw shape returned by Claude's structured output, before normalization. */
interface RawExtraction {
  intent: string
  title?: string
  domain?: string
  project?: string
  done_when?: string
  priority?: number
  target_reference?: string
  mark_done?: boolean
}

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['create', 'update', 'delete', 'other'] },
    title: { type: 'string' },
    domain: { type: 'string' },
    project: { type: 'string' },
    done_when: { type: 'string' },
    priority: { type: 'integer', enum: [1, 2, 3] },
    target_reference: { type: 'string' },
    mark_done: { type: 'boolean' },
  },
  required: ['intent'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You classify a single free-text message sent to a personal task-tracking bot.

Classify "intent" as:
- "create" when the message describes a new task to capture.
- "update" when the message asks to change an existing task — mark it done/not-done, change its
  priority, domain, project, or its done_when criterion (e.g. "mark X done", "change X priority").
- "delete" when the message asks to remove an existing task (e.g. "delete X").
- "other" for anything else (questions, small talk, or anything unclear).

For a "create" intent, extract:
- title: the task itself, required.
- domain: one of exactly these 7 values if confidently implied — "Building Things", "Career",
  "Growth", "Life Admin", "Body & Mind", "Finance", "Relationship" — omit if not confidently implied.
- project: a short project name if implied, else omit.
- done_when: the finish-line / acceptance criterion if stated, else omit.
- priority: 1-3 (3 = highest) only if stated or strongly implied, else omit.

For an "update" or "delete" intent, extract:
- target_reference: a short free-text description of which task the message refers to (e.g. "the
  GST thing", "call CA"), required.
- domain: one of the 7 canonical domains above, only if the message confidently names the task's
  domain (e.g. "the GST thing in Finance") — narrows the search, else omit.

For an "update" intent only, additionally extract whichever of these the message implies as the
change to make (omit any not confidently implied):
- mark_done: true when the message asks to mark the task done, false when it asks to mark it not
  done.
- priority: the new priority, 1-3 (3 = highest).
- done_when: the new finish-line / acceptance criterion.
- project: the new project name.
Renaming a task's title is not supported — never extract "title" for an "update" intent.`

/** Minimal Anthropic client surface this module needs — lets tests inject a fake. */
export interface ClaudeClient {
  messages: {
    create(params: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string }> }>
  }
}

export function createClaudeClient(apiKey: string): ClaudeClient {
  // The real SDK's messages.create has a richer, overloaded signature than
  // the minimal ClaudeClient interface — this cast is the intentional seam
  // boundary (mirrors how tests inject a fake satisfying the same narrow
  // interface, never the real Anthropic type).
  return new Anthropic({ apiKey }) as unknown as ClaudeClient
}

const isValidPriority = (p: number): p is 1 | 2 | 3 => p === 1 || p === 2 || p === 3

/**
 * Classify one message's intent and, for "create", extract + normalize the
 * task fields. Never throws on malformed model output — falls back to
 * `{ intent: 'other' }`, which the router maps to "not yet supported".
 */
export async function classifyAndExtract(client: ClaudeClient, text: string): Promise<ExtractedParams> {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: text }],
    output_config: { format: { type: 'json_schema', schema: INTENT_SCHEMA } },
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock?.text) return { intent: 'other' }

  let raw: RawExtraction
  try {
    raw = JSON.parse(textBlock.text) as RawExtraction
  } catch {
    return { intent: 'other' }
  }

  return normalize(raw)
}

/**
 * Maps raw structured-output JSON into the normalized ExtractedParams shape.
 * create/update/delete share one normalization pass — each intent's handler
 * reads only the fields it cares about (ADR-0013 "nlu.ts schema growth": the
 * same flat schema does double duty by intent, rather than growing two
 * near-duplicate field sets).
 */
function normalize(raw: RawExtraction): ExtractedParams {
  if (raw.intent !== 'create' && raw.intent !== 'update' && raw.intent !== 'delete') {
    return { intent: 'other' }
  }

  const result: ExtractedParams = { intent: raw.intent }

  if (raw.title !== undefined) result.title = raw.title
  if (raw.domain !== undefined && isDomain(raw.domain)) result.domain = raw.domain
  if (raw.project !== undefined) result.project = raw.project
  if (raw.done_when !== undefined) result.done_when = raw.done_when
  if (raw.priority !== undefined && isValidPriority(raw.priority)) result.priority = raw.priority
  if (raw.target_reference !== undefined) result.target_reference = raw.target_reference
  if (raw.mark_done !== undefined) result.mark_done = raw.mark_done

  return result
}
