/**
 * VaultSync — SyncProvider backed by the Obsidian vault (S14 + S15a).
 *
 * list()       → transport.readFiles() → parse per-line → newest-first.
 *                Also builds a snapshot (id → {path, rawLine, task}) so
 *                mutations know exactly which line to touch.
 *
 * add()        → build Task (LocalOnly-style validation), serializeTaskLine,
 *                resolve file path (domain+project rules), append to file,
 *                transport.writeFile.
 *
 * update()     → look up snapshot, find the unique rawLine in the file,
 *                re-serialize with the patch applied, transport.writeFile.
 *
 * toggleDone() → look up snapshot, flip done + completed_at, re-serialize,
 *                transport.writeFile.
 *
 * delete()     → look up snapshot, find the unique rawLine, remove it,
 *                transport.writeFile.
 *
 * All mutations run through a FIFO promise queue so concurrent calls
 * serialize and never interleave their file reads/writes.
 *
 * The transport is injected so tests can swap in a fake without touching
 * the parser or requiring network/git access. VITE_VAULT is off by default
 * so GitTransport (and its writeFile stub) is never reached in the MVP path.
 */

import type { SyncProvider } from './SyncProvider'
import type { Task } from '../types'
import type { VaultTransport } from '../vault/transport'
import { GitTransport } from '../vault/transport'
import { parseTaskLine } from '../vault/parseVault'
import { serializeTaskLine } from '../vault/serialize'
import { isDomain } from '../data/domains'

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Mirrors LocalOnly's validation — keeps behaviour identical at the seam. */
const isValidPriority = (p: number): p is 1 | 2 | 3 => p === 1 || p === 2 || p === 3

/**
 * Resolve the vault file path for a new task.
 *
 * ADR-0010 §5 path rules:
 *   domain + project  →  <domain>/<project>.md
 *   domain only       →  <domain>/Inbox.md
 *   project only      →  Inbox/<project>.md
 *   neither           →  Inbox/Inbox.md
 */
function resolveFilePath(domain?: string, project?: string): string {
  if (domain && project) return `${domain}/${project}.md`
  if (domain) return `${domain}/Inbox.md`
  if (project) return `Inbox/${project}.md`
  return 'Inbox/Inbox.md'
}

/**
 * Count and collect indices of lines that exactly match `target`.
 * Used to enforce the unique-match invariant before mutating.
 */
function matchIndices(lines: string[], target: string): number[] {
  const out: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === target) out.push(i)
  }
  return out
}

// ─── Snapshot entry ──────────────────────────────────────────────────────────

interface SnapshotEntry {
  /** Relative vault path (e.g. `Growth/Reading.md`). */
  path: string
  /** Verbatim line text as it appeared in the file (used for exact matching). */
  rawLine: string
  /** The parsed Task — kept so patches can be applied without re-parsing. */
  task: Task
}

// ─── VaultSync ───────────────────────────────────────────────────────────────

export class VaultSync implements SyncProvider {
  private readonly transport: VaultTransport

  /** Allow injection for testing; defaults to the git-backed transport. */
  constructor(transport?: VaultTransport) {
    this.transport = transport ?? new GitTransport()
  }

  // ── State ──────────────────────────────────────────────────────────────────

  /**
   * Maps task id → source location + verbatim line, populated by list().
   * Mutations look up this map to know which file/line to edit.
   */
  private snapshot = new Map<string, SnapshotEntry>()

  /**
   * Files returned by the most-recent readFiles() call.
   * Mutations splice content from here without issuing a second transport read.
   */
  private lastFiles: { path: string; content: string }[] = []

  /**
   * Serial mutation queue — each op chains off the previous one so git I/O
   * never interleaves even when callers fire multiple mutations concurrently.
   */
  private queue: Promise<unknown> = Promise.resolve()

  /**
   * Enqueue a unit of work so that mutations run FIFO.
   * If a mutation throws the error propagates to the caller but the queue
   * itself continues (the `.catch(() => {})` arm keeps it live).
   */
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result: Promise<T> = this.queue.then(work)
    // Swallow errors in the queue chain so subsequent ops aren't blocked.
    this.queue = result.catch(() => {})
    return result
  }

  // ── list ───────────────────────────────────────────────────────────────────

  /**
   * Fetch all vault files, parse them line-by-line, build the snapshot, and
   * return tasks newest-first (mirrors LocalOnly.list() ordering).
   *
   * We replicate parseVault's per-file/per-line loop here (rather than calling
   * parseVault directly) so we can capture the source path and verbatim line
   * text alongside each Task — parseVault itself is left untouched (S15a
   * constraint: do NOT modify parseVault.ts).
   */
  async list(): Promise<Task[]> {
    const files = await this.transport.readFiles()
    this.lastFiles = files

    const tasks: Task[] = []
    const snapshot = new Map<string, SnapshotEntry>()

    for (const { path, content } of files) {
      // ── Path → domain / project (same logic as parseVault) ──────────────
      const parts = path.replace(/\\/g, '/').split('/')
      if (parts.length < 2) continue

      const folderName = parts[0]!
      const fileName = parts[parts.length - 1]!

      // Habits/*.md (#148: now included in the transport snapshot so
      // appendHabitHit's read-modify-write sees prior hits) is a distinct
      // contract, not a task source — Habits/log.md's `- [x] <habit>
      // (date:: ...) (source:: ...)` hit lines match parseTaskLine's plain
      // checkbox syntax and, lacking any id::/done_when::/priority::
      // marker, would otherwise be swallowed whole as spurious "done" tasks
      // titled with the raw date/source suffix. Skip the folder entirely.
      if (folderName === 'Habits') continue

      // Calendar/*.md (#151: now also included in the transport snapshot
      // so TodayCard's live self-load finds `Calendar/today.md`) needs NO
      // equivalent skip here: its lines (`# YYYY-MM-DD` date header,
      // `- HH:MM-HH:MM <title> (type:: ...)` event rows — see
      // src/vault/calendar.ts) never start with a checkbox `- [ ]`/`- [x]`
      // prefix, so parseTaskLine's `checkboxMatch` regex never matches them
      // and they're silently skipped as non-task lines already — unlike
      // Habits/log.md's checkbox-shaped hit lines, which needed an explicit
      // folder-level guard.

      // Mail/*.md (#154: now also included in the transport snapshot so
      // AttentionCard's live self-load finds `Mail/attention.md`) DOES need
      // the same guard as Habits: attention.md's lines are `- [ ] <title>
      // (label:: ...) (from:: ...) (waiting:: ...) (draft:: ...)` — see
      // src/vault/mail.ts's own `parseAttentionLine`, which uses the
      // identical checkbox prefix `/^- \[([ xX])\]\s+(.*)$/` as
      // parseTaskLine. None of attention.md's field keys (label/from/
      // waiting/draft) match parseTaskLine's field regex
      // (id|done_when|priority), so parseTaskLine finds zero markers and
      // treats the ENTIRE remainder — title plus every parenthesised field
      // — as one verbatim task title. Left unguarded, every attention line
      // (handled or not) would resurface in VaultSync.list() as a spurious
      // task with a garbage title. Skip the folder entirely, as #148 did
      // for Habits.
      if (folderName === 'Mail') continue

      const domain = isDomain(folderName) ? folderName : undefined
      const project = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName

      const ctx = { domain, project: project || undefined }

      // ── Parse line-by-line, recording path + rawLine per task ───────────
      for (const line of content.split('\n')) {
        const task = parseTaskLine(line, ctx)
        if (task !== null) {
          tasks.push(task)
          snapshot.set(task.id, { path, rawLine: line, task })
        }
      }
    }

    this.snapshot = snapshot
    // Newest-first (mirrors LocalOnly.list())
    return tasks.sort((a, b) => b.created_at - a.created_at)
  }

  // ── add ────────────────────────────────────────────────────────────────────

  async add(
    input: Parameters<SyncProvider['add']>[0],
  ): Promise<Task> {
    return this.enqueue(async () => {
      // ── Validation (mirrors LocalOnly.add) ────────────────────────────────
      const trimmedTitle = input.title.trim()
      if (!trimmedTitle) throw new Error('Task title must not be empty or whitespace.')
      if (input.priority !== undefined && !isValidPriority(input.priority)) {
        throw new Error('Task priority must be 1, 2, or 3.')
      }

      // ── Build task ────────────────────────────────────────────────────────
      const task: Task = {
        id: crypto.randomUUID(),
        title: trimmedTitle,
        done: false,
        created_at: Date.now(),
      }

      const doneWhen = input.done_when?.trim()
      if (doneWhen) task.done_when = doneWhen

      if (input.priority !== undefined) task.priority = input.priority

      const project = input.project?.trim()
      if (project) task.project = project

      const domain = input.domain?.trim()
      if (domain && isDomain(domain)) task.domain = domain

      // ── Resolve path → get current file content ────────────────────────
      const filePath = resolveFilePath(task.domain, task.project)
      const fileEntry = this.lastFiles.find((f) => f.path === filePath)
      const current = fileEntry?.content ?? ''

      // ── Append new line (trailing-newline discipline) ──────────────────
      // If the file is non-empty and doesn't end with '\n', add one before
      // appending — ensures every task starts on its own line.
      const newLine = serializeTaskLine(task)
      const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : ''
      const newContent = current + separator + newLine + '\n'

      await this.transport.writeFile(filePath, newContent, `add task: ${task.title}`)

      // ── Update in-memory cache ─────────────────────────────────────────
      if (fileEntry) {
        fileEntry.content = newContent
      } else {
        this.lastFiles.push({ path: filePath, content: newContent })
      }

      // Add to snapshot so subsequent mutations on this task work without
      // requiring a full list() refresh.
      this.snapshot.set(task.id, { path: filePath, rawLine: newLine, task })

      return task
    })
  }

  // ── update ─────────────────────────────────────────────────────────────────

  async update(
    id: string,
    patch: Parameters<SyncProvider['update']>[1],
  ): Promise<Task> {
    return this.enqueue(async () => {
      const entry = this.snapshot.get(id)
      if (!entry) throw new Error(`Task ${id} not found`)

      const { path, rawLine, task: current } = entry

      // ── Validation (mirrors LocalOnly.update) ─────────────────────────────
      if ('priority' in patch && patch.priority !== undefined && !isValidPriority(patch.priority)) {
        throw new Error('Task priority must be 1, 2, or 3.')
      }

      // ── Apply patch ──────────────────────────────────────────────────────
      const updated: Task = { ...current }

      if ('title' in patch) {
        const trimmed = patch.title?.trim()
        if (!trimmed) throw new Error('Task title must not be empty or whitespace.')
        updated.title = trimmed
      }

      if ('done_when' in patch) {
        const trimmed = patch.done_when?.trim()
        if (trimmed) {
          updated.done_when = trimmed
        } else {
          delete updated.done_when
        }
      }

      if ('priority' in patch) {
        if (patch.priority !== undefined) {
          updated.priority = patch.priority
        } else {
          delete updated.priority
        }
      }

      if ('project' in patch) {
        const trimmed = patch.project?.trim()
        if (trimmed) {
          updated.project = trimmed
        } else {
          delete updated.project
        }
      }

      if ('domain' in patch) {
        const trimmed = patch.domain?.trim()
        if (trimmed && isDomain(trimmed)) {
          updated.domain = trimmed
        } else {
          delete updated.domain
        }
      }

      // ── Splice the line in the file ───────────────────────────────────────
      const fileEntry = this.lastFiles.find((f) => f.path === path)
      const content = fileEntry?.content ?? ''
      const lines = content.split('\n')
      const matches = matchIndices(lines, rawLine)

      if (matches.length !== 1) {
        throw new Error(
          `Ambiguous or stale snapshot for task ${id}: ` +
          `${matches.length} matches for rawLine in ${path} (expected exactly 1 — call list() to refresh)`,
        )
      }

      const newLine = serializeTaskLine(updated)
      lines[matches[0]!] = newLine
      const newContent = lines.join('\n')

      await this.transport.writeFile(path, newContent, `update task: ${id}`)

      // ── Update in-memory cache ────────────────────────────────────────────
      if (fileEntry) fileEntry.content = newContent
      this.snapshot.set(id, { path, rawLine: newLine, task: updated })

      return updated
    })
  }

  // ── toggleDone ─────────────────────────────────────────────────────────────

  async toggleDone(id: string): Promise<Task> {
    return this.enqueue(async () => {
      const entry = this.snapshot.get(id)
      if (!entry) throw new Error(`Task ${id} not found`)

      const { path, rawLine, task: current } = entry

      // ── Flip done + completed_at (mirrors LocalOnly.toggleDone) ──────────
      const completing = !current.done
      const updated: Task = { ...current, done: completing }
      if (completing) {
        updated.completed_at = Date.now()
      } else {
        delete updated.completed_at
      }

      // ── Splice the line in the file ───────────────────────────────────────
      const fileEntry = this.lastFiles.find((f) => f.path === path)
      const content = fileEntry?.content ?? ''
      const lines = content.split('\n')
      const matches = matchIndices(lines, rawLine)

      if (matches.length !== 1) {
        throw new Error(
          `Ambiguous or stale snapshot for task ${id}: ` +
          `${matches.length} matches for rawLine in ${path} (expected exactly 1 — call list() to refresh)`,
        )
      }

      const newLine = serializeTaskLine(updated)
      lines[matches[0]!] = newLine
      const newContent = lines.join('\n')

      await this.transport.writeFile(path, newContent, `toggle done: ${id}`)

      // ── Update in-memory cache ────────────────────────────────────────────
      if (fileEntry) fileEntry.content = newContent
      this.snapshot.set(id, { path, rawLine: newLine, task: updated })

      return updated
    })
  }

  // ── delete ─────────────────────────────────────────────────────────────────

  async delete(id: string): Promise<void> {
    return this.enqueue(async () => {
      const entry = this.snapshot.get(id)
      if (!entry) throw new Error(`Task ${id} not found`)

      const { path, rawLine } = entry

      // ── Remove the line from the file ─────────────────────────────────────
      const fileEntry = this.lastFiles.find((f) => f.path === path)
      const content = fileEntry?.content ?? ''
      const lines = content.split('\n')
      const matches = matchIndices(lines, rawLine)

      if (matches.length !== 1) {
        throw new Error(
          `Ambiguous or stale snapshot for task ${id}: ` +
          `${matches.length} matches for rawLine in ${path} (expected exactly 1 — call list() to refresh)`,
        )
      }

      lines.splice(matches[0]!, 1)
      const newContent = lines.join('\n')

      await this.transport.writeFile(path, newContent, `delete task: ${id}`)

      // ── Update in-memory cache ────────────────────────────────────────────
      if (fileEntry) fileEntry.content = newContent
      this.snapshot.delete(id)
    })
  }
}
