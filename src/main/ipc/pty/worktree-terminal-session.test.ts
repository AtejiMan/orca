import { describe, expect, it, vi } from 'vitest'
import { markWorktreeTerminalSessionSeen } from './worktree-terminal-session'

describe('terminal-session cleanup protection', () => {
  it('persists local usage before allowing a terminal to start', async () => {
    const store = {
      getWorktreeMetaForHost: vi.fn(() => ({ terminalSessionSeen: false })),
      setWorktreeMetaForHost: vi.fn(),
      flushPendingOrThrowAsync: vi.fn(async () => undefined)
    }
    await markWorktreeTerminalSessionSeen({ store, worktreeId: 'repo::/work' })
    expect(store.setWorktreeMetaForHost).toHaveBeenCalledWith('repo::/work', 'local', {
      terminalSessionSeen: true
    })
    expect(store.flushPendingOrThrowAsync).toHaveBeenCalledOnce()
  })

  it('does not start the terminal when the durable marker cannot be saved', async () => {
    const store = {
      getWorktreeMetaForHost: vi.fn(() => undefined),
      setWorktreeMetaForHost: vi.fn(),
      flushPendingOrThrowAsync: vi.fn(async () => {
        throw new Error('disk full')
      })
    }
    await expect(
      markWorktreeTerminalSessionSeen({ store, worktreeId: 'repo::/work' })
    ).rejects.toThrow('disk full')
  })

  it('leaves remote sessions to the scanner remote-history guard', async () => {
    const store = {
      getWorktreeMetaForHost: vi.fn(),
      setWorktreeMetaForHost: vi.fn(),
      flushPendingOrThrowAsync: vi.fn()
    }
    await markWorktreeTerminalSessionSeen({
      store,
      worktreeId: 'repo::/work',
      connectionId: 'ssh-1'
    })
    expect(store.setWorktreeMetaForHost).not.toHaveBeenCalled()
  })
})
