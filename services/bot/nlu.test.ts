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

  it('maps an "update" extraction with target_reference and mark_done into the expected shape', async () => {
    const client = fakeClaudeClient({
      intent: 'update',
      target_reference: 'call the CA about GST',
      mark_done: true,
    })

    const result = await classifyAndExtract(client, 'mark call the CA about GST as done')

    expect(result).toEqual({
      intent: 'update',
      target_reference: 'call the CA about GST',
      mark_done: true,
    })
  })

  it('maps an "update" extraction carrying a priority patch', async () => {
    const client = fakeClaudeClient({
      intent: 'update',
      target_reference: 'the GST thing',
      priority: 3,
    })

    const result = await classifyAndExtract(client, 'change the GST thing to high priority')

    expect(result).toEqual({
      intent: 'update',
      target_reference: 'the GST thing',
      priority: 3,
    })
  })

  it('maps an "update" extraction with a domain hint used to narrow the search', async () => {
    const client = fakeClaudeClient({
      intent: 'update',
      target_reference: 'the GST thing',
      domain: 'Finance',
      mark_done: true,
    })

    const result = await classifyAndExtract(client, 'mark the GST thing in Finance as done')

    expect(result).toEqual({
      intent: 'update',
      target_reference: 'the GST thing',
      domain: 'Finance',
      mark_done: true,
    })
  })

  it('maps a "delete" extraction with target_reference into the expected shape', async () => {
    const client = fakeClaudeClient({ intent: 'delete', target_reference: 'GST registration' })

    const result = await classifyAndExtract(client, 'delete GST registration')

    expect(result).toEqual({ intent: 'delete', target_reference: 'GST registration' })
  })

  it('drops an unrecognized domain from an update extraction (same normalization as create)', async () => {
    const client = fakeClaudeClient({
      intent: 'update',
      target_reference: 'fix the faucet',
      domain: 'Home Improvement', // not a canonical domain
    })

    const result = await classifyAndExtract(client, 'move fix the faucet out of that other thing')

    expect(result.intent).toBe('update')
    expect(result.domain).toBeUndefined()
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
