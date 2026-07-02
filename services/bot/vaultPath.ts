/**
 * resolveVaultFilePath — mirrors src/sync/VaultSync.ts's private resolveFilePath
 * (ADR-0010 §5 path rules). Not exported there, so replicated here rather than
 * imported — do NOT diverge from these rules; VaultSync.ts is out of scope for
 * this ticket (S16b "Do NOT touch" list).
 *
 *   domain + project  ->  <domain>/<project>.md
 *   domain only       ->  <domain>/Inbox.md
 *   project only      ->  Inbox/<project>.md
 *   neither           ->  Inbox/Inbox.md
 */
export function resolveVaultFilePath(domain?: string, project?: string): string {
  if (domain && project) return `${domain}/${project}.md`
  if (domain) return `${domain}/Inbox.md`
  if (project) return `Inbox/${project}.md`
  return 'Inbox/Inbox.md'
}
