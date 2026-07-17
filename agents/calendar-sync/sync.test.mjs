/**
 * sync.test.mjs — S35 DoD coverage for agents/calendar-sync/sync.mjs.
 *
 * Mapper roundtrip only (per the S35 Tests section: "mocked-API mapper
 * roundtrip; no e2e"). A fixture-shaped Google Calendar API v3 response is
 * mapped to markdown, and that markdown is round-tripped through the REAL
 * S33 parser (src/vault/calendar.ts's parseCalendar) to prove it lands in
 * exactly the same events (DoD #1). Zero network, zero live git — the
 * commit/push step is exercised separately with an injected mock `push`
 * (DoD #2), never a real `commitAndPush`/git binary.
 */
import { describe, it, expect, vi } from 'vitest'
import { parseCalendar } from '../../src/vault/calendar.ts'
import {
  classifyType,
  formatTimeInZone,
  todayInZone,
  mapGcalItemsToEvents,
  eventsToMarkdown,
  exchangeRefreshToken,
  fetchTodayItems,
  run,
  COMMIT_AUTHOR,
} from './sync.mjs'

/** A Google Calendar API v3 `events.list` response fixture for one day. */
const GCAL_FIXTURE_ITEMS = [
  {
    summary: 'Gym — legs',
    start: { dateTime: '2026-07-14T08:00:00+05:30' },
    end: { dateTime: '2026-07-14T09:00:00+05:30' },
  },
  {
    summary: 'Client call — NorthStar handoff',
    start: { dateTime: '2026-07-14T10:00:00+05:30' },
    end: { dateTime: '2026-07-14T11:00:00+05:30' },
  },
  {
    summary: 'Deep work — Module 4',
    start: { dateTime: '2026-07-14T14:00:00+05:30' },
    end: { dateTime: '2026-07-14T16:00:00+05:30' },
  },
  // All-day event (only `date`, no `dateTime`) — must be skipped, no S33
  // representation exists for it.
  {
    summary: "Someone's birthday",
    start: { date: '2026-07-14' },
    end: { date: '2026-07-15' },
  },
  // Missing summary — must be skipped defensively, never thrown.
  {
    summary: '',
    start: { dateTime: '2026-07-14T18:00:00+05:30' },
    end: { dateTime: '2026-07-14T19:00:00+05:30' },
  },
]

describe('classifyType — keyword -> S33 CalEventType', () => {
  it('maps call-ish summaries to call', () => {
    expect(classifyType('Client call — NorthStar handoff')).toBe('call')
    expect(classifyType('Daily standup')).toBe('call')
    expect(classifyType('1:1 with manager')).toBe('call')
  })
  it('maps gym-ish summaries to gym', () => {
    expect(classifyType('Gym — legs')).toBe('gym')
    expect(classifyType('Morning workout')).toBe('gym')
  })
  it('maps deep-work-ish summaries to deep', () => {
    expect(classifyType('Deep work — Module 4')).toBe('deep')
    expect(classifyType('Focus block')).toBe('deep')
  })
  it('falls back to other for unmatched or missing summaries', () => {
    expect(classifyType('Lunch with Sam')).toBe('other')
    expect(classifyType('')).toBe('other')
    expect(classifyType(undefined)).toBe('other')
  })
})

describe('formatTimeInZone / todayInZone — pure time formatting', () => {
  it('formats an ISO datetime into zero-padded HH:MM in the given zone', () => {
    expect(formatTimeInZone('2026-07-14T08:00:00+05:30', 'Asia/Kolkata')).toBe('08:00')
    expect(formatTimeInZone('2026-07-14T14:00:00+05:30', 'Asia/Kolkata')).toBe('14:00')
  })
  it('derives the zone-local date from a fixed instant', () => {
    // 2026-07-14T20:00:00Z is 2026-07-15 01:30 IST — crosses midnight.
    expect(todayInZone('Asia/Kolkata', new Date('2026-07-14T20:00:00Z'))).toBe('2026-07-15')
  })
})

describe('mapGcalItemsToEvents — GCal items -> S33 CalEvent[]', () => {
  it('maps timed events, skips all-day and empty-summary events, sorted by start', () => {
    const events = mapGcalItemsToEvents(GCAL_FIXTURE_ITEMS, 'Asia/Kolkata')
    expect(events).toEqual([
      { start: '08:00', end: '09:00', title: 'Gym — legs', type: 'gym' },
      { start: '10:00', end: '11:00', title: 'Client call — NorthStar handoff', type: 'call' },
      { start: '14:00', end: '16:00', title: 'Deep work — Module 4', type: 'deep' },
    ])
  })

  it('never throws on malformed items (missing start/end, zero-length range)', () => {
    const malformed = [
      { summary: 'No start', end: { dateTime: '2026-07-14T09:00:00+05:30' } },
      { summary: 'No end', start: { dateTime: '2026-07-14T09:00:00+05:30' } },
      {
        summary: 'Zero-length',
        start: { dateTime: '2026-07-14T09:00:00+05:30' },
        end: { dateTime: '2026-07-14T09:00:00+05:30' },
      },
      null,
      undefined,
    ]
    expect(() => mapGcalItemsToEvents(malformed, 'Asia/Kolkata')).not.toThrow()
    expect(mapGcalItemsToEvents(malformed, 'Asia/Kolkata')).toEqual([])
  })

  it('handles an empty/undefined items list', () => {
    expect(mapGcalItemsToEvents([], 'Asia/Kolkata')).toEqual([])
    expect(mapGcalItemsToEvents(undefined, 'Asia/Kolkata')).toEqual([])
  })
})

describe('eventsToMarkdown + parseCalendar — S33 contract roundtrip (DoD #1)', () => {
  it('renders the fixture to the exact expected S33 markdown', () => {
    const events = mapGcalItemsToEvents(GCAL_FIXTURE_ITEMS, 'Asia/Kolkata')
    const markdown = eventsToMarkdown('2026-07-14', events)
    expect(markdown).toBe(
      '# 2026-07-14\n' +
        '- 08:00-09:00 Gym — legs (type:: gym)\n' +
        '- 10:00-11:00 Client call — NorthStar handoff (type:: call)\n' +
        '- 14:00-16:00 Deep work — Module 4 (type:: deep)\n',
    )
  })

  it('roundtrips through the REAL S33 parser (src/vault/calendar.ts) to the same events', () => {
    const events = mapGcalItemsToEvents(GCAL_FIXTURE_ITEMS, 'Asia/Kolkata')
    const markdown = eventsToMarkdown('2026-07-14', events)

    const parsed = parseCalendar(markdown)

    expect(parsed.date).toBe('2026-07-14')
    expect(parsed.events).toEqual(events)
  })

  it('an event-free day still parses cleanly (empty events array, date exposed)', () => {
    const markdown = eventsToMarkdown('2026-07-15', [])
    expect(markdown).toBe('# 2026-07-15\n')
    const parsed = parseCalendar(markdown)
    expect(parsed.date).toBe('2026-07-15')
    expect(parsed.events).toEqual([])
  })
})

describe('exchangeRefreshToken — OAuth token exchange (mocked fetch, no network)', () => {
  it('posts the refresh grant and returns the access token', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(url).toBe('https://oauth2.googleapis.com/token')
      expect(init.method).toBe('POST')
      const body = new URLSearchParams(init.body)
      expect(body.get('client_id')).toBe('fake-client-id')
      expect(body.get('client_secret')).toBe('fake-client-secret')
      expect(body.get('refresh_token')).toBe('fake-refresh-token')
      expect(body.get('grant_type')).toBe('refresh_token')
      return {
        ok: true,
        json: async () => ({ access_token: 'fake-access-token' }),
      }
    })

    const token = await exchangeRefreshToken({
      clientId: 'fake-client-id',
      clientSecret: 'fake-client-secret',
      refreshToken: 'fake-refresh-token',
      fetchImpl,
    })
    expect(token).toBe('fake-access-token')
  })

  it('throws a clear error on a non-OK response, never silently returns undefined', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'invalid_grant',
    }))
    await expect(
      exchangeRefreshToken({
        clientId: 'x',
        clientSecret: 'y',
        refreshToken: 'z',
        fetchImpl,
      }),
    ).rejects.toThrow(/401/)
  })

  it('requires all three credential fields', async () => {
    await expect(exchangeRefreshToken({ clientId: 'x' })).rejects.toThrow(/required/)
  })
})

describe('fetchTodayItems — Calendar API fetch (mocked fetch, no network)', () => {
  it('requests the primary calendar with a single-day, expanded-recurrence window', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(url).toContain('/calendars/primary/events?')
      expect(url).toContain('singleEvents=true')
      expect(url).toContain('timeMin=2026-07-14T00%3A00%3A00')
      expect(init.headers.Authorization).toBe('Bearer fake-access-token')
      return { ok: true, json: async () => ({ items: GCAL_FIXTURE_ITEMS }) }
    })

    const items = await fetchTodayItems({
      accessToken: 'fake-access-token',
      dateStr: '2026-07-14',
      timeZone: 'Asia/Kolkata',
      fetchImpl,
    })
    expect(items).toEqual(GCAL_FIXTURE_ITEMS)
  })

  it('throws a clear error on a non-OK response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' }))
    await expect(
      fetchTodayItems({ accessToken: 'x', dateStr: '2026-07-14', fetchImpl }),
    ).rejects.toThrow(/500/)
  })
})

describe('run — full pipeline (mocked fetch + injected push, no live git)', () => {
  it('writes ONLY Calendar/today.md and commits/pushes with the calendar-sync author (DoD #2)', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        return { ok: true, json: async () => ({ access_token: 'fake-access-token' }) }
      }
      return { ok: true, json: async () => ({ items: GCAL_FIXTURE_ITEMS }) }
    })
    const push = vi.fn(async () => ({ ok: true, attempts: 1 }))

    const { mkdtempSync, rmSync, readFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-calendar-sync-'))

    try {
      const result = await run({
        vaultDir,
        fetchImpl,
        clientId: 'id',
        clientSecret: 'secret',
        refreshToken: 'refresh',
        timeZone: 'Asia/Kolkata',
        push,
        now: new Date('2026-07-14T04:00:00Z'), // 09:30 IST
      })

      expect(result.ok).toBe(true)
      expect(result.dateStr).toBe('2026-07-14')

      // Written file matches the mapped events exactly.
      const written = readFileSync(join(vaultDir, 'Calendar', 'today.md'), 'utf8')
      expect(parseCalendar(written).events).toEqual(result.events)

      // push() called ONLY with Calendar/today.md and the calendar-sync author.
      expect(push).toHaveBeenCalledTimes(1)
      const [calledVaultDir, opts] = push.mock.calls[0]
      expect(calledVaultDir).toBe(vaultDir)
      expect(opts.files).toEqual(['Calendar/today.md'])
      expect(opts.author).toBe(COMMIT_AUTHOR)
      expect(opts.author).toContain('lifeos-calendar-sync')
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })
})
