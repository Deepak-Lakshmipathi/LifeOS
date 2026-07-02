import { describe, expect, it, vi } from 'vitest'
import { extractTasksFromImage } from './visionExtract'
import type { ClaudeClient } from './nlu'

/** Builds a fake ClaudeClient whose messages.create resolves with the given JSON payload as a text block. */
function fakeClaudeClient(payload: unknown): ClaudeClient {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      }),
    },
  }
}

const IMAGE = { data: Buffer.from('fake-image-bytes'), mediaType: 'image/jpeg' }

describe('extractTasksFromImage', () => {
  it('builds a vision request (image content block, pinned model, structured output) and parses a multi-task response', async () => {
    const client = fakeClaudeClient({
      tasks: [
        { title: 'Renew passport', domain: 'Life Admin', priority: 2 },
        { title: 'Call plumber' },
        { title: 'Book dentist', domain: 'Body & Mind', priority: 1 },
      ],
    })

    const result = await extractTasksFromImage(client, IMAGE)

    expect(result).toEqual([
      { title: 'Renew passport', domain: 'Life Admin', priority: 2 },
      { title: 'Call plumber' },
      { title: 'Book dentist', domain: 'Body & Mind', priority: 1 },
    ])

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-5',
        output_config: expect.objectContaining({
          format: expect.objectContaining({ type: 'json_schema' }),
        }),
        messages: [
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({
                type: 'image',
                source: expect.objectContaining({
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: IMAGE.data.toString('base64'),
                }),
              }),
            ]),
          }),
        ],
      }),
    )
  })

  it('includes the caption text in the prompt sent to Claude when provided', async () => {
    const client = fakeClaudeClient({ tasks: [] })

    await extractTasksFromImage(client, IMAGE, 'weekend chores')

    const call = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const userContent = call.messages[0].content as Array<{ type: string; text?: string }>
    const textBlock = userContent.find((block) => block.type === 'text')

    expect(textBlock?.text).toContain('weekend chores')
  })

  it('returns [] and never throws when the model returns unparseable JSON', async () => {
    const client: ClaudeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] }),
      },
    }

    const result = await extractTasksFromImage(client, IMAGE)

    expect(result).toEqual([])
  })

  it('returns [] when the model returns no text block', async () => {
    const client: ClaudeClient = {
      messages: { create: vi.fn().mockResolvedValue({ content: [] }) },
    }

    const result = await extractTasksFromImage(client, IMAGE)

    expect(result).toEqual([])
  })

  it('returns [] and never throws when the Claude API call itself rejects', async () => {
    const client: ClaudeClient = {
      messages: { create: vi.fn().mockRejectedValue(new Error('image too large')) },
    }

    const result = await extractTasksFromImage(client, IMAGE)

    expect(result).toEqual([])
  })

  it('drops an unrecognized domain and an out-of-range priority without discarding the task', async () => {
    const client = fakeClaudeClient({
      tasks: [{ title: 'Fix the leaky faucet', domain: 'Home Improvement', priority: 9 }],
    })

    const result = await extractTasksFromImage(client, IMAGE)

    expect(result).toEqual([{ title: 'Fix the leaky faucet' }])
  })

  it('filters out tasks with an empty/missing title', async () => {
    const client = fakeClaudeClient({
      tasks: [{ title: '' }, { domain: 'Finance' }, { title: 'Valid task' }],
    })

    const result = await extractTasksFromImage(client, IMAGE)

    expect(result).toEqual([{ title: 'Valid task' }])
  })

  it('truncates a response with more than 20 tasks to the first 20', async () => {
    const tasks = Array.from({ length: 25 }, (_, i) => ({ title: `Task ${i + 1}` }))
    const client = fakeClaudeClient({ tasks })

    const result = await extractTasksFromImage(client, IMAGE)

    expect(result).toHaveLength(20)
    expect(result[0]).toEqual({ title: 'Task 1' })
    expect(result[19]).toEqual({ title: 'Task 20' })
  })
})
