import fs from 'fs'
import os from 'os'
import path from 'path'

const NON_TERMINAL_STOP_REASONS = new Set(['tool_use', 'pause_turn'])

function findSessionJsonl(sessionId: string): string | null {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects')
  if (!fs.existsSync(projectsDir)) return null
  for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const candidate = path.join(projectsDir, entry.name, `${sessionId}.jsonl`)
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((b): b is { type: string; text: string } =>
      typeof b === 'object' && b !== null && (b as Record<string, unknown>).type === 'text')
    .map(b => b.text)
    .join('')
    .trim()
}

export function extractFromJsonl(content: string): string | null {
  let lastText: string | null = null
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>
      if (event.type !== 'assistant') continue
      const msg = event.message as Record<string, unknown> | undefined
      if (!msg) continue
      const stopReason = msg.stop_reason as string | undefined
      if (!stopReason || NON_TERMINAL_STOP_REASONS.has(stopReason)) continue
      const text = extractText(msg.content)
      if (text) lastText = text
    } catch { /* skip malformed lines */ }
  }
  return lastText
}

function readJsonlText(filePath: string): string | null {
  let lastText: string | null = null
  try {
    return extractFromJsonl(fs.readFileSync(filePath, 'utf8'))
  } catch { return null }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function readSessionOutput(sessionId: string): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    const filePath = findSessionJsonl(sessionId)
    if (filePath) {
      const text = readJsonlText(filePath)
      if (text) return text
    }
    await sleep(200)
  }
  return null
}
