/**
 * confirm/store — per-chat pending-confirmation state for update/delete
 * (S17, ADR-0013 Decision 1). Module-scope Map keyed by Telegram chat id.
 * No file/DB/vault persistence — a process restart silently drops any
 * pending confirmation (acceptable: the user just re-issues the request).
 *
 * Expiry is lazy: getPending checks the stored expiresAt against Date.now()
 * on read rather than scheduling a timer — same posture as photoConfirm.ts's
 * independent batch-confirm state (S19), see ADR-0013 Decision 1 for why a
 * bare Map beats any persisted store here.
 */

import type { MatchedTask } from '../taskMatch'

/**
 * The fields update.ts may apply to a task. Every field is optional — only
 * fields the user's message actually implied are ever set (nlu.ts's
 * omit-when-not-confidently-implied normalization gives exactly this
 * distinction for free — ADR-0013 "nlu.ts schema growth"). Title rename is
 * explicitly out of scope for S17.
 */
export interface TaskPatch {
  priority?: 1 | 2 | 3
  done_when?: string
  domain?: string
  project?: string
  mark_done?: boolean
}

export type PendingAction =
  | {
      kind: 'confirm'
      intent: 'update' | 'delete'
      match: MatchedTask
      patch?: TaskPatch
      promptedAt: number
      expiresAt: number
    }
  | {
      kind: 'disambiguate'
      intent: 'update' | 'delete'
      candidates: MatchedTask[]
      patch?: TaskPatch
      expiresAt: number
    }

/**
 * Distributes Omit over PendingAction's union so each branch keeps only its
 * own discriminant-specific fields. A plain `Omit<PendingAction, K>` does
 * NOT distribute over a union (keyof of a union is the intersection of each
 * member's keys) — it would collapse 'match'/'candidates' out of the result
 * entirely. This is the standard fix, not a new abstraction layered on top.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** 2-minute confirm window (ADR-0013 Decision 3 / HITL-flag A). Hardcoded — no config surface. */
export const CONFIRM_TTL_MS = 2 * 60 * 1000

const pending = new Map<string, PendingAction>()

/** Stores a new pending action for chatId, overwriting any existing entry. */
export function setPending(chatId: string, action: DistributiveOmit<PendingAction, 'expiresAt'>): void {
  pending.set(chatId, { ...action, expiresAt: Date.now() + CONFIRM_TTL_MS } as PendingAction)
}

/** Returns the chat's pending action, or undefined if absent or expired (lazy check). */
export function getPending(chatId: string): PendingAction | undefined {
  const entry = pending.get(chatId)
  if (!entry) return undefined

  if (Date.now() > entry.expiresAt) {
    pending.delete(chatId)
    return undefined
  }

  return entry
}

/** Deletes the chat's pending action, if any. No-op if none exists. */
export function clearPending(chatId: string): void {
  pending.delete(chatId)
}
