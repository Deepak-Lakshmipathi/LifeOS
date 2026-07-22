/**
 * agentManifest — the static roster of LifeOS fleet agents (Slice S49).
 *
 * This is the *identity* half of the Agents tab: who the agents are, what they
 * do, where they run, and how often. It is deliberately separate from live run
 * status (S47's `agentStatus` reads status.json/runs.jsonl for that). The
 * AgentsView fleet table (DESIGN_LANGUAGE §4.8) joins this manifest to live
 * status by `name`: a manifest agent with no status file renders idle.
 */

/**
 * Where an agent runs — drives the §4.8 infra badge tint:
 *   gha → GH ACTIONS (violet)  · pc → THIS PC (amber)  · vps → VPS (green)
 */
export type Infra = 'gha' | 'pc' | 'vps'

/** One roster entry — static identity, joined to live status by `name`. */
export interface AgentSpec {
  /** Stable agent id; must match the `agent` field its status.json writes. */
  name: string
  /** One-line purpose, rendered as the §4.8 sub-line under the name. */
  purpose: string
  /** Execution home — selects the infra badge tint. */
  infra: Infra
  /** Human cadence shown in the badge (`GH ACTIONS · nightly`). */
  cadence: string
}

/**
 * The seven-agent fleet. Order is the render order of the table rows.
 * All three infra tints are represented so the badge variants are exercised
 * end to end (gha × 5, pc × finance-sync, vps × telegram-bot).
 */
export const agentManifest: AgentSpec[] = [
  {
    name: 'daily-brief',
    purpose: 'Assembles the morning brief from calendar, tasks & inbox',
    infra: 'gha',
    cadence: 'nightly',
  },
  {
    name: 'email-triage',
    purpose: 'Flags and drafts replies for inbox threads',
    infra: 'gha',
    cadence: 'hourly',
  },
  {
    name: 'calendar-sync',
    purpose: 'Mirrors Google Calendar events into the vault',
    infra: 'gha',
    cadence: 'every 15m',
  },
  {
    name: 'job-scout',
    purpose: 'Scrapes new roles into the career pipeline',
    infra: 'gha',
    cadence: 'daily',
  },
  {
    name: 'finance-sync',
    purpose: 'Pulls balances & transactions from bank + broker',
    infra: 'pc',
    cadence: 'daily',
  },
  {
    name: 'telegram-bot',
    purpose: 'Captures quick tasks & notes from Telegram',
    infra: 'vps',
    cadence: 'always-on',
  },
  {
    name: 'supervisor',
    purpose: 'Watches fleet health and files the nightly report',
    infra: 'gha',
    cadence: 'nightly',
  },
]
