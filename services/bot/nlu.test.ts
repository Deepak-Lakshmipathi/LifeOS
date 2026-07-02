import { describe, expect, it, vi } from 'vitest'
import { classifyAndExtract, type ClaudeClient } from './nlu'

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

describe('classifyAndExtract', () => {
  it('maps a full create extraction into the expected shape', async () => {
    const client = fakeClaudeClient({
      intent: 'create',
      title: 'Call the CA about GST',
      domain: 'Finance',
      project: 'Taxes',
      done_when: 'CA confirms GST filing is done',
      priority: 3,
    })

    const result = await classifyAndExtract(client, 'call the CA about GST, taxes, high priority')

    expect(result).toEqual({
      intent: 'create',
      title: 'Call the CA about GST',
      domain: 'Finance',
      project: 'Taxes',
      done_when: 'CA confirms GST filing is done',
      priority: 3,
    })
  })

  it('maps a minimal create extraction (title only) into the expected shape', async () => {
    const client = fakeClaudeClient({ intent: 'create', title: 'Buy filters for the water purifier' })

    const result = await classifyAndExtract(client, 'buy filters for the water purifier')

    expect(result).toEqual({ intent: 'create', title: 'Buy filters for the water purifier' })
  })

  it('falls back to Inbox (domain undefined) when the extracted domain is not one of the 7 canonical domains', async () => {
    const client = fakeClaudeClient({
      intent: 'create',
      title: 'Fix the leaky faucet',
      domain: 'Home Improvement', // not a canonical domain
    })

    const result = await classifyAndExtract(client, 'fix the leaky faucet')

    expect(result.intent).toBe('create')
    expect(result.title).toBe('Fix the leaky faucet')
    expect(result.domain).toBeUndefined()
  })

  it('maps a non-create classification to { intent: "other" } only', async () => {
    const client = fakeClaudeClient({ intent: 'other' })

    const result = await classifyAndExtract(client, 'what tasks do I have today?')

    expect(result).toEqual({ intent: 'other' })
  })

  it('drops an out-of-range priority rather than propagating it', async () => {
    const client = fakeClaudeClient({ intent: 'create', title: 'Something', priority: 7 })

    const result = await classifyAndExtract(client, 'something, priority 7')

    expect(result.priority).toBeUndefined()
  })

  it('calls Claude with the pinned model and a JSON-schema structured output config', async () => {
    const client = fakeClaudeClient({ intent: 'other' })

    await classifyAndExtract(client, 'hello')

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-5',
        output_config: expect.objectContaining({
          format: expect.objectContaining({ type: 'json_schema' }),
        }),
      }),
    )
  })

  it('falls back to { intent: "other" } when the model returns no text block', async () => {
    const client: ClaudeClient = {
      messages: { create: vi.fn().mockResolvedValue({ content: [] }) },
    }

    const result = await classifyAndExtract(client, 'garbled')

    expect(result).toEqual({ intent: 'other' })
  })

  it('falls back to { intent: "other" } when the model returns unparseable JSON', async () => {
    const client: ClaudeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] }),
      },
    }

    const result = await classifyAndExtract(client, 'garbled')

    expect(result).toEqual({ intent: 'other' })
  })
})
