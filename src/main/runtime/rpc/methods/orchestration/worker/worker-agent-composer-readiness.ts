import { resolveDraftPasteReadyTimeoutMs } from '../../../../../../shared/draft-paste-ready-timeout'
import type { TuiAgent } from '../../../../../../shared/tui-agent'
import { TUI_AGENT_CONFIG } from '../../../../../../shared/tui-agent-config'
import type { OrcaRuntimeService } from '../../../../orca-runtime'

// tui-idle can precede the OpenCode/mimo composer mount, silently dropping the next paste.
export async function waitForWorkerAgentComposerReady(
  runtime: OrcaRuntimeService,
  terminalHandle: string,
  agent: TuiAgent | undefined,
  timeoutMs: number
): Promise<void> {
  if (
    !agent ||
    TUI_AGENT_CONFIG[agent].draftPasteReadySignal !== 'render-cursor-after-bracketed-paste'
  ) {
    return
  }

  await runtime.waitForAgentComposerReady(
    terminalHandle,
    agent,
    Math.min(timeoutMs, resolveDraftPasteReadyTimeoutMs(agent))
  )
}
