import { describe, expect, it } from 'vitest'
import { buildCreateReply } from './reply'

describe('buildCreateReply', () => {
  it('includes the priority segment when priority is set', () => {
    expect(buildCreateReply({ title: 'Call the CA about GST', domain: 'Finance', priority: 3 })).toBe(
      "✓ added 'Call the CA about GST' · Finance · P3",
    )
  })

  it('omits the priority segment entirely when priority is unset', () => {
    expect(buildCreateReply({ title: 'Buy filters for the water purifier', domain: 'Life Admin' })).toBe(
      "✓ added 'Buy filters for the water purifier' · Life Admin",
    )
  })

  it('falls back to Inbox when domain is unset', () => {
    expect(buildCreateReply({ title: 'Untitled scribble' })).toBe("✓ added 'Untitled scribble' · Inbox")
  })
})
