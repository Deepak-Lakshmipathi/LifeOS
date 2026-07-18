/**
 * scout.test.mjs — S46 DoD coverage for agents/job-scout/scout.mjs.
 *
 * Fixture RemoteOK JSON + HN whoishiring RSS -> normalize -> score -> append
 * lines that roundtrip through the REAL S43 parser (src/vault/career.ts) to
 * prove they land in the exact contract shape (DoD #1). A dedup test proves
 * a find already present in the fixture pipeline (any stage) is skipped, and
 * that the owner's existing applied/interview/closed lines are byte-for-byte
 * untouched (DoD #2). Zero network, zero live git — sources are fixture
 * data, and the commit/push step is exercised with an injected mock `push`.
 */
import { describe, it, expect, vi } from 'vitest'
import { parsePipeline } from '../../src/vault/career.ts'
import {
  parseProfile,
  scoreListing,
  normalizeRemoteOk,
  normalizeHnRss,
  fetchRemoteOk,
  fetchHnRss,
  listingToPipelineLine,
  buildAppendLines,
  run,
  COMMIT_AUTHOR,
} from './scout.mjs'

const PROFILE_MD = `# job-scout profile

## threshold

\`\`\`
threshold: 60
\`\`\`

## keywords

\`\`\`
react: 20
typescript: 20
remote: 15
senior: 15
\`\`\`
`

const REMOTEOK_FIXTURE = [
  { legal: 'legend row, no id' }, // RemoteOK's first array element — must be skipped
  {
    id: '1',
    company: 'Acme',
    position: 'Senior React Engineer',
    url: 'https://remoteok.com/remote-jobs/1',
    tags: ['react', 'typescript', 'remote'],
    description: 'Senior React + TypeScript, fully remote.',
  },
  {
    id: '2',
    company: 'LowMatchCo',
    position: 'Junior PHP Dev',
    url: 'https://remoteok.com/remote-jobs/2',
    tags: ['php'],
    description: 'Entry-level PHP role, onsite.',
  },
  // Malformed — missing company — must be skipped defensively.
  { id: '3', position: 'No Company Role', url: 'https://remoteok.com/remote-jobs/3', tags: [] },
]

const HN_RSS_FIXTURE = `<?xml version="1.0"?>
<rss><channel>
<item>
<title>NorthStar | Senior TypeScript Engineer | Remote | Full-time</title>
<link>https://news.ycombinator.com/item?id=1</link>
<description>We need a senior TypeScript engineer, remote-first team.</description>
</item>
<item>
<title>Not a job posting, just a meta comment</title>
<link>https://news.ycombinator.com/item?id=2</link>
<description>no pipes here</description>
</item>
<item>
<title>InstaCo | Senior Frontend | SF | Onsite</title>
<link>https://news.ycombinator.com/item?id=3</link>
<description>React + TypeScript, onsite only.</description>
</item>
</channel></rss>`

describe('parseProfile — owner keyword/weight/threshold file', () => {
  it('parses threshold and keyword weights, case-insensitively keyed', () => {
    const profile = parseProfile(PROFILE_MD)
    expect(profile.threshold).toBe(60)
    expect(profile.keywords.get('react')).toBe(20)
    expect(profile.keywords.get('typescript')).toBe(20)
    expect(profile.keywords.get('remote')).toBe(15)
    expect(profile.keywords.get('senior')).toBe(15)
  })

  it('defaults threshold to 60 and tolerates malformed lines', () => {
    const profile = parseProfile('not a valid line\nreact: 20\ngarbage:::\n')
    expect(profile.threshold).toBe(60)
    expect(profile.keywords.get('react')).toBe(20)
    expect(profile.keywords.size).toBe(1)
  })
})

describe('scoreListing — pure keyword scorer', () => {
  const profile = parseProfile(PROFILE_MD)

  it('scores a full match at 100', () => {
    const listing = {
      role: 'Senior React Engineer',
      tags: ['react', 'typescript', 'remote'],
      description: 'senior',
    }
    expect(scoreListing(listing, profile)).toBe(100)
  })

  it('scores a partial match proportionally to matched weight', () => {
    const listing = { role: 'React Developer', tags: ['react'], description: '' }
    // Only "react" (20) hits out of 70 total weight -> round(20/70*100) = 29
    expect(scoreListing(listing, profile)).toBe(29)
  })

  it('scores zero for no keyword hits', () => {
    const listing = { role: 'Junior PHP Dev', tags: ['php'], description: 'entry level' }
    expect(scoreListing(listing, profile)).toBe(0)
  })

  it('matches whole words only (no "reactive" false-positive on "react")', () => {
    const listing = { role: 'Reactive Systems Engineer', tags: [], description: '' }
    expect(scoreListing(listing, profile)).toBe(0)
  })
})

describe('normalizeRemoteOk — RemoteOK JSON -> {company, role, url, tags}', () => {
  it('skips the legend row and malformed entries, keeps the rest', () => {
    const listings = normalizeRemoteOk(REMOTEOK_FIXTURE)
    expect(listings).toHaveLength(2)
    expect(listings[0]).toMatchObject({
      company: 'Acme',
      role: 'Senior React Engineer',
      url: 'https://remoteok.com/remote-jobs/1',
      tags: ['react', 'typescript', 'remote'],
      source: 'remoteok',
    })
  })

  it('never throws on malformed/empty input', () => {
    expect(() => normalizeRemoteOk(null)).not.toThrow()
    expect(normalizeRemoteOk(null)).toEqual([])
    expect(normalizeRemoteOk([null, undefined, {}])).toEqual([])
  })
})

describe('normalizeHnRss — HN whoishiring RSS XML -> {company, role, url, tags}', () => {
  it('parses pipe-delimited job postings, skips non-posting items', () => {
    const listings = normalizeHnRss(HN_RSS_FIXTURE)
    expect(listings).toHaveLength(2)
    expect(listings[0]).toMatchObject({
      company: 'NorthStar',
      role: 'Senior TypeScript Engineer',
      url: 'https://news.ycombinator.com/item?id=1',
      source: 'hn-whoishiring',
    })
    expect(listings[1]).toMatchObject({
      company: 'InstaCo',
      role: 'Senior Frontend',
      url: 'https://news.ycombinator.com/item?id=3',
    })
  })

  it('never throws on empty/malformed XML', () => {
    expect(() => normalizeHnRss('')).not.toThrow()
    expect(normalizeHnRss('')).toEqual([])
    expect(normalizeHnRss('<rss><channel></channel></rss>')).toEqual([])
  })
})

describe('listingToPipelineLine + parsePipeline — S43 contract roundtrip (DoD #1)', () => {
  it('renders the exact contract line shape', () => {
    const listing = { company: 'Acme', role: 'Senior React Engineer', url: 'https://x.test/1' }
    const line = listingToPipelineLine(listing, 87)
    expect(line).toBe(
      '- Acme — Senior React Engineer (stage:: found) (match:: 87%) (source:: job-scout) (url:: https://x.test/1)',
    )
  })

  it('roundtrips through the REAL S43 parser to a found-stage entry', () => {
    const listing = { company: 'Acme', role: 'Senior React Engineer', url: 'https://x.test/1' }
    const line = listingToPipelineLine(listing, 87)
    const [entry] = parsePipeline(line)
    expect(entry).toMatchObject({
      company: 'Acme',
      role: 'Senior React Engineer',
      stage: 'found',
      match: '87%',
      source: 'job-scout',
    })
  })
})

describe('buildAppendLines — score + threshold + dedup (pure)', () => {
  const profile = parseProfile(PROFILE_MD)

  it('appends only listings at/above threshold, formatted as pipeline lines', () => {
    const listings = normalizeRemoteOk(REMOTEOK_FIXTURE)
    const lines = buildAppendLines(listings, '', profile)
    expect(lines).toHaveLength(1) // Acme (100%) passes; LowMatchCo (0%) doesn't
    expect(lines[0]).toContain('Acme — Senior React Engineer')
    expect(lines[0]).toContain('(match:: 100%)')
  })

  it('DoD #2: skips a find already present in pipeline.md (any stage), case-insensitively', () => {
    const listings = normalizeRemoteOk(REMOTEOK_FIXTURE)
    const existingMd = '- acme — SENIOR REACT ENGINEER (stage:: applied) (age:: 3d)\n'
    const lines = buildAppendLines(listings, existingMd, profile)
    expect(lines).toEqual([]) // the only would-be match is already in the pipeline
  })

  it('dedups within the same incoming batch (two sources, same posting)', () => {
    const listing = {
      company: 'Acme',
      role: 'Senior React Engineer',
      url: 'https://x.test/1',
      tags: ['react', 'typescript', 'remote'],
      description: '',
    }
    const lines = buildAppendLines([listing, { ...listing, url: 'https://x.test/2' }], '', profile)
    expect(lines).toHaveLength(1)
  })

  it('owner lines (applied/interview/closed) are never touched — untouched-region byte assert', () => {
    const existingMd =
      '- InstaCo — Senior Frontend (stage:: applied) (age:: 6d) (match:: 82%) (next:: follow up with recruiter)\n' +
      '- NorthStar — Founding Eng (stage:: interview) (age:: 2d) (hot:: true) (next:: prep system design)\n'
    const listings = normalizeRemoteOk(REMOTEOK_FIXTURE)
    const lines = buildAppendLines(listings, existingMd, profile)
    // buildAppendLines is pure and returns ONLY new lines to append — the
    // caller (appendToPipelineFile) concatenates, never rewrites, so the
    // existing owner lines above are guaranteed byte-identical post-append.
    expect(lines.every((l) => !l.includes('InstaCo') && !l.includes('NorthStar'))).toBe(true)
    expect(lines[0]).toContain('Acme')
  })
})

describe('fetchRemoteOk / fetchHnRss — mocked fetch, no network', () => {
  it('fetchRemoteOk parses the JSON API response', async () => {
    const fetchImpl = vi.fn(async (url) => {
      expect(url).toBe('https://remoteok.com/api')
      return { ok: true, json: async () => REMOTEOK_FIXTURE }
    })
    const items = await fetchRemoteOk({ fetchImpl })
    expect(items).toEqual(REMOTEOK_FIXTURE)
  })

  it('fetchRemoteOk throws a clear error on a non-OK response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503, text: async () => 'boom' }))
    await expect(fetchRemoteOk({ fetchImpl })).rejects.toThrow(/503/)
  })

  it('fetchHnRss fetches the RSS feed as text', async () => {
    const fetchImpl = vi.fn(async (url) => {
      expect(url).toContain('hnrss.org/whoishiring')
      return { ok: true, text: async () => HN_RSS_FIXTURE }
    })
    const xml = await fetchHnRss({ fetchImpl })
    expect(xml).toBe(HN_RSS_FIXTURE)
  })

  it('fetchHnRss throws a clear error on a non-OK response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' }))
    await expect(fetchHnRss({ fetchImpl })).rejects.toThrow(/500/)
  })
})

describe('run — full pipeline (fixture sources + injected push, no live git)', () => {
  it('appends new finds, commits ONLY Career/pipeline.md, dedups against the existing file (DoD #1/#2)', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://remoteok.com/api') return { ok: true, json: async () => REMOTEOK_FIXTURE }
      return { ok: true, text: async () => HN_RSS_FIXTURE }
    })
    const push = vi.fn(async () => ({ ok: true, attempts: 1 }))
    const readFileImpl = vi.fn(async () => PROFILE_MD)

    const { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-job-scout-'))

    try {
      // Seed an existing pipeline.md with one owner line + one prior job-scout
      // find that would otherwise re-match (InstaCo, from the HN fixture).
      mkdirSync(join(vaultDir, 'Career'), { recursive: true })
      const seeded =
        '- InstaCo — Senior Frontend (stage:: applied) (age:: 6d) (next:: follow up)\n'
      writeFileSync(join(vaultDir, 'Career', 'pipeline.md'), seeded, 'utf8')

      const result = await run({ vaultDir, fetchImpl, push, readFileImpl })

      expect(result.ok).toBe(true)
      // Acme (RemoteOK, 100%) and NorthStar (HN, 100%) both clear threshold;
      // InstaCo is deduped against the seeded owner line.
      expect(result.appended).toBe(2)
      expect(result.lines.some((l) => l.includes('Acme'))).toBe(true)
      expect(result.lines.some((l) => l.includes('NorthStar'))).toBe(true)
      expect(result.lines.some((l) => l.includes('InstaCo'))).toBe(false)

      const written = readFileSync(join(vaultDir, 'Career', 'pipeline.md'), 'utf8')
      // Owner's original line is byte-for-byte untouched (still the first line).
      expect(written.startsWith(seeded)).toBe(true)
      const parsed = parsePipeline(written)
      expect(parsed).toHaveLength(3) // seeded InstaCo + Acme + NorthStar
      expect(parsed.find((e) => e.company === 'InstaCo').stage).toBe('applied') // untouched

      expect(push).toHaveBeenCalledTimes(1)
      const [calledVaultDir, opts] = push.mock.calls[0]
      expect(calledVaultDir).toBe(vaultDir)
      expect(opts.files).toEqual(['Career/pipeline.md'])
      expect(opts.author).toBe(COMMIT_AUTHOR)
      expect(opts.author).toContain('lifeos-job-scout')
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })

  it('does not call push at all when no listing clears threshold (no-op run)', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://remoteok.com/api') {
        return { ok: true, json: async () => [{ id: '9', company: 'X', position: 'PHP Dev', url: 'https://x.test/9', tags: ['php'] }] }
      }
      return { ok: true, text: async () => '<rss><channel></channel></rss>' }
    })
    const push = vi.fn(async () => ({ ok: true, attempts: 1 }))
    const readFileImpl = vi.fn(async () => PROFILE_MD)

    const { mkdtempSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-job-scout-noop-'))

    try {
      const result = await run({ vaultDir, fetchImpl, push, readFileImpl })
      expect(result.appended).toBe(0)
      expect(push).not.toHaveBeenCalled()
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })
})
