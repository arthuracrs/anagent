import { spawn } from 'child_process'
import type { RuntimeDefinition } from '../runtimes/base.js'
import { createTempFiles, cleanupTempFiles, type ExecOpts } from './temp.js'
import { emit } from '../streaming/emitter.js'
import { createNormalizer } from '../streaming/normalizer.js'

export function streamHeadless(
  runtime: RuntimeDefinition,
  systemPrompt: string,
  input: string,
  cwd?: string,
  execOpts?: ExecOpts,
): Promise<void> {
  const snippet = runtime.streamArgs
    ? runtime.headlessSnippet + ' ' + runtime.streamArgs
    : runtime.headlessSnippet
  const files = createTempFiles(systemPrompt, input, snippet, execOpts)
  const normalizer = createNormalizer(runtime.normalizer)
  const startTime = Date.now()

  emit({ type: 'start', runtime: runtime.id, mode: 'headless', sessionId: files.sessionId })

  return new Promise<void>((resolve) => {
    const proc = spawn(files.scriptPath, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd,
    })

    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString()
      for (const event of normalizer.process(chunk)) emit(event)
    })

    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString()
      for (const event of normalizer.process(chunk)) emit(event)
    })

    proc.on('close', (code) => {
      const exitCode = code ?? -1
      const elapsed = Date.now() - startTime
      for (const event of normalizer.finish(exitCode)) {
        if (event.type === 'done') emit({ ...event, durationMs: elapsed })
        else if (event.type === 'failed') emit({ ...event, durationMs: elapsed })
      }
      cleanupTempFiles(files)
      resolve()
    })

    proc.on('error', (err) => {
      emit({ type: 'failed', error: err.message, exitCode: -1, durationMs: Date.now() - startTime })
      cleanupTempFiles(files)
      resolve()
    })
  })
}
