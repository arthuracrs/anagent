import { getAgent } from './agents/registry.js'
import type { AgentResult } from './agents/base.js'
import { resolveAnagentDir, initAnagentDir, readPromptOverride } from './state/storage.js'
import { saveRun, hashInput } from './state/runs.js'
import { callClaude } from './claude.js'

export async function runAgent(agentName: string, input: string, cwd?: string): Promise<AgentResult> {
  const agent = getAgent(agentName)
  if (!agent) throw new Error(`Unknown agent: "${agentName}". Run 'anagent list' to see available agents.`)

  const anagentDir = resolveAnagentDir()
  initAnagentDir(anagentDir)

  const override = readPromptOverride(anagentDir, agentName)
  const systemPrompt = override
    ? `${agent.defaultSystemPrompt}\n\n## Project-specific criteria\n\n${override}`
    : agent.defaultSystemPrompt

  const raw = await callClaude(systemPrompt, input, cwd)
  const result = agent.parseOutput(raw)

  saveRun(anagentDir, {
    timestamp: new Date().toISOString(),
    agent: agentName,
    inputHash: hashInput(input),
    input,
    raw,
    result,
  })

  return result
}
