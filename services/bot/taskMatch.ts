/**
 * taskMatch — pure fuzzy task-title matching for update/delete targeting
 * (S17, ADR-0013 Decision 2). No I/O: callers supply the candidate pool —
 * typically every task in the vault, built via tasksFromFiles below from an
 * already-read files array. parseVault.ts is reused (parseTaskLine),
 * VaultSync.ts's own path/rawLine capture loop is mirrored locally (it is
 * out of scope for this ticket — same pattern vaultPath.ts already uses for
 * resolveFilePath).
 */

import type { Task } from '../../src/types'
import { parseTaskLine } from '../../src/vault/parseVault'
import { isDomain } from '../../src/data/domains'

export interface MatchedTask {
  task: Task
  /** Relative vault path the task's line lives in, e.g. `Finance/Inbox.md`. */
  path: string
  /** Verbatim source line — used for the exact-match commit-time splice (ADR-0013 Decision 2). */
  rawLine: string
}

/** Confident-single-match threshold (ADR-0013 Decision 2 / HITL-flag B). Hardcoded — not configurable. */
export const CONFIDENT_THRESHOLD = 0.6
/** Candidate floor below which a task isn't considered a match at all. */
export const CANDIDATE_FLOOR = 0.5
/** Disambiguation prompts never list more than this many candidates (HITL-flag C). */
export const MAX_CANDIDATES = 5

/**
 * Score a free-text query against a task title, 0..1 (ADR-0013 Decision 2).
 * An exact case-insensitive substring match short-circuits to 1; otherwise
 * the score is the fraction of the query's whitespace-separated tokens that
 * also appear as whole tokens in the title.
 */
export function scoreMatch(query: string, title: string): number {
  const q = new Set(query.toLowerCase().split(/\s+/).filter(Boolean))
  if (q.size === 0) return 0
  if (title.toLowerCase().includes(query.trim().toLowerCase()) && query.trim().length > 0) return 1
  const t = new Set(title.toLowerCase().split(/\s+/).filter(Boolean))
  let hits = 0
  for (const w of q) if (t.has(w)) hits++
  return hits / q.size
}

/**
 * Scores every candidate against `query`, keeps those clearing
 * CANDIDATE_FLOOR, and returns them sorted by score descending (ties broken
 * by task.created_at descending). If `domainHint` is given, the pool is
 * filtered to that domain before scoring.
 */
export function matchTasks(query: string, tasks: MatchedTask[], domainHint?: string): MatchedTask[] {
  const pool = domainHint ? tasks.filter((m) => m.task.domain === domainHint) : tasks

  return pool
    .map((m) => ({ m, score: scoreMatch(query, m.task.title) }))
    .filter(({ score }) => score >= CANDIDATE_FLOOR)
    .sort((a, b) => b.score - a.score || b.m.task.created_at - a.m.task.created_at)
    .map(({ m }) => m)
}

/** The outcome of matching a target reference against the candidate pool (ADR-0013 Decision 2). */
export type MatchResult =
  | { kind: 'none' }
  | { kind: 'confident'; match: MatchedTask }
  | { kind: 'disambiguate'; candidates: MatchedTask[] }

/**
 * Classifies matchTasks' output into no-match / confident-single /
 * disambiguate per the literal thresholds in ADR-0013 Decision 2:
 *   - zero candidates >= CANDIDATE_FLOOR                       -> 'none'
 *   - exactly one candidate, and it clears CONFIDENT_THRESHOLD -> 'confident'
 *   - anything else (2+ candidates, or a lone sub-confident one)
 *     -> 'disambiguate', capped at MAX_CANDIDATES
 * (A lone candidate scoring in [CANDIDATE_FLOOR, CONFIDENT_THRESHOLD) isn't
 * literally named in the ADR's three bullets — treating it as a one-item
 * disambiguation list rather than auto-confirming keeps every commit behind
 * an explicit pick+confirm, which is the brief's actual invariant.)
 */
export function classifyMatches(query: string, tasks: MatchedTask[], domainHint?: string): MatchResult {
  const candidates = matchTasks(query, tasks, domainHint)

  if (candidates.length === 0) return { kind: 'none' }

  if (candidates.length === 1 && scoreMatch(query, candidates[0]!.task.title) >= CONFIDENT_THRESHOLD) {
    return { kind: 'confident', match: candidates[0]! }
  }

  return { kind: 'disambiguate', candidates: candidates.slice(0, MAX_CANDIDATES) }
}

/**
 * Rebuilds a MatchedTask[] search space from already-read vault files,
 * replicating VaultSync.list()'s per-line path+rawLine capture (VaultSync.ts
 * is out of scope for this ticket — mirrored locally rather than imported).
 * Done and not-done tasks are both included — delete may legitimately target
 * a completed task.
 */
export function tasksFromFiles(files: { path: string; content: string }[]): MatchedTask[] {
  const result: MatchedTask[] = []

  for (const { path, content } of files) {
    const parts = path.replace(/\\/g, '/').split('/')
    if (parts.length < 2) continue

    const folderName = parts[0]!
    const fileName = parts[parts.length - 1]!

    const domain = isDomain(folderName) ? folderName : undefined
    const rawProject = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName
    const project = rawProject.toLowerCase() === 'inbox' ? undefined : rawProject

    const ctx = { domain, project }

    for (const line of content.split('\n')) {
      const task = parseTaskLine(line, ctx)
      if (task !== null) result.push({ task, path, rawLine: line })
    }
  }

  return result
}
