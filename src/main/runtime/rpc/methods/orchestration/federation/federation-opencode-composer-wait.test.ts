import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveDraftPasteReadyTimeoutMs } from '../../../../../../shared/draft-paste-ready-timeout'
import { OrcaRuntimeService } from '../../../../orca-runtime'
import { OrchestrationDb } from '../../../../orchestration/db'
import { ORCHESTRATION_METHODS } from '../../orchestration'

describe('federation attach-start composer readiness for opencode', () => {
  let db: OrchestrationDb
  let runtime: OrcaRuntimeService
  let requestSequence = 0

  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
    runtime = new OrcaRuntimeService()
    runtime.setOrchestrationDb(db)
    vi.spyOn(runtime, 'validateOrchestrationAgentLauncher').mockImplementation(() => {})
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: This handler path reads only the workspace id from the stub.
    vi.spyOn(runtime, 'showManagedTerminalWorkspace').mockResolvedValue({
      id: 'folder:remote-workspace'
    } as never)
    vi.spyOn(runtime, 'createTerminal').mockResolvedValue({
      handle: 'term_remote_worker',
      worktreeId: 'folder:remote-workspace',
      title: 'worker'
    })
    vi.spyOn(runtime, 'waitForTerminal').mockResolvedValue({
      handle: 'term_remote_worker',
      condition: 'tui-idle',
      satisfied: true,
      status: 'running',
      exitCode: null
    })
    vi.spyOn(runtime, 'getTerminalPaneKey').mockReturnValue('tab_remote:leaf_remote')
    vi.spyOn(runtime, 'getTerminalProcessIncarnation').mockReturnValue(
      'runtime_test:term_remote_worker:1'
    )
    vi.spyOn(runtime, 'getTerminalOrchestrationCliCommand').mockReturnValue('orca')
  })

  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
  })

  async function startRemoteWorker(agent: 'opencode' | 'mimo-code', timeoutMs?: number) {
    const method = ORCHESTRATION_METHODS.find(
      (candidate) => candidate.name === 'orchestration.federationAttachStart'
    )
    if (!method) {
      throw new Error('federationAttachStart method is not registered')
    }
    requestSequence += 1
    const suffix = String(requestSequence)

    return method.handler(
      method.params!.parse({
        runId: 'run-home',
        dispatchId: `ctx_remote_${suffix}`,
        taskId: `task_remote_${suffix}`,
        taskSpec: `remote ${agent} worker`,
        protocolVersion: 3,
        worktree: 'folder:remote-workspace',
        agent,
        timeoutMs
      }),
      {
        runtime,
        orchestrationMutation: {
          callerFingerprint: 'home_peer',
          requestId: `request_remote_${suffix}`,
          method: 'orchestration.federationAttachStart',
          payloadHash: `remote_payload_${suffix}`
        }
      }
    )
  }

  it.each(['opencode', 'mimo-code'] as const)(
    'waits for the %s composer before delivering the preamble',
    async (agent) => {
      const events: string[] = []
      const composerWait = vi
        .spyOn(runtime, 'waitForAgentComposerReady')
        .mockImplementation(async () => {
          events.push('waitForAgentComposerReady')
          return true
        })
      vi.spyOn(runtime, 'sendTerminalAgentPrompt').mockImplementation(async () => {
        events.push('sendTerminalAgentPrompt')
        return { handle: 'term_remote_worker', accepted: true, bytesWritten: 1 }
      })

      const result = await startRemoteWorker(agent)

      expect(result).toMatchObject({ state: 'ready' })
      expect(composerWait).toHaveBeenCalledWith(
        'term_remote_worker',
        agent,
        resolveDraftPasteReadyTimeoutMs(agent)
      )
      expect(events).toEqual(['waitForAgentComposerReady', 'sendTerminalAgentPrompt'])
    }
  )

  it('caps the remote composer wait at the attach-start timeout budget', async () => {
    const composerWait = vi.spyOn(runtime, 'waitForAgentComposerReady').mockResolvedValue(true)
    vi.spyOn(runtime, 'sendTerminalAgentPrompt').mockResolvedValue({
      handle: 'term_remote_worker',
      accepted: true,
      bytesWritten: 1
    })

    const result = await startRemoteWorker('opencode', 2_000)

    expect(result).toMatchObject({ state: 'ready' })
    expect(composerWait).toHaveBeenCalledWith('term_remote_worker', 'opencode', 2_000)
  })
})
