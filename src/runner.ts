import { getRuntime } from './runtimes/registry.js'
import { runHeadlessSync } from './execution/headless-sync.js'
import { streamHeadless } from './execution/headless.js'
import { runTmux } from './execution/tmux.js'

export async function runAgent(
  input: string,
  opts: { systemPrompt?: string; runtime?: string; mode?: 'headless' | 'tmux'; cwd?: string; stream?: boolean } = {},
): Promise<string | void> {
  const runtimeId = opts.runtime ?? process.env.ANAGENT_RUNTIME ?? 'opencode'
  const runtime = getRuntime(runtimeId)
  if (!runtime) throw new Error(`Unknown runtime: "${runtimeId}". Run 'anagent runtimes' to see available runtimes.`)

  const mode = opts.mode ?? runtime.defaultMode
  const systemPrompt = opts.systemPrompt ?? ''

  if (opts.stream) {
    if (mode === 'headless') {
      await streamHeadless(runtime, systemPrompt, input, opts.cwd)
    } else {
      throw new Error('Streaming in tmux mode is not yet implemented. Use --mode headless or omit --stream.')
    }
    return
  }

  return mode === 'headless'
    ? runHeadlessSync(runtime, systemPrompt, input, opts.cwd)
    : runTmux(runtime, systemPrompt, input, opts.cwd)
}
