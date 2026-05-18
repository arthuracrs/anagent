import { getAgent } from './agents/registry.js'
import type { AgentResult } from './agents/base.js'
import { resolveAnagentDir, initAnagentDir, readPromptOverride } from './state/storage.js'
import { saveRun, hashInput } from './state/runs.js'
import { getRuntime } from './runtimes/registry.js'
import { runHeadless } from './execution/headless.js'
import { runTmux } from './execution/tmux.js'

export async function runAgent(
  agentName: string,
  input: string,
  opts: { runtime?: string; mode?: 'headless' | 'tmux'; cwd?: string } = {},
): Promise<AgentResult> {
  const agent = getAgent(agentName)
  if (!agent) throw new Error(`Unknown agent: "${agentName}". Run 'anagent list' to see available agents.`)

  const runtimeId = opts.runtime ?? 'claude-code'
  const runtime = getRuntime(runtimeId)
  if (!runtime) throw new Error(`Unknown runtime: "${runtimeId}". Run 'anagent runtimes' to see available runtimes.`)

  const mode = opts.mode ?? runtime.defaultMode

  const anagentDir = resolveAnagentDir()
  initAnagentDir(anagentDir)

  const override = readPromptOverride(anagentDir, agentName)
  const systemPrompt = override
    ? `${agent.defaultSystemPrompt}\n\n## Project-specific criteria\n\n${override}`
    : agent.defaultSystemPrompt

  const raw = mode === 'headless'
    ? runHeadless(runtime, systemPrompt, input, opts.cwd)
    : await runTmux(runtime, systemPrompt, input, opts.cwd)

  const result = agent.parseOutput(raw)

  saveRun(anagentDir, {
    timestamp: new Date().toISOString(),
    agent: agentName,
    runtime: runtimeId,
    mode,
    inputHash: hashInput(input),
    input,
    raw,
    result,
  })

  return result
}
