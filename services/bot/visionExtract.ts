/**
 * visionExtract — Claude vision task extraction from a Telegram photo
 * (S19a, ADR-0012 Decisions 1, 2, 5).
 *
 * One single-turn vision call per photo, model pinned to `claude-sonnet-5`
 * (imported from nlu.ts — one seam for "the Claude model the bot talks to"),
 * using the same `output_config.format` json_schema structured-output
 * mechanism nlu.ts uses for text extraction. A photo never enters intent
 * classification (there is nothing to classify — extraction produces tasks
 * directly), so the per-task shape here mirrors nlu.ts's fields minus `intent`.
 *
 * Domain/priority normalization mirrors nlu.ts's normalize() exactly: an
 * unrecognized domain or out-of-range priority is dropped (undefined), not
 * treated as a reason to discard the whole task.
 */

import { isDomain } from '../../src/data/domains'
import { CLAUDE_MODEL, type ClaudeClient } from './nlu'

const MAX_TASKS = 20

/** The structured-output shape this module extracts and normalizes, per task. */
export interface ExtractedTask {
  title: string
  domain?: string
  project?: string
  done_when?: string
  priority?: 1 | 2 | 3
}

/** Raw shape of one task as returned by Claude's structured output, before normalization. */
interface RawTask {
  title?: string
  domain?: string
  project?: string
  done_when?: string
  priority?: number
}

interface RawExtraction {
  tasks?: RawTask[]
}

const TASKS_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      maxItems: MAX_TASKS,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          domain: { type: 'string' },
          project: { type: 'string' },
          done_when: { type: 'string' },
          priority: { type: 'integer', enum: [1, 2, 3] },
        },
        required: ['title'],
        additionalProperties: false,
      },
    },
  },
  required: ['tasks'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You read a photo sent to a personal task-tracking bot — a whiteboard, a receipt, a
handwritten list, or a screenshot — and extract zero or more discrete tasks implied by its contents.

For each task, extract:
- title: the task itself, required.
- domain: one of exactly these 7 values if confidently implied — "Building Things", "Career",
  "Growth", "Life Admin", "Body & Mind", "Finance", "Relationship" — omit if not confidently implied.
- project: a short project name if implied, else omit.
- done_when: the finish-line / acceptance criterion if stated, else omit.
- priority: 1-3 (3 = highest) only if stated or strongly implied, else omit.

Return at most ${MAX_TASKS} tasks. If the image contains no discernible tasks, return an empty list.`

const isValidPriority = (p: number): p is 1 | 2 | 3 => p === 1 || p === 2 || p === 3

/**
 * Extracts and normalizes zero or more tasks from a photo via Claude vision.
 * Never throws on a malformed/missing response or a Claude API error — always
 * returns an array (possibly empty).
 */
export async function extractTasksFromImage(
  client: ClaudeClient,
  image: { data: Buffer; mediaType: string },
  caption?: string,
): Promise<ExtractedTask[]> {
  let promptText = 'Extract the tasks implied by this photo.'
  if (caption !== undefined) {
    promptText += `\n\nThe user's caption for this photo: "${caption}"`
  }

  let response: { content: Array<{ type: string; text?: string }> }
  try {
    response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image.mediaType,
                data: image.data.toString('base64'),
              },
            },
            { type: 'text', text: promptText },
          ],
        },
      ],
      output_config: { format: { type: 'json_schema', schema: TASKS_SCHEMA } },
    })
  } catch {
    return []
  }

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock?.text) return []

  let raw: RawExtraction
  try {
    raw = JSON.parse(textBlock.text) as RawExtraction
  } catch {
    return []
  }

  if (!Array.isArray(raw.tasks)) return []

  return raw.tasks.map(normalize).filter((task): task is ExtractedTask => task !== undefined).slice(0, MAX_TASKS)
}

/** Maps one raw structured-output task into the normalized ExtractedTask shape, or undefined if invalid. */
function normalize(raw: RawTask): ExtractedTask | undefined {
  if (!raw.title) return undefined

  const result: ExtractedTask = { title: raw.title }

  if (raw.domain !== undefined && isDomain(raw.domain)) result.domain = raw.domain
  if (raw.project !== undefined) result.project = raw.project
  if (raw.done_when !== undefined) result.done_when = raw.done_when
  if (raw.priority !== undefined && isValidPriority(raw.priority)) result.priority = raw.priority

  return result
}
