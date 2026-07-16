import type { AgentEvent } from './events.js'
import type { Normalizer } from './normalizer.js'

export class ClaudeCodeNormalizer implements Normalizer {
  private buf = ''
  private toolBlocks = new Map<number, { name: string; id?: string; inputJson: string }>()
  private toolUseNames = new Map<string, string>()
  private accumulatedOutput = ''
  private hasResult = false

  process(chunk: string): AgentEvent[] {
    const events: AgentEvent[] = []
    this.buf += chunk
    const lines = this.buf.split('\n')
    this.buf = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const ev = JSON.parse(trimmed) as Record<string, unknown>
        const parsed = this.handleLine(ev)
        events.push(...parsed)
      } catch {
        events.push({ type: 'text', delta: trimmed + '\n' })
      }
    }
    return events
  }

  finish(exitCode: number): AgentEvent[] {
    const events = this.flushBuffer()
    if (exitCode === 0 && this.hasResult) {
      events.push({
        type: 'done',
        exitCode: 0,
        output: this.accumulatedOutput.trim(),
      })
    } else {
      events.push({
        type: 'failed',
        error: this.accumulatedOutput.trim().slice(0, 1000) || `Exit code ${exitCode}`,
        exitCode,
        output: this.accumulatedOutput.trim(),
      })
    }
    return events
  }

  private flushBuffer(): AgentEvent[] {
    const remaining = this.buf.trim()
    this.buf = ''
    if (!remaining) return []
    try {
      const ev = JSON.parse(remaining) as Record<string, unknown>
      return this.handleLine(ev)
    } catch {
      return [{ type: 'text', delta: remaining + '\n' }]
    }
  }

  private handleLine(ev: Record<string, unknown>): AgentEvent[] {
    if (ev.type === 'stream_event') {
      return this.handleStreamEvent((ev.event as Record<string, unknown>) ?? {})
    }
    if (ev.type === 'user') {
      return this.handleUserMessage((ev.message as Record<string, unknown>) ?? {})
    }
    if (ev.type === 'result') {
      return this.handleResult(ev)
    }
    return []
  }

  private handleStreamEvent(event: Record<string, unknown>): AgentEvent[] {
    const type = event.type as string
    if (type === 'content_block_start') {
      const block = event.content_block as Record<string, unknown> | undefined
      if (block?.type === 'tool_use') {
        const id = block.id as string
        this.toolUseNames.set(id, block.name as string)
        this.toolBlocks.set(event.index as number, {
          name: block.name as string,
          id,
          inputJson: '',
        })
      }
      return []
    }

    if (type === 'content_block_delta') {
      const delta = event.delta as Record<string, unknown> | undefined
      if (delta?.type === 'text_delta') {
        const text = delta.text as string
        this.accumulatedOutput += text
        return [{ type: 'text', delta: text }]
      }
      if (delta?.type === 'input_json_delta') {
        const block = this.toolBlocks.get(event.index as number)
        if (block) block.inputJson += (delta.partial_json as string) ?? ''
      }
      return []
    }

    if (type === 'content_block_stop') {
      const block = this.toolBlocks.get(event.index as number)
      if (block) {
        this.toolBlocks.delete(event.index as number)
        let input: Record<string, unknown> = {}
        try { input = JSON.parse(block.inputJson || '{}') } catch { /* partial or empty */ }
        return [{
          type: 'tool_use',
          id: block.id ?? String(event.index),
          name: block.name,
          input,
        }]
      }
    }

    return []
  }

  private handleUserMessage(message: Record<string, unknown>): AgentEvent[] {
    const content = (message.content as Record<string, unknown>[]) ?? []
    const events: AgentEvent[] = []
    for (const block of content) {
      if (block.type === 'tool_result') {
        const rawContent = block.content
        const blocks = Array.isArray(rawContent) ? rawContent : [rawContent]
        const text = blocks
          .filter((c): c is { type: string; text: string } =>
            typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'text')
          .map(c => c.text)
          .join('')
          .trim()
        if (text) {
          const toolUseId = block.tool_use_id as string
          events.push({
            type: 'tool_result',
            id: toolUseId,
            name: this.toolUseNames.get(toolUseId) ?? '',
            text,
            isError: !!block.is_error,
          })
        }
      }
    }
    return events
  }

  private handleResult(ev: Record<string, unknown>): AgentEvent[] {
    this.hasResult = true
    const events: AgentEvent[] = [{ type: 'text', delta: '\n' }]
    const cost = typeof ev.total_cost_usd === 'number' ? (ev.total_cost_usd as number) : undefined
    const msg = cost !== undefined
      ? `\x1b[2m[done · $${cost.toFixed(4)}]\x1b[0m\n`
      : '\x1b[2m[done]\x1b[0m\n'
    events.push({ type: 'text', delta: msg })
    return events
  }
}
