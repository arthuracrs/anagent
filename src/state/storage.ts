import fs from 'fs'
import path from 'path'

const DIR_NAME = '.anagent'

export function resolveAnagentDir(from: string = process.cwd()): string {
  let current = from
  while (true) {
    const candidate = path.join(current, DIR_NAME)
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return path.join(from, DIR_NAME)
}

export function initAnagentDir(dir: string): void {
  fs.mkdirSync(path.join(dir, 'prompts'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'runs'), { recursive: true })
}

export function readPromptOverride(dir: string, agentName: string): string | null {
  const file = path.join(dir, 'prompts', `${agentName}.md`)
  if (!fs.existsSync(file)) return null
  return fs.readFileSync(file, 'utf8').trim()
}
