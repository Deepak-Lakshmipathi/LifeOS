import { describe, expect, it } from 'vitest'
import { resolveVaultFilePath } from './vaultPath'

describe('resolveVaultFilePath', () => {
  it('domain + project -> <domain>/<project>.md', () => {
    expect(resolveVaultFilePath('Growth', 'Reading')).toBe('Growth/Reading.md')
  })

  it('domain only -> <domain>/Inbox.md', () => {
    expect(resolveVaultFilePath('Growth', undefined)).toBe('Growth/Inbox.md')
  })

  it('project only -> Inbox/<project>.md', () => {
    expect(resolveVaultFilePath(undefined, 'SideQuest')).toBe('Inbox/SideQuest.md')
  })

  it('neither -> Inbox/Inbox.md', () => {
    expect(resolveVaultFilePath(undefined, undefined)).toBe('Inbox/Inbox.md')
  })
})
