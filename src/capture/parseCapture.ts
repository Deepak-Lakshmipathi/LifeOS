/**
 * parseCapture — smart capture mini-syntax parser (S12).
 *
 * Mini-syntax (tokens in any order; all are optional):
 * ─────────────────────────────────────────────────────────────────────────────
 *   #domain      Fuzzy-match to one of the 7 canonical domains
 *                (case-insensitive; prefix, first-word, or substring match).
 *                Unmatched → Inbox (domain field omitted on the task).
 *                First #token is consumed; subsequent #tokens fall to title.
 *
 *   !1 !2 !3     Priority (3 = highest). First !N token wins.
 *
 *   when <text>  done_when — captures EVERYTHING from "when" to end of input.
 *   ~ <text>     Shorthand for "when <text>".
 *   ~text        Variant — tilde immediately adjacent to text.
 *
 *   /project     Project name — the non-whitespace token after /.
 *                First /token wins.
 *
 *   (rest)       All remaining tokens become the title.
 *
 * Because "when" and "~" capture to end, tokens meant for other fields
 * (e.g. #domain, !N) should appear BEFORE "when" / "~" in the string.
 * Tokens before "when"/"~" can appear in any order relative to each other.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @example
 *   parseCapture('#growth Learn React !2 when all chapters done')
 *   // → { title: 'Learn React', domain: 'Growth', priority: 2, done_when: 'all chapters done' }
 *
 *   parseCapture('Fix bug /ops-infra #unknown !1')
 *   // → { title: 'Fix bug', project: 'ops-infra', priority: 1 }  — no domain (→ Inbox)
 *
 *   parseCapture('~ tests green Deploy service !3 #career')
 *   // Since ~ is the first token it captures everything after it as done_when.
 *   // Better: 'Deploy service !3 #career ~ tests green'
 *
 * Pure function — no side effects, no I/O.
 */

import { DOMAINS } from '../data/domains'

/** Mirrors the input type accepted by SyncProvider.add() and useTasks.addTask(). */
export interface TaskInput {
  title: string
  done_when?: string
  priority?: 1 | 2 | 3
  project?: string
  domain?: string
}

/**
 * Fuzzy-match a raw token (e.g. "body", "build", "fin") to one of the 7
 * canonical domain strings. Returns undefined when nothing matches.
 *
 * Match order (first hit wins):
 *   1. Exact match (case-insensitive)
 *   2. Any word in the domain name starts with the token
 *   3. The domain name (stripped of non-alphanumerics) contains the token
 */
export function fuzzyMatchDomain(token: string): string | undefined {
  const lower = token.toLowerCase()
  if (!lower) return undefined

  // 1. Exact match (case-insensitive)
  for (const d of DOMAINS) {
    if (d.toLowerCase() === lower) return d
  }

  // 2. Any word in the domain name starts with the token
  for (const d of DOMAINS) {
    const words = d.toLowerCase().split(/\s+/)
    if (words.some((w) => w.startsWith(lower))) return d
  }

  // 3. The domain name (stripped of non-alphanumerics) contains the token
  const strippedToken = lower.replace(/[^a-z0-9]/g, '')
  if (strippedToken) {
    for (const d of DOMAINS) {
      const strippedDomain = d.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (strippedDomain.includes(strippedToken)) return d
    }
  }

  return undefined
}

/**
 * Parse a free-text capture string into a structured TaskInput.
 *
 * Returns a TaskInput whose fields are only set when a corresponding token was
 * found (domain is omitted entirely when unmatched, per the Inbox rule).
 */
export function parseCapture(text: string): TaskInput {
  const rawText = text.trim()
  if (!rawText) return { title: '' }

  const tokens = rawText.split(/\s+/)
  const titleTokens: string[] = []
  let done_when: string | undefined
  let priority: 1 | 2 | 3 | undefined
  let project: string | undefined
  let domain: string | undefined
  let domainTokenSeen = false

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]

    // Priority: !1 | !2 | !3 (standalone token; first match wins)
    if (/^![123]$/.test(tok)) {
      if (priority === undefined) {
        priority = parseInt(tok[1], 10) as 1 | 2 | 3
      }
      continue
    }

    // Project: /word (first /token; consumes the token from title)
    if (/^\/\S+$/.test(tok)) {
      if (project === undefined) {
        project = tok.slice(1)
      } else {
        titleTokens.push(tok) // extra /tokens fall to title
      }
      continue
    }

    // Domain: #word (first #token consumed regardless of match)
    if (/^#\S+$/.test(tok)) {
      if (!domainTokenSeen) {
        domainTokenSeen = true
        const matched = fuzzyMatchDomain(tok.slice(1))
        if (matched) domain = matched // undefined → Inbox (field omitted)
      } else {
        titleTokens.push(tok) // extra #tokens fall to title
      }
      continue
    }

    // done_when: standalone "when" — captures everything after it to end
    if (tok.toLowerCase() === 'when') {
      if (i + 1 < tokens.length) {
        done_when = tokens.slice(i + 1).join(' ')
      }
      break // consume rest; exit loop
    }

    // done_when: standalone "~" — captures everything after it to end
    if (tok === '~') {
      if (i + 1 < tokens.length) {
        done_when = tokens.slice(i + 1).join(' ')
      }
      break
    }

    // done_when: "~text" — tilde immediately adjacent to content
    if (/^~\S/.test(tok)) {
      const inline = tok.slice(1)
      const rest = tokens.slice(i + 1).join(' ')
      done_when = rest ? `${inline} ${rest}` : inline
      break
    }

    // Default: contributes to title
    titleTokens.push(tok)
  }

  const title = titleTokens.join(' ')

  return {
    title,
    ...(done_when !== undefined && done_when !== '' && { done_when }),
    ...(priority !== undefined && { priority }),
    ...(project !== undefined && { project }),
    ...(domain !== undefined && { domain }),
  }
}
