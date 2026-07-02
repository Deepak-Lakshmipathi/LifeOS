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

export type Intent = 'create' | 'other'

/** The structured-output shape this module extracts and normalizes. */
export interface ExtractedParams {
  intent: Intent
  title?: string
  domain?: string
  project?: string
  done_when?: string
  priority?: 1 | 2 | 3
}

/** Raw shape returned by Claude's structured output, before normalization. */
interface RawExtraction {
  intent: string
  title?: string
  domain?: string
  project?: string
  done_when?: string
  priority?: number
}

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['create', 'other'] },
    title: { type: 'string' },
    domain: { type: 'string' },
    project: { type: 'string' },
    done_when: { type: 'string' },
    priority: { type: 'integer', enum: [1, 2, 3] },
  },
  required: ['intent'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You classify a single free-text message sent to a personal task-tracking bot.

Classify "intent" as "create" when the message describes a new task to capture, or "other" for
anything else (edits, deletes, questions, small talk, or anything unclear) — the bot only supports
creating tasks right now.

For a "create" intent, extract:
- title: the task itself, required.
- domain: one of exactly these 7 values if confidently implied — "Building Things", "Career",
  "Growth", "Life Admin", "Body & Mind", "Finance", "Relationship" — omit if not confidently implied.
- project: a short project name if implied, else omit.
- done_when: the finish-line / acceptance criterion if stated, else omit.
- priority: 1-3 (3 = highest) only if stated or strongly implied, else omit.`

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

/** Maps raw structured-output JSON into the normalized ExtractedParams shape. */
function normalize(raw: RawExtraction): ExtractedParams {
  if (raw.intent !== 'create') return { intent: 'other' }

  const result: ExtractedParams = { intent: 'create' }

  if (raw.title !== undefined) result.title = raw.title
  if (raw.domain !== undefined && isDomain(raw.domain)) result.domain = raw.domain
  if (raw.project !== undefined) result.project = raw.project
  if (raw.done_when !== undefined) result.done_when = raw.done_when
  if (raw.priority !== undefined && isValidPriority(raw.priority)) result.priority = raw.priority

  return result
}
