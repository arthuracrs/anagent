import type { AgentEvent } from './events.js'

export interface Normalizer {
  process(chunk: string): AgentEvent[]
  finish(exitCode: number): AgentEvent[]
}

export class PassthroughNormalizer implements Normalizer {
  private buffer = ''

  process(chunk: string): AgentEvent[] {
    this.buffer += chunk
    if (chunk.trim()) {
      return [{ type: 'text', delta: chunk }]
    }
    return []
  }

  finish(exitCode: number): AgentEvent[] {
    const text = this.buffer.trim()
    if (exitCode === 0) {
      return [{ type: 'done', exitCode: 0, output: text }]
    }
    return [{ type: 'failed', error: text.slice(0, 1000) || `Exit code ${exitCode}`, exitCode, output: text }]
  }
}

export function createNormalizer(id: string): Normalizer {
  if (id === 'claude-code' || id === 'cursor') {
    const { ClaudeCodeNormalizer } = require('./claude-code.js')
    return new ClaudeCodeNormalizer()
  }
  if (id === 'opencode') {
    const { OpenCodeNormalizer } = require('./opencode.js')
    return new OpenCodeNormalizer()
  }
  return new PassthroughNormalizer()
}
