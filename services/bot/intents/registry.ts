/**
 * intents/registry — generic dispatch machinery (S16b, ADR-0011 Decision 4).
 *
 * Written once by S16b; not touched again by S17/S18/S19 — they only ever
 * self-register via their own new intent file plus one import line in
 * intents/index.ts. `getIntentHandler` accepts any string (not just a known
 * IntentName) so the router can safely look up a classified intent name that
 * has no registered handler (e.g. Claude's "other", or a future/unregistered
 * name like "update") without a type error at the call site.
 */

import type { IntentHandler } from './types'

const handlers = new Map<string, IntentHandler>()

export function registerIntentHandler(handler: IntentHandler): void {
  handlers.set(handler.name, handler)
}

export function getIntentHandler(name: string): IntentHandler | undefined {
  return handlers.get(name)
}
