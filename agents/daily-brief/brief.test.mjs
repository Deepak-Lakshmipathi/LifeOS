/**
 * brief.test.mjs — S50 DoD coverage for agents/daily-brief/brief.mjs.
 *
 * Fixture vault: a real temp directory tree (mkdtempSync) with a handful of
 * markdown files across Tasks/Habits/Calendar/Mail/Finance-shaped folders —
 * `readVaultFiles` walks real fs, same convention as finance-sync's and
 * supervisor's tests exercising real temp dirs for the vault-read side.
 * Claude is entirely MOCKED via the `callClaude` injection seam — NO live
 * API calls happen anywhere in this file (S50 DoD #5). Written output is
 * round-tripped through the REAL src/vault/briefs.ts parser to prove
 * byte-exact contract compliance (S50 DoD #1).
 */
import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseBrief, latestBriefPath } from '../../src/vault/briefs.ts'
import {
  digestFile,
  buildContextPack,
  validateBriefLines,
  composeBrief,
  briefFilePath,
  renderBriefMarkdown,
  readVaultFiles,
  run,
  COMMIT_AUTHOR,
  CLAUDE_MODEL,
  DIGEST_CHARS_PER_FILE,
  CONTEXT_CHAR_CAP,
} from './brief.mjs'

const VALID_LINES = [
  'Win: ship the S50 daily brief agent.',
  '10:00 Client call — NorthStar handoff.',
  'Meera (NorthStar) is waiting 26h on a quote.',
  'Course study block is on a 6-day streak — keep it alive.',
  'Net worth is ₹18.4L, up 2.1% this month.',
]

// ─── digestFile / buildContextPack — pure, token-capped ────────────────────

describe('digestFile — per-file truncation cap', () => {
  it('returns trimmed content unchanged when under the cap', () => {
    expect(digestFile('  hello world  ', 100)).toBe('hello world')
  })

  it('truncates content over the cap and appends a marker', () => {
    const long = 'x'.repeat(200)
    const out = digestFile(long, 50)
    expect(out.length).toBeLessThanOrEqual(50)
    expect(out).toContain('…(truncated)')
  })

  it('handles null/undefined content', () => {
    expect(digestFile(null, 10)).toBe('')
    expect(digestFile(undefined, 10)).toBe('')
  })
})

describe('buildContextPack — respects the total char cap (token-cap proxy)', () => {
  it('includes every file when well under the cap', () => {
    const files = [
      { path: 'Tasks/a.md', content: 'task a' },
      { path: 'Habits/b.md', content: 'habit b' },
    ]
    const pack = buildContextPack(files, { maxTotalChars: 10_000, maxCharsPerFile: 1000 })
    expect(pack.fileCount).toBe(2)
    expect(pack.truncated).toBe(false)
    expect(pack.text).toContain('Tasks/a.md')
    expect(pack.text).toContain('Habits/b.md')
  })

  it('never exceeds maxTotalChars even with many large files', () => {
    const files = Array.from({ length: 50 }, (_, i) => ({
      path: `Domain/file-${String(i).padStart(2, '0')}.md`,
      content: 'y'.repeat(500),
    }))
    const pack = buildContextPack(files, { maxTotalChars: 2000, maxCharsPerFile: 500 })
    expect(pack.text.length).toBeLessThanOrEqual(2000)
    expect(pack.truncated).toBe(true)
    expect(pack.fileCount).toBeLessThan(50)
  })

  it('caps each individual file digest at maxCharsPerFile', () => {
    const files = [{ path: 'Big/one.md', content: 'z'.repeat(5000) }]
    const pack = buildContextPack(files, { maxTotalChars: 100_000, maxCharsPerFile: 100 })
    // section = "### Big/one.md\n" + digest(<=100 chars)
    expect(pack.text.length).toBeLessThan(200)
  })

  it('sorts files by path for deterministic output', () => {
    const files = [
      { path: 'Zeta/z.md', content: 'z' },
      { path: 'Alpha/a.md', content: 'a' },
    ]
    const pack = buildContextPack(files, { maxTotalChars: 10_000, maxCharsPerFile: 1000 })
    expect(pack.text.indexOf('Alpha/a.md')).toBeLessThan(pack.text.indexOf('Zeta/z.md'))
  })

  it('is a pure function of its inputs (default caps are exported constants)', () => {
    expect(typeof DIGEST_CHARS_PER_FILE).toBe('number')
    expect(typeof CONTEXT_CHAR_CAP).toBe('number')
    expect(buildContextPack([])).toEqual({ text: '', fileCount: 0, totalFiles: 0, truncated: false, charCount: 0 })
  })
})

// ─── validateBriefLines — exactly 5 non-empty lines invariant ─────────────

describe('validateBriefLines — exactly-5-non-empty-lines invariant', () => {
  it('accepts exactly 5 non-empty trimmed lines', () => {
    const raw = { lines: VALID_LINES.map((l) => `  ${l}  `) }
    expect(validateBriefLines(raw)).toEqual(VALID_LINES)
  })

  it('rejects wrong length', () => {
    expect(validateBriefLines({ lines: VALID_LINES.slice(0, 4) })).toBeNull()
    expect(validateBriefLines({ lines: [...VALID_LINES, 'extra'] })).toBeNull()
  })

  it('rejects any blank/whitespace-only line', () => {
    const withBlank = [...VALID_LINES.slice(0, 4), '   ']
    expect(validateBriefLines({ lines: withBlank })).toBeNull()
  })

  it('rejects missing/malformed lines field', () => {
    expect(validateBriefLines(null)).toBeNull()
    expect(validateBriefLines({})).toBeNull()
    expect(validateBriefLines({ lines: 'not an array' })).toBeNull()
  })
})

// ─── composeBrief — MOCKED Claude, retry-once-then-fail ────────────────────

describe('composeBrief — mockable Claude call, retry-once-then-fail (S50 DoD #1)', () => {
  it('returns lines on a valid first response, calling callClaude once', async () => {
    const callClaude = vi.fn().mockResolvedValue({ lines: VALID_LINES })
    const result = await composeBrief({ apiKey: 'fake', contextPack: 'ctx', callClaude })
    expect(result.lines).toEqual(VALID_LINES)
    expect(result.attempts).toBe(1)
    expect(callClaude).toHaveBeenCalledTimes(1)
  })

  it('retries exactly once on malformed output, succeeding on the retry', async () => {
    const callClaude = vi
      .fn()
      .mockResolvedValueOnce({ lines: ['too', 'short'] }) // malformed: wrong length
      .mockResolvedValueOnce({ lines: VALID_LINES })
    const result = await composeBrief({ apiKey: 'fake', contextPack: 'ctx', callClaude })
    expect(result.lines).toEqual(VALID_LINES)
    expect(result.attempts).toBe(2)
    expect(callClaude).toHaveBeenCalledTimes(2)
  })

  it('fails loudly (throws) when still malformed after the retry', async () => {
    const callClaude = vi.fn().mockResolvedValue({ lines: ['nope'] })
    await expect(composeBrief({ apiKey: 'fake', contextPack: 'ctx', callClaude })).rejects.toThrow(
      /malformed after retry/,
    )
    expect(callClaude).toHaveBeenCalledTimes(2) // exactly once retried, never more
  })

  it('does not swallow a genuine callClaude throw (real API failure is not a retry case)', async () => {
    const callClaude = vi.fn().mockRejectedValue(new Error('Claude API returned 500'))
    await expect(composeBrief({ apiKey: 'fake', contextPack: 'ctx', callClaude })).rejects.toThrow(/500/)
    expect(callClaude).toHaveBeenCalledTimes(1)
  })
})

// ─── renderBriefMarkdown / briefFilePath — roundtrip through the real parser ─

describe('renderBriefMarkdown — roundtrips through src/vault/briefs.ts parseBrief', () => {
  it('renders exactly 5 bullet lines that parseBrief reads back unchanged', () => {
    const md = renderBriefMarkdown('2026-07-23', VALID_LINES)
    expect(md).toContain('# Briefs/2026-07-23.md')
    const parsed = parseBrief(md)
    expect(parsed).toEqual(VALID_LINES)
    expect(parsed.length).toBe(5)
  })

  it('briefFilePath matches src/vault/briefs.ts latestBriefPath for the same date', () => {
    expect(briefFilePath('2026-07-23')).toBe('Briefs/2026-07-23.md')
    expect(briefFilePath('2026-07-23')).toBe(latestBriefPath('2026-07-23'))
  })
})

// ─── readVaultFiles — real fs walk, excludes agents/proposals/Briefs ───────

describe('readVaultFiles — whole-vault markdown walk (real fs)', () => {
  it('collects .md files across nested folders, skips excluded top dirs', async () => {
    const vaultDir = mkdtempSync(join(tmpdir(), 'daily-brief-read-'))
    try {
      mkdirSync(join(vaultDir, 'Tasks'), { recursive: true })
      mkdirSync(join(vaultDir, 'Finance'), { recursive: true })
      mkdirSync(join(vaultDir, 'agents', 'daily-brief'), { recursive: true })
      mkdirSync(join(vaultDir, 'proposals'), { recursive: true })
      mkdirSync(join(vaultDir, 'Briefs'), { recursive: true })
      writeFileSync(join(vaultDir, 'Tasks', 'inbox.md'), '- [ ] do the thing')
      writeFileSync(join(vaultDir, 'Finance', 'burn.md'), '- income (month:: 2026-07) (amount:: 210000)')
      writeFileSync(join(vaultDir, 'agents', 'daily-brief', 'status.json'), '{}') // not .md — also excluded dir
      writeFileSync(join(vaultDir, 'proposals', 'foo-2026-07-23.md'), 'should be skipped')
      writeFileSync(join(vaultDir, 'Briefs', '2026-07-22.md'), 'yesterday — should be skipped')
      writeFileSync(join(vaultDir, 'not-markdown.txt'), 'skip me')

      const files = await readVaultFiles(vaultDir)
      const paths = files.map((f) => f.path).sort()

      expect(paths).toEqual(['Finance/burn.md', 'Tasks/inbox.md'])
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })

  it('returns [] for a nonexistent vault dir rather than throwing', async () => {
    const files = await readVaultFiles(join(tmpdir(), 'nonexistent-vault-dir-xyz'))
    expect(files).toEqual([])
  })
})

// ─── Full run — success path (S50 DoD #1, #3, #4) ──────────────────────────

describe('run — full pipeline, fixture vault + mocked Claude, no live network/git', () => {
  function seedFixtureVault() {
    const vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-daily-brief-'))
    mkdirSync(join(vaultDir, 'Tasks'), { recursive: true })
    mkdirSync(join(vaultDir, 'Habits'), { recursive: true })
    mkdirSync(join(vaultDir, 'Calendar'), { recursive: true })
    mkdirSync(join(vaultDir, 'Mail'), { recursive: true })
    mkdirSync(join(vaultDir, 'Finance'), { recursive: true })
    writeFileSync(join(vaultDir, 'Tasks', 'inbox.md'), '- [ ] Ship S50 (priority:: 1)')
    writeFileSync(join(vaultDir, 'Habits', 'habits.md'), '- Course study block\n')
    writeFileSync(join(vaultDir, 'Calendar', 'today.md'), '10:00 Client call — NorthStar handoff')
    writeFileSync(join(vaultDir, 'Mail', 'attention.md'), '- [ ] Meera asked for a quote (label:: client-money) (waiting:: 26h)')
    writeFileSync(join(vaultDir, 'Finance', 'networth-history.md'), '| date | networth |\n| 2026-07-01 | 1840000 |')
    return vaultDir
  }

  it('writes Briefs/<date>.md with exactly 5 lines, logs runLog ok:true, pushes only its own files (DoD #1, #3, #4)', async () => {
    const vaultDir = seedFixtureVault()
    try {
      const callClaude = vi.fn().mockResolvedValue({ lines: VALID_LINES })
      const push = vi.fn().mockResolvedValue({ ok: true, attempts: 1 })

      const result = await run({
        vaultDir,
        apiKey: 'fake-key',
        callClaude,
        push,
        now: new Date('2026-07-23T00:00:00Z'),
      })

      expect(result.ok).toBe(true)
      expect(result.dateISO).toBe('2026-07-23')
      expect(result.briefPath).toBe('Briefs/2026-07-23.md')

      // ── The brief file itself: exactly 5 non-empty lines, via the REAL parser ──
      const briefRaw = readFileSync(join(vaultDir, 'Briefs', '2026-07-23.md'), 'utf8')
      const parsedLines = parseBrief(briefRaw)
      expect(parsedLines.length).toBe(5)
      expect(parsedLines).toEqual(VALID_LINES)
      expect(parsedLines.every((l) => l.trim().length > 0)).toBe(true)

      // Also matches the path the PWA side computes for "today" (DoD #1/#2 seam).
      expect(latestBriefPath('2026-07-23')).toBe(result.briefPath)

      // ── S47 run log: status.json + runs.jsonl written under its own dir ──
      const statusRaw = readFileSync(join(vaultDir, 'agents', 'daily-brief', 'status.json'), 'utf8')
      const status = JSON.parse(statusRaw)
      expect(status.ok).toBe(true)
      expect(status.agent).toBe('daily-brief')

      const runsRaw = readFileSync(join(vaultDir, 'agents', 'daily-brief', 'runs.jsonl'), 'utf8')
      expect(runsRaw.trim().split('\n').length).toBe(1)

      // ── DoD #4: writes ONLY Briefs/** + its own agents/daily-brief/** ──
      expect(push).toHaveBeenCalledTimes(1)
      const [calledVaultDir, opts] = push.mock.calls[0]
      expect(calledVaultDir).toBe(vaultDir)
      expect(opts.files.sort()).toEqual(
        ['Briefs/2026-07-23.md', 'agents/daily-brief/runs.jsonl', 'agents/daily-brief/status.json'].sort(),
      )
      expect(opts.author).toBe(COMMIT_AUTHOR)

      // Never touched another agent's or the finance-sync/email-triage owned paths.
      expect(existsSync(join(vaultDir, 'proposals'))).toBe(false)
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })

  it('uses the pinned CLAUDE_MODEL (claude-sonnet-5) when calling the real compose fn shape', () => {
    // callClaudeForBrief itself is not exercised here (network) — this just
    // pins the exported model constant so a silent drift is caught by CI.
    expect(CLAUDE_MODEL).toBe('claude-sonnet-5')
  })
})

// ─── Full run — failure path: malformed-after-retry → runLog ok:false (DoD #1) ─

describe('run — malformed model output after retry fails loudly via runLog ok:false (S50 DoD #1)', () => {
  it('logs ok:false, pushes only the run-log files, writes nothing under Briefs/, and rethrows', async () => {
    const vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-daily-brief-fail-'))
    try {
      mkdirSync(join(vaultDir, 'Tasks'), { recursive: true })
      writeFileSync(join(vaultDir, 'Tasks', 'inbox.md'), '- [ ] Ship S50')

      // Malformed on both the first call AND the retry.
      const callClaude = vi.fn().mockResolvedValue({ lines: ['always', 'malformed'] })
      const push = vi.fn().mockResolvedValue({ ok: true, attempts: 1 })

      await expect(
        run({
          vaultDir,
          apiKey: 'fake-key',
          callClaude,
          push,
          now: new Date('2026-07-23T00:00:00Z'),
        }),
      ).rejects.toThrow(/malformed after retry/)

      // composeBrief's own retry-once policy — exactly 2 calls total.
      expect(callClaude).toHaveBeenCalledTimes(2)

      // Nothing written under Briefs/** on the failure path.
      expect(existsSync(join(vaultDir, 'Briefs'))).toBe(false)

      // The failure itself is loudly recorded via the S47 run log.
      const statusRaw = readFileSync(join(vaultDir, 'agents', 'daily-brief', 'status.json'), 'utf8')
      const status = JSON.parse(statusRaw)
      expect(status.ok).toBe(false)
      expect(status.note).toMatch(/compose failed/)

      // The failure record was still pushed (loud, not silent-stale) — only
      // the run-log files, never a Briefs file (there isn't one).
      expect(push).toHaveBeenCalledTimes(1)
      const [, opts] = push.mock.calls[0]
      expect(opts.files.sort()).toEqual(
        ['agents/daily-brief/runs.jsonl', 'agents/daily-brief/status.json'].sort(),
      )
      expect(opts.message).toMatch(/FAILED/)
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })

  it('a genuine API failure (callClaude throws) is also logged ok:false and rethrown', async () => {
    const vaultDir = mkdtempSync(join(tmpdir(), 'lifeos-daily-brief-apierr-'))
    try {
      const callClaude = vi.fn().mockRejectedValue(new Error('callClaudeForBrief: Claude API returned 500: boom'))
      const push = vi.fn().mockResolvedValue({ ok: true, attempts: 1 })

      await expect(
        run({ vaultDir, apiKey: 'fake-key', callClaude, push, now: new Date('2026-07-23T00:00:00Z') }),
      ).rejects.toThrow(/500/)

      // A hard API error is not retried by composeBrief (only malformed
      // output is) — exactly one call.
      expect(callClaude).toHaveBeenCalledTimes(1)

      const statusRaw = readFileSync(join(vaultDir, 'agents', 'daily-brief', 'status.json'), 'utf8')
      expect(JSON.parse(statusRaw).ok).toBe(false)
    } finally {
      rmSync(vaultDir, { recursive: true, force: true })
    }
  })
})
