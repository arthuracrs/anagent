import { spawnSync } from 'child_process'
import type { RuntimeDefinition } from '../runtimes/base.js'
import { createTempFiles, cleanupTempFiles, type ExecOpts } from './temp.js'

export function runHeadlessSync(
  runtime: RuntimeDefinition,
  systemPrompt: string,
  input: string,
  cwd?: string,
  execOpts?: ExecOpts,
): string {
  const files = createTempFiles(systemPrompt, input, runtime.headlessSnippet, execOpts)
  try {
    const result = spawnSync(files.scriptPath, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd,
    })
    if (result.status !== 0) {
      const stderr = result.stderr?.toString().trim() ?? ''
      throw new Error(`Agent process exited with code ${result.status}${stderr ? `: ${stderr}` : ''}`)
    }
    return result.stdout.toString().trim()
  } finally {
    cleanupTempFiles(files)
  }
}
