import { getRuntime } from './runtimes/registry.js'
import { runHeadlessSync } from './execution/headless-sync.js'
import { streamHeadless } from './execution/headless.js'
import { runTmux, streamTmux } from './execution/tmux.js'
import type { ExecOpts } from './execution/temp.js'

export async function runAgent(
  input: string,
  opts: {
    systemPrompt?: string
    runtime?: string
    mode?: 'headless' | 'tmux'
    cwd?: string
    stream?: boolean
    resume?: string
    sessionId?: string
    mcpConfigPath?: string
  } = {},
): Promise<string | void> {
  const runtimeId = opts.runtime ?? process.env.ANAGENT_RUNTIME ?? 'opencode'
  const runtime = getRuntime(runtimeId)
  if (!runtime) throw new Error(`Unknown runtime: "${runtimeId}". Run 'anagent runtimes' to see available runtimes.`)

  const mode = opts.mode ?? runtime.defaultMode
  const systemPrompt = opts.systemPrompt ?? ''
  const execOpts: ExecOpts = {
    resume: opts.resume,
    sessionId: opts.sessionId,
    mcpConfigPath: opts.mcpConfigPath,
  }

  if (opts.stream) {
    if (mode === 'headless') {
      await streamHeadless(runtime, systemPrompt, input, opts.cwd, execOpts)
    } else {
      await streamTmux(runtime, systemPrompt, input, opts.cwd, execOpts)
    }
    return
  }

  return mode === 'headless'
    ? runHeadlessSync(runtime, systemPrompt, input, opts.cwd, execOpts)
    : runTmux(runtime, systemPrompt, input, opts.cwd, execOpts)
}
