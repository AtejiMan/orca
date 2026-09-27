import { LOCAL_EXECUTION_HOST_ID, type ExecutionHostId } from '../../../shared/execution-host'
import type { WorktreeMeta } from '../../../shared/worktree/meta-types'

type TerminalSessionStore = {
  getWorktreeMetaForHost: (
    worktreeId: string,
    hostId: ExecutionHostId
  ) => Pick<WorktreeMeta, 'terminalSessionSeen'> | undefined
  setWorktreeMetaForHost: (
    worktreeId: string,
    hostId: ExecutionHostId,
    updates: Partial<WorktreeMeta>
  ) => unknown
  flushPendingOrThrowAsync: () => Promise<void>
}

/** Reserve durable cleanup protection before a local PTY can execute a startup command. */
export async function markWorktreeTerminalSessionSeen(args: {
  store?: TerminalSessionStore
  worktreeId?: string
  connectionId?: string | null
}): Promise<void> {
  const { store, worktreeId, connectionId } = args
  // Remote checkouts are always protected by the cleanup scanner: the local
  // client has no authoritative account of commands run on their host.
  if (
    !store ||
    connectionId ||
    typeof worktreeId !== 'string' ||
    worktreeId.length === 0 ||
    worktreeId.length > 512
  ) {
    return
  }
  if (store.getWorktreeMetaForHost(worktreeId, LOCAL_EXECUTION_HOST_ID)?.terminalSessionSeen) {
    return
  }
  store.setWorktreeMetaForHost(worktreeId, LOCAL_EXECUTION_HOST_ID, {
    terminalSessionSeen: true
  })
  await store.flushPendingOrThrowAsync()
}
