/**
 * photoConfirm — per-chat pending photo batch-confirmation state
 * (S19b, ADR-0012 Decisions 3, 4).
 *
 * Narrow, chat-scoped, expiring state: a photo triggers vision extraction
 * (visionExtract.ts) into zero or more tasks; the owner then confirms the
 * batch (all/none/subset) in their next text reply, handled by router.ts's
 * confirm-check branch. This module holds only the state between those two
 * steps — no Telegram/Claude/vault imports, pure and unit-testable with an
 * injectable clock.
 *
 * Single pending batch per chat — a new photo overwrites any existing
 * pending state (single-owner bot, no queueing; ADR-0012 Decision 3 /
 * HITL-flag D).
 */

import type { ExtractedTask } from './visionExtract'

export interface PendingPhotoConfirmation {
  chatId: string
  tasks: ExtractedTask[]
  expiresAt: number
}

const TTL_MS = 10 * 60 * 1000

const pending = new Map<string, PendingPhotoConfirmation>()

/** Stores a new pending batch for chatId, overwriting any existing entry. */
export function setPending(chatId: string, tasks: ExtractedTask[], now: () => number = Date.now): void {
  pending.set(chatId, { chatId, tasks, expiresAt: now() + TTL_MS })
}

/** Returns the chat's pending batch, or undefined if absent or expired. */
export function getPending(chatId: string, now: () => number = Date.now): PendingPhotoConfirmation | undefined {
  const entry = pending.get(chatId)
  if (!entry) return undefined

  if (now() >= entry.expiresAt) {
    pending.delete(chatId)
    return undefined
  }

  return entry
}

/** Deletes the chat's pending batch, if any. No-op if none exists. */
export function clearPending(chatId: string): void {
  pending.delete(chatId)
}
