import { describe, expect, it } from 'vitest'
import type { WorktreeMeta } from '../../../shared/worktree/meta-types'
import { mergeWorktreeMetaForWrite } from './worktree-meta-write-normalization'

const existingMeta: WorktreeMeta = {
  displayName: 'Feature',
  comment: '',
  linkedIssue: null,
  linkedPR: null,
  suppressedGitHubPR: 42,
  linkedLinearIssue: null,
  isArchived: false,
  isUnread: false,
  isPinned: false,
  sortOrder: 0,
  lastActivityAt: 0
}

describe('worktree metadata write normalization', () => {
  it('starts new Orca workspaces unused without treating legacy metadata as unused', () => {
    expect(mergeWorktreeMetaForWrite(undefined, { orcaCreatedAt: 123 }).terminalSessionSeen).toBe(
      false
    )
    expect(mergeWorktreeMetaForWrite(existingMeta, { comment: 'edited' }).terminalSessionSeen).toBe(
      undefined
    )
    expect(
      mergeWorktreeMetaForWrite({ ...existingMeta, orcaCreatedAt: 100 }, { orcaCreatedAt: 123 })
        .terminalSessionSeen
    ).toBe(undefined)
  })

  it('never clears a recorded terminal session', () => {
    expect(
      mergeWorktreeMetaForWrite(
        { ...existingMeta, terminalSessionSeen: true },
        { terminalSessionSeen: false }
      ).terminalSessionSeen
    ).toBe(true)
  })

  it('clears GitHub PR suppression on every positive linked PR update', () => {
    const updated = mergeWorktreeMetaForWrite(existingMeta, {
      linkedPR: 42,
      suppressedGitHubPR: 42
    })

    expect(updated.linkedPR).toBe(42)
    expect(updated.suppressedGitHubPR).toBeNull()
  })

  it('preserves suppression for clears and unrelated metadata updates', () => {
    expect(mergeWorktreeMetaForWrite(existingMeta, { linkedPR: null }).suppressedGitHubPR).toBe(42)
    expect(mergeWorktreeMetaForWrite(existingMeta, { comment: 'note' }).suppressedGitHubPR).toBe(42)
  })
})
