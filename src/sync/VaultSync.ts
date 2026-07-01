/**
 * VaultSync — SyncProvider that reads tasks from the Obsidian vault (S14).
 *
 * list()         → transport.readFiles() → parseVault() → newest-first
 * add/update/
 * toggleDone/
 * delete         → throw 'vault is read-only until S15'
 *
 * The transport is injected so it can be swapped in tests without touching
 * the parser or requiring network access.
 */

import type { SyncProvider } from './SyncProvider'
import type { Task } from '../types'
import type { VaultTransport } from '../vault/transport'
import { GitTransport } from '../vault/transport'
import { parseVault } from '../vault/parseVault'

export class VaultSync implements SyncProvider {
  private readonly transport: VaultTransport

  /** Allow injection for testing; defaults to the git-backed transport. */
  constructor(transport?: VaultTransport) {
    this.transport = transport ?? new GitTransport()
  }

  /** Fetch all vault files, parse them, and return newest-first. */
  async list(): Promise<Task[]> {
    const files = await this.transport.readFiles()
    const tasks = parseVault(files)
    // Mirror LocalOnly.list() ordering: newest created_at first
    return tasks.sort((a, b) => b.created_at - a.created_at)
  }

  async add(
    _input: Parameters<SyncProvider['add']>[0],
  ): Promise<Task> {
    throw new Error('vault is read-only until S15')
  }

  async update(
    _id: string,
    _patch: Parameters<SyncProvider['update']>[1],
  ): Promise<Task> {
    throw new Error('vault is read-only until S15')
  }

  async toggleDone(_id: string): Promise<Task> {
    throw new Error('vault is read-only until S15')
  }

  async delete(_id: string): Promise<void> {
    throw new Error('vault is read-only until S15')
  }
}
