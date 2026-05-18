import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { AgentResult } from '../agents/base.js'

export interface RunRecord {
  timestamp: string
  agent: string
  runtime: string
  mode: 'headless' | 'tmux'
  inputHash: string
  input: string
  raw: string
  result: AgentResult
}

export function saveRun(dir: string, record: RunRecord): void {
  const runsDir = path.join(dir, 'runs')
  fs.mkdirSync(runsDir, { recursive: true })
  const ts = record.timestamp.replace(/[:.]/g, '-')
  const file = path.join(runsDir, `${ts}_${record.agent}_${record.inputHash.slice(0, 8)}.json`)
  fs.writeFileSync(file, JSON.stringify(record, null, 2))
}

export function loadRuns(dir: string, agentFilter?: string): RunRecord[] {
  const runsDir = path.join(dir, 'runs')
  if (!fs.existsSync(runsDir)) return []
  return fs.readdirSync(runsDir)
    .filter(f => f.endsWith('.json'))
    .filter(f => !agentFilter || f.includes(`_${agentFilter}_`))
    .sort()
    .reverse()
    .map(f => JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8')) as RunRecord)
}

export function hashInput(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}
