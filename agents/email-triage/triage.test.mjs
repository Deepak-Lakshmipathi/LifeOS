/**
 * triage.test.mjs — S38 DoD coverage for agents/email-triage/triage.mjs.
 *
 * Fixture Gmail messages + a mocked classify function -> assert
 * attention.md round-trips through the REAL S36 parser
 * (src/vault/mail.ts's parseAttention) losslessly (DoD #1); classify is a
 * mockable seam and no test hits the network (DoD #2); commit/push writes
 * ONLY Mail/attention.md + drafts with the lifeos-email-triage author (DoD
 * #3); draft files are created only when the classifier says needsDraft
 * with a non-empty body (DoD #4). Zero live network, zero live git — same
 * convention as agents/calendar-sync/sync.test.mjs.
 */
import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseAttention } from '../../src/vault/mail.ts'
import {
  buildAttentionItem,
  renderAttentionMarkdown,
  exchangeRefreshToken,
  fetchAttentionMessages,
  classifyThread,
  run,
  COMMIT_AUTHOR,
} from './triage.mjs'

const NOW = new Date('2026-07-18T12:00:00Z')

/** Fixture Gmail message summaries, as fetchAttentionMessages would return them. */
const THREADS = [
  {
    id: 'msg-1',
    from: 'meera@northstar.io',
    subject: 'Revised quote for NorthStar handoff',
    snippet: 'Could you send over a revised quote by Friday?',
    internalDate: NOW.getTime() - 26 * 3_600_000, // 26h ago
    isUnread: true,
    isStarred: false,
  },
  {
    id: 'msg-2',
    from: 'alerts@bescom.in',
    subject: 'Electricity bill ₹2,340 due',
    snippet: 'Your bill is due soon.',
    internalDate: NOW.getTime() - 72 * 3_600_000, // 3d ago
    isUnread: true,
    isStarred: false,
  },
  {
    id: 'msg-3',
    from: 'system',
    subject: 'Calendar sync agent failed to run',
    snippet: 'Run failed with a non-retryable push error.',
    internalDate: NOW.getTime() - 12 * 3_600_000,
    isUnread: false,
    isStarred: true,
  },
]

/** Builds a mocked classify() matching THREADS by message id. */
function fakeClassify(byId) {
  return vi.fn(async ({ thread }) => byId[thread.id] ?? { label: 'other', urgent: false, needsDraft: false })
}

describe('buildAttentionItem — Gmail thread + classification -> S36 AttentionItem shape (pure)', () => {
  it('maps a needsDraft classification into a title, label, from, waitingHours, and draft pointer', () => {
    const item = buildAttentionItem(
      THREADS[0],
      { label: 'client-money', urgent: true, needsDraft: true, draftBody: 'Sure — quote attached.' },
      NOW,
    )
    expect(item).toEqual({
      title: 'Revised quote for NorthStar handoff',
      label: 'client-money',
      from: 'meera@northstar.io',
      waitingHours: 26,
      urgent: true,
      handled: false,
      draftPath: 'Mail/drafts/2026-07-18-revised-quote-for-northstar-handoff.md',
      draftBody: 'Sure — quote attached.',
    })
  })

  it('never sets a draft pointer when needsDraft is false', () => {
    const item = buildAttentionItem(THREADS[1], { label: 'bill', urgent: false, needsDraft: false }, NOW)
    expect(item.draftPath).toBeUndefined()
    expect(item.draftBody).toBeUndefined()
  })

  it('does not trust needsDraft:true with an empty/missing draftBody (defensive re-validation, DoD #4)', () => {
    const item1 = buildAttentionItem(THREADS[0], { label: 'other', urgent: false, needsDraft: true }, NOW)
    expect(item1.draftPath).toBeUndefined()

    const item2 = buildAttentionItem(
      THREADS[0],
      { label: 'other', urgent: false, needsDraft: true, draftBody: '   ' },
      NOW,
    )
    expect(item2.draftPath).toBeUndefined()
  })

  it('falls back to "other" for an unknown label and "(no subject)" for an empty subject', () => {
    const item = buildAttentionItem(
      { ...THREADS[0], subject: '' },
      { label: 'not-a-real-label', urgent: false, needsDraft: false },
      NOW,
    )
    expect(item.label).toBe('other')
    expect(item.title).toBe('(no subject)')
  })

  it('computes waitingHours from internalDate, never negative', () => {
    const future = buildAttentionItem(
      { ...THREADS[0], internalDate: NOW.getTime() + 3_600_000 },
      { label: 'other', urgent: false, needsDraft: false },
      NOW,
    )
    expect(future.waitingHours).toBe(0)
  })

  it('sanitizes newline injection in from/subject fields (defensive; DoD-adjacent field-syntax safety)', () => {
    const item = buildAttentionItem(
      { ...THREADS[0], subject: 'Subj\nline', from: 'a@b.com\n(label:: bill)' },
      { label: 'other', urgent: false, needsDraft: false },
      NOW,
    )
    expect(item.title).not.toContain('\n')
    expect(item.from).not.toContain('\n')
  })
})

describe('renderAttentionMarkdown + parseAttention — S36 contract roundtrip (DoD #1)', () => {
  it('sorts urgent-first, then longest-waiting first', () => {
    const items = [
      buildAttentionItem(THREADS[1], { label: 'bill', urgent: false, needsDraft: false }, NOW), // 72h, not urgent
      buildAttentionItem(THREADS[2], { label: 'agent-failure', urgent: true, needsDraft: false }, NOW), // 12h, urgent
      buildAttentionItem(
        THREADS[0],
        { label: 'client-money', urgent: true, needsDraft: true, draftBody: 'Quote attached.' },
        NOW,
      ), // 26h, urgent
    ]
    const markdown = renderAttentionMarkdown(items)
    const parsed = parseAttention(markdown)
    expect(parsed.map((i) => i.title)).toEqual([
      'Revised quote for NorthStar handoff', // urgent, 26h
      'Calendar sync agent failed to run', // urgent, 12h
      'Electricity bill ₹2,340 due', // not urgent, 72h
    ])
  })

  it('round-trips every field (label, from, waitingHours, draftPath) exactly through the REAL parser', () => {
    const items = [
      buildAttentionItem(
        THREADS[0],
        { label: 'client-money', urgent: true, needsDraft: true, draftBody: 'Quote attached.' },
        NOW,
      ),
      buildAttentionItem(THREADS[1], { label: 'bill', urgent: false, needsDraft: false }, NOW),
    ]
    const markdown = renderAttentionMarkdown(items)
    const parsed = parseAttention(markdown)

    expect(parsed).toEqual([
      {
        title: 'Revised quote for NorthStar handoff',
        label: 'client-money',
        from: 'meera@northstar.io',
        waitingHours: 26,
        draftPath: 'Mail/drafts/2026-07-18-revised-quote-for-northstar-handoff.md',
        handled: false,
      },
      {
        title: 'Electricity bill ₹2,340 due',
        label: 'bill',
        from: 'alerts@bescom.in',
        waitingHours: 72,
        handled: false,
      },
    ])
  })

  it('an empty item list still renders a parseable header-only file', () => {
    const markdown = renderAttentionMarkdown([])
    expect(markdown).toBe('# attention — written by email-triage\n')
    expect(parseAttention(markdown)).toEqual([])
  })
})

describe('exchangeRefreshToken — OAuth token exchange (mocked fetch, no network)', () => {
  it('posts the refresh grant and returns the access token', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(url).toBe('https://oauth2.googleapis.com/token')
      expect(init.method).toBe('POST')
      const body = new URLSearchParams(init.body)
      expect(body.get('grant_type')).toBe('refresh_token')
      return { ok: true, json: async () => ({ access_token: 'fake-access-token' }) }
    })
    const token = await exchangeRefreshToken({
      clientId: 'id',
      clientSecret: 'secret',
      refreshToken: 'refresh',
      fetchImpl,
    })
    expect(token).toBe('fake-access-token')
  })

  it('throws a clear error on a non-OK response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, text: async () => 'invalid_grant' }))
    await expect(
      exchangeRefreshToken({ clientId: 'x', clientSecret: 'y', refreshToken: 'z', fetchImpl }),
    ).rejects.toThrow(/401/)
  })

  it('requires all three credential fields', async () => {
    await expect(exchangeRefreshToken({ clientId: 'x' })).rejects.toThrow(/required/)
  })
})

describe('fetchAttentionMessages — Gmail list+get (mocked fetch, no network)', () => {
  it('queries unread/starred and maps message list + metadata into thread summaries', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes('/messages?')) {
        expect(url).toContain('is%3Aunread+OR+is%3Astarred')
        return { ok: true, json: async () => ({ messages: [{ id: 'msg-1' }] }) }
      }
      expect(url).toContain('/messages/msg-1?')
      return {
        ok: true,
        json: async () => ({
          id: 'msg-1',
          snippet: 'hello',
          internalDate: '1700000000000',
          labelIds: ['UNREAD'],
          payload: { headers: [{ name: 'From', value: 'a@b.com' }, { name: 'Subject', value: 'Hi' }] },
        }),
      }
    })
    const threads = await fetchAttentionMessages({ accessToken: 'tok', fetchImpl })
    expect(threads).toEqual([
      {
        id: 'msg-1',
        from: 'a@b.com',
        subject: 'Hi',
        snippet: 'hello',
        internalDate: 1700000000000,
        isUnread: true,
        isStarred: false,
      },
    ])
  })

  it('skips a message whose detail fetch fails, without failing the whole run', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes('/messages?')) {
        return { ok: true, json: async () => ({ messages: [{ id: 'bad' }, { id: 'good' }] }) }
      }
      if (url.includes('/messages/bad')) return { ok: false, status: 500, text: async () => 'boom' }
      return {
        ok: true,
        json: async () => ({ id: 'good', snippet: '', internalDate: '0', labelIds: [], payload: { headers: [] } }),
      }
    })
    const threads = await fetchAttentionMessages({ accessToken: 'tok', fetchImpl })
    expect(threads).toHaveLength(1)
    expect(threads[0].id).toBe('good')
  })

  it('requires accessToken', async () => {
    await expect(fetchAttentionMessages({})).rejects.toThrow(/required/)
  })
})

describe('classifyThread — Claude structured-output call (mocked fetch, no network — DoD #2)', () => {
  it('sends the pinned model + JSON-schema structured output config and parses the response', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(url).toBe('https://api.anthropic.com/v1/messages')
      const body = JSON.parse(init.body)
      expect(body.model).toBe('claude-sonnet-5')
      expect(body.output_config.format.type).toBe('json_schema')
      return {
        ok: true,
        json: async () => ({
          content: [
            { type: 'text', text: JSON.stringify({ label: 'bill', urgent: false, needsDraft: false }) },
          ],
        }),
      }
    })
    const result = await classifyThread({ apiKey: 'key', thread: THREADS[1], fetchImpl })
    expect(result).toEqual({ label: 'bill', urgent: false, needsDraft: false })
  })

  it('never throws on malformed model output — falls back to label:"other"', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'not json' }] }),
    }))
    const result = await classifyThread({ apiKey: 'key', thread: THREADS[0], fetchImpl })
    expect(result).toEqual({ label: 'other', urgent: false, needsDraft: false })
  })

  it('throws on a genuine API failure (non-2xx)', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 529, text: async () => 'overloaded' }))
    await expect(classifyThread({ apiKey: 'key', thread: THREADS[0], fetchImpl })).rejects.toThrow(/529/)
  })
})

describe('run — full pipeline (mocked fetch + injected classify/push, no live git — DoD #2/#3/#4)', () => {
  it('writes Mail/attention.md + only the drafts that needsDraft, commits with the email-triage author', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        return { ok: true, json: async () => ({ access_token: 'fake-access-token' }) }
      }
      if (url.includes('/messages?')) {
        return { ok: true, json: async () => ({ messages: THREADS.map((t) => ({ id: t.id })) }) }
      }
      const match = THREADS.find((t) => url.includes(`/messages/${t.id}?`))
      return {
        ok: true,
        json: async () => ({
          id: match.id,
          snippet: match.snippet,
          internalDate: String(match.internalDate),
          labelIds: [...(match.isUnread ? ['UNREAD'] : []), ...(match.isStarred ? ['STARRED'] : [])],
          payload: {
            headers: [
              { name: 'From', value: match.from },
              { name: 'Subject', value: match.subject },
            ],
          },
        }),
      }
    })

    const classify = fakeClassify({
      'msg-1': { label: 'client-money', urgent: true, needsDraft: true, draftBody: 'Quote attached, thanks!' },
      'msg-2': { label: 'bill', urgent: false, needsDraft: false },
      'msg-3': { label: 'agent-failure', urgent: true, needsDraft: false },
    })
    const push = vi.fn(async () => ({ ok: true, attempts: 1 }))

    const vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-email-triage-'))
    try {
      const result = await run({ vaultDir, fetchImpl, classify, push, now: NOW, clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' })

      expect(result.ok).toBe(true)
      expect(result.items).toHaveLength(3)
      expect(result.draftFiles).toEqual(['Mail/drafts/2026-07-18-revised-quote-for-northstar-handoff.md'])

      // attention.md round-trips through the real parser.
      const written = readFileSync(join(vaultDir, 'Mail', 'attention.md'), 'utf8')
      expect(parseAttention(written)).toHaveLength(3)

      // Draft file was created, with a non-empty body (DoD #4).
      const draftPath = join(vaultDir, 'Mail', 'drafts', '2026-07-18-revised-quote-for-northstar-handoff.md')
      expect(existsSync(draftPath)).toBe(true)
      const draftBody = readFileSync(draftPath, 'utf8')
      expect(draftBody).toContain('Quote attached, thanks!')
      expect(draftBody.trim().length).toBeGreaterThan(0)

      // No draft file for the two items that didn't need one.
      expect(existsSync(join(vaultDir, 'Mail', 'drafts', '2026-07-18-electricity-bill-2-340-due.md'))).toBe(false)

      // push() called ONLY with Mail/** paths and the email-triage author (DoD #3).
      expect(push).toHaveBeenCalledTimes(1)
      const [calledVaultDir, opts] = push.mock.calls[0]
      expect(calledVaultDir).toBe(vaultDir)
      expect(opts.files).toEqual([
        'Mail/attention.md',
        'Mail/drafts/2026-07-18-revised-quote-for-northstar-handoff.md',
      ])
      expect(opts.files.every((f) => f.startsWith('Mail/'))).toBe(true)
      expect(opts.author).toBe(COMMIT_AUTHOR)
      expect(opts.author).toContain('lifeos-email-triage')
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })

  it('skips a message whose classify call throws, without failing the whole run', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        return { ok: true, json: async () => ({ access_token: 'tok' }) }
      }
      if (url.includes('/messages?')) {
        return { ok: true, json: async () => ({ messages: [{ id: 'msg-2' }] }) }
      }
      return {
        ok: true,
        json: async () => ({
          id: 'msg-2',
          snippet: THREADS[1].snippet,
          internalDate: String(THREADS[1].internalDate),
          labelIds: ['UNREAD'],
          payload: {
            headers: [
              { name: 'From', value: THREADS[1].from },
              { name: 'Subject', value: THREADS[1].subject },
            ],
          },
        }),
      }
    })
    const classify = vi.fn(async () => {
      throw new Error('classify boom')
    })
    const push = vi.fn(async () => ({ ok: true, attempts: 1 }))
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})

    const vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-email-triage-'))
    try {
      const result = await run({ vaultDir, fetchImpl, classify, push, now: NOW, clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' })
      expect(result.items).toEqual([])
      expect(result.draftFiles).toEqual([])
      expect(parseAttention(readFileSync(join(vaultDir, 'Mail', 'attention.md'), 'utf8'))).toEqual([])
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
      consoleErr.mockRestore()
    }
  })

  it('requires vaultDir', async () => {
    await expect(run({})).rejects.toThrow(/required/)
  })
})
