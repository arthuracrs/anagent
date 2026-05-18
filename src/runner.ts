import { resolveAnagentDir, initAnagentDir } from './state/storage.js'
import { saveRun, hashInput } from './state/runs.js'
import { getRuntime } from './runtimes/registry.js'
import { runHeadless } from './execution/headless.js'
import { runTmux } from './execution/tmux.js'

export async function runAgent(
  input: string,
  opts: { systemPrompt?: string; runtime?: string; mode?: 'headless' | 'tmux'; cwd?: string } = {},
): Promise<string> {
  const runtimeId = opts.runtime ?? process.env.ANAGENT_RUNTIME ?? 'claude-code'
  const runtime = getRuntime(runtimeId)
  if (!runtime) throw new Error(`Unknown runtime: "${runtimeId}". Run 'anagent runtimes' to see available runtimes.`)

  const mode = opts.mode ?? runtime.defaultMode
  const systemPrompt = opts.systemPrompt ?? ''

  const anagentDir = resolveAnagentDir()
  initAnagentDir(anagentDir)

  const raw = mode === 'headless'
    ? runHeadless(runtime, systemPrompt, input, opts.cwd)
    : await runTmux(runtime, systemPrompt, input, opts.cwd)

  saveRun(anagentDir, {
    timestamp: new Date().toISOString(),
    runtime: runtimeId,
    mode,
    inputHash: hashInput(input),
    input,
    raw,
  })

  return raw
}
