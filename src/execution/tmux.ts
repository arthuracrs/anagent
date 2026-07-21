import { execFile } from 'child_process'
import { promisify } from 'util'
import type { RuntimeDefinition } from '../runtimes/base.js'
import { createTempFiles, cleanupTempFiles, type ExecOpts } from './temp.js'
import { readSessionOutput } from './jsonl.js'
import { emit } from '../streaming/emitter.js'

const execFileAsync = promisify(execFile)

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

export async function runTmux(
  runtime: RuntimeDefinition,
  systemPrompt: string,
  input: string,
  cwd?: string,
  execOpts?: ExecOpts,
): Promise<string> {
  const timeoutMs = process.env.ANAGENT_TIMEOUT_SEC
    ? parseInt(process.env.ANAGENT_TIMEOUT_SEC, 10) * 1000
    : DEFAULT_TIMEOUT_MS
  const deadline = Date.now() + timeoutMs

  const files = createTempFiles(systemPrompt, input, runtime.tmuxSnippet, execOpts)
  const sessionName = `anagent-${files.id}`
  try {
    const tmuxArgs = ['new-session', '-d', '-s', sessionName, '-x', '220', '-y', '50']
    if (cwd) tmuxArgs.push('-c', cwd)
    tmuxArgs.push(files.scriptPath)
    await execFileAsync('tmux', tmuxArgs)
    await execFileAsync('tmux', ['set-option', '-t', sessionName, 'remain-on-exit', 'on'])
    console.log(`tmux attach -t ${sessionName}`)

    while (Date.now() < deadline) {
      await sleep(500)

      const { stdout } = await execFileAsync('tmux', [
        'display-message', '-p', '-t', sessionName, '#{pane_dead}',
      ])
      if (stdout.trim() === '1') break

      const jsonlOutput = await readSessionOutput(files.sessionId)
      if (jsonlOutput) return jsonlOutput

      if (Date.now() >= deadline) throw new Error(`Agent timed out after ${timeoutMs / 1000}s`)
    }

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
    try { await execFileAsync('tmux', ['set-option', '-t', sessionName, 'remain-on-exit', 'on']) } catch { /* already dead */ }
    cleanupTempFiles(files)
  }
}

export async function streamTmux(
  runtime: RuntimeDefinition,
  systemPrompt: string,
  input: string,
  cwd?: string,
  execOpts?: ExecOpts,
): Promise<void> {
  const timeoutMs = process.env.ANAGENT_TIMEOUT_SEC
    ? parseInt(process.env.ANAGENT_TIMEOUT_SEC, 10) * 1000
    : DEFAULT_TIMEOUT_MS
  const deadline = Date.now() + timeoutMs

  const files = createTempFiles(systemPrompt, input, runtime.tmuxSnippet, execOpts)
  const sessionName = `anagent-${files.id}`

  emit({ type: 'start', runtime: runtime.id, mode: 'tmux', sessionId: files.sessionId, tmuxSession: sessionName })
  console.log(`tmux attach -t ${sessionName}`)

  try {
    const tmuxArgs = ['new-session', '-d', '-s', sessionName, '-x', '220', '-y', '50']
    if (cwd) tmuxArgs.push('-c', cwd)
    tmuxArgs.push(files.scriptPath)
    await execFileAsync('tmux', tmuxArgs)
    await execFileAsync('tmux', ['set-option', '-t', sessionName, 'remain-on-exit', 'on'])

    while (Date.now() < deadline) {
      await sleep(500)

      const { stdout: paneInfo } = await execFileAsync('tmux', [
        'display-message', '-p', '-t', sessionName, '#{pane_dead}:#{pane_dead_status}',
      ])
      const [dead, statusStr] = paneInfo.trim().split(':')

      if (dead === '1') {
        const exitCode = parseInt(statusStr ?? '0', 10)
        const jsonlOutput = await readSessionOutput(files.sessionId)
        if (jsonlOutput) {
          if (exitCode === 0) {
            emit({ type: 'done', exitCode: 0, output: jsonlOutput })
          } else {
            emit({ type: 'failed', error: jsonlOutput.slice(0, 1000), exitCode, output: jsonlOutput })
          }
          return
        }
        const { stdout: output } = await execFileAsync('tmux', [
          'capture-pane', '-p', '-t', sessionName, '-S', '-500',
        ])
        const clean = output
          .split('\n')
          .map(l => l.trimEnd())
          .filter(l => !/^Pane is dead/.test(l))
          .join('\n')
          .trim()
        if (exitCode === 0) {
          emit({ type: 'done', exitCode: 0, output: clean })
        } else {
          emit({ type: 'failed', error: clean.slice(0, 1000) || `Exit code ${exitCode}`, exitCode, output: clean })
        }
        return
      }

      const jsonlOutput = await readSessionOutput(files.sessionId)
      if (jsonlOutput) {
        emit({ type: 'done', exitCode: 0, output: jsonlOutput })
        return
      }

      if (Date.now() >= deadline) {
        emit({ type: 'failed', error: `Agent timed out after ${timeoutMs / 1000}s`, exitCode: -1 })
        return
      }
    }

    // Process exited during sleep — fallback
    const { stdout: paneInfo } = await execFileAsync('tmux', [
      'display-message', '-p', '-t', sessionName, '#{pane_dead}:#{pane_dead_status}',
    ])
    const [dead, statusStr] = paneInfo.trim().split(':')
    const exitCode = dead === '1' ? parseInt(statusStr ?? '0', 10) : -1
    const jsonlOutput = await readSessionOutput(files.sessionId)
    const output = jsonlOutput || await capturePane(sessionName)
    if (exitCode === 0) {
      emit({ type: 'done', exitCode: 0, output })
    } else {
      emit({ type: 'failed', error: output.slice(0, 1000) || `Exit code ${exitCode}`, exitCode, output })
    }
  } catch (err) {
    emit({ type: 'failed', error: (err as Error).message, exitCode: -1 })
  } finally {
    try { await execFileAsync('tmux', ['set-option', '-t', sessionName, 'remain-on-exit', 'on']) } catch { /* ok */ }
    cleanupTempFiles(files)
  }
}

async function capturePane(sessionName: string): Promise<string> {
  try {
    const { stdout: output } = await execFileAsync('tmux', [
      'capture-pane', '-p', '-t', sessionName, '-S', '-500',
    ])
    return output
      .split('\n')
      .map(l => l.trimEnd())
      .filter(l => !/^Pane is dead/.test(l))
      .join('\n')
      .trim()
  } catch {
    return ''
  }
}
