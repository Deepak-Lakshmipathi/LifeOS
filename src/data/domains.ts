/**
 * Canonical domain set for LifeOS (Slice S5, ADR-0006).
 * Domain is stored as a denormalized string on Task — no Dexie index.
 * This module is the single source of truth for the domain palette.
 */

export const DOMAINS = [
  'Building Things',
  'Career',
  'Growth',
  'Life Admin',
  'Body & Mind',
  'Finance',
  'Relationship',
] as const

export type Domain = typeof DOMAINS[number]

/**
 * Returns true when `v` is one of the 7 canonical domains.
 * Use this to normalize/validate before storing.
 */
export function isDomain(v: string): v is Domain {
  return (DOMAINS as readonly string[]).includes(v)
}

/**
 * Static domain color palette for glow/warmth use in later slices.
 * Colors match the seed JSON project colors by domain.
 */
export const DOMAIN_COLORS: Record<Domain, string> = {
  'Building Things': '#5E5CE6',
  'Career':          '#FF375F',
  'Growth':          '#BF5AF2',
  'Life Admin':      '#8E8E93',
  'Body & Mind':     '#30D158',
  'Finance':         '#FFD60A',
  'Relationship':    '#FF9F0A',
}
