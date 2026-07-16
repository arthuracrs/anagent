import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'

export interface TempFiles {
  id: string
  sessionId: string
  syspromptPath: string
  inputPath: string
  scriptPath: string
}

export interface ExecOpts {
  resume?: string
  sessionId?: string
  mcpConfigPath?: string
}

export function createTempFiles(
  systemPrompt: string,
  input: string,
  snippet: string,
  opts?: ExecOpts,
): TempFiles {
  const id = crypto.randomBytes(6).toString('hex')
  // When resuming, the session id IS the resume id (for JSONL lookup).
  // When an explicit sessionId is provided, use it. Otherwise generate one.
  const sessionId = opts?.resume ?? opts?.sessionId ?? crypto.randomUUID()
  const tmpDir = os.tmpdir()
  const syspromptPath = path.join(tmpDir, `anagent-sys-${id}.txt`)
  const inputPath = path.join(tmpDir, `anagent-in-${id}.txt`)
  const scriptPath = path.join(tmpDir, `anagent-run-${id}.sh`)

  const resume = opts?.resume ?? ''
  const mcpConfig = opts?.mcpConfigPath ?? ''

  fs.writeFileSync(syspromptPath, systemPrompt, 'utf8')
  fs.writeFileSync(inputPath, input, 'utf8')
  fs.writeFileSync(scriptPath, [
    '#!/bin/bash',
    `SYSPROMPT=$(cat "${syspromptPath}")`,
    `INPUT=$(cat "${inputPath}")`,
    `SESSION_ID="${sessionId}"`,
    `RESUME="${resume}"`,
    `MCP_CONFIG="${mcpConfig}"`,
    snippet,
  ].join('\n'), 'utf8')
  fs.chmodSync(scriptPath, '755')

  return { id, sessionId, syspromptPath, inputPath, scriptPath }
}

export function cleanupTempFiles(files: TempFiles): void {
  for (const f of [files.syspromptPath, files.inputPath, files.scriptPath]) {
    try { fs.unlinkSync(f) } catch { /* ok */ }
  }
}
