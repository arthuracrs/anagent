import { execFile } from 'child_process'
import { promisify } from 'util'
import type { RuntimeDefinition } from '../runtimes/base.js'
import { createTempFiles, cleanupTempFiles } from './temp.js'
import { readSessionOutput } from './jsonl.js'

const execFileAsync = promisify(execFile)

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function runTmux(runtime: RuntimeDefinition, systemPrompt: string, input: string, cwd?: string): Promise<string> {
  const files = createTempFiles(systemPrompt, input, runtime.tmuxSnippet)
  const sessionName = `anagent-${files.id}`
  try {
    const tmuxArgs = ['new-session', '-d', '-s', sessionName, '-x', '220', '-y', '50']
    if (cwd) tmuxArgs.push('-c', cwd)
    tmuxArgs.push(files.scriptPath)
    await execFileAsync('tmux', tmuxArgs)
    await execFileAsync('tmux', ['set-option', '-t', sessionName, 'remain-on-exit', 'on'])

    for (let i = 0; i < 120; i++) {
      await sleep(500)
      const { stdout } = await execFileAsync('tmux', [
        'display-message', '-p', '-t', sessionName, '#{pane_dead}',
      ])
      if (stdout.trim() === '1') break
      if (i === 119) throw new Error('Agent timed out after 60 seconds')
    }

    // Prefer session JSONL (lossless) over terminal capture
    const jsonlOutput = await readSessionOutput(files.sessionId)
    if (jsonlOutput) return jsonlOutput

    const { stdout: output } = await execFileAsync('tmux', [
      'capture-pane', '-p', '-t', sessionName, '-S', '-500',
    ])

    return output
      .split('\n')
      .map(l => l.trimEnd())
      .filter(l => !/^Pane is dead/.test(l))
      .join('\n')
      .trim()
  } finally {
    try { await execFileAsync('tmux', ['kill-session', '-t', sessionName]) } catch { /* already dead */ }
    cleanupTempFiles(files)
  }
}
