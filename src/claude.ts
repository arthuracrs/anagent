import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'

const execFileAsync = promisify(execFile)

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function callClaude(systemPrompt: string, userInput: string, cwd?: string): Promise<string> {
  const id = crypto.randomBytes(6).toString('hex')
  const sessionName = `anagent-${id}`
  const tmpDir = os.tmpdir()
  const syspromptPath = path.join(tmpDir, `anagent-sys-${id}.txt`)
  const inputPath = path.join(tmpDir, `anagent-in-${id}.txt`)
  const scriptPath = path.join(tmpDir, `anagent-run-${id}.sh`)

  fs.writeFileSync(syspromptPath, systemPrompt, 'utf8')
  fs.writeFileSync(inputPath, userInput, 'utf8')
  fs.writeFileSync(scriptPath, [
    '#!/bin/bash',
    `SYSPROMPT=$(cat "${syspromptPath}")`,
    `INPUT=$(cat "${inputPath}")`,
    `claude --dangerously-skip-permissions --system-prompt "$SYSPROMPT" -p "$INPUT"`,
  ].join('\n'), 'utf8')
  fs.chmodSync(scriptPath, '755')

  try {
    const tmuxArgs = [
      'new-session', '-d', '-s', sessionName,
      '-x', '220', '-y', '50',
    ]
    if (cwd) tmuxArgs.push('-c', cwd)
    tmuxArgs.push(scriptPath)
    await execFileAsync('tmux', tmuxArgs)
    await execFileAsync('tmux', ['set-option', '-t', sessionName, 'remain-on-exit', 'on'])

    // Poll until pane exits
    for (let i = 0; i < 120; i++) {
      await sleep(500)
      const { stdout } = await execFileAsync('tmux', [
        'display-message', '-p', '-t', sessionName, '#{pane_dead}',
      ])
      if (stdout.trim() === '1') break
      if (i === 119) throw new Error('Agent timed out after 60 seconds')
    }

    const { stdout: output } = await execFileAsync('tmux', [
      'capture-pane', '-p', '-t', sessionName, '-S', '-500',
    ])

    return output
      .split('\n')
      .map(l => l.trimEnd())
      // Strip tmux status lines appended when remain-on-exit fires
      .filter(l => !/^Pane is dead/.test(l))
      .join('\n')
      .trim()
  } finally {
    try { await execFileAsync('tmux', ['kill-session', '-t', sessionName]) } catch { /* already dead */ }
    for (const f of [syspromptPath, inputPath, scriptPath]) {
      try { fs.unlinkSync(f) } catch { /* ok */ }
    }
  }
}
