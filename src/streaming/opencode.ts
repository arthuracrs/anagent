import type { AgentEvent } from './events.js'
import type { Normalizer } from './normalizer.js'

export class OpenCodeNormalizer implements Normalizer {
  private buf = ''
  private accumulatedOutput = ''
  private lastCost = 0
  private hasEvents = false

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
        const parsed = this.handleEvent(ev)
        events.push(...parsed)
      } catch {
        events.push({ type: 'text', delta: trimmed + '\n' })
      }
    }
    return events
  }

  finish(exitCode: number): AgentEvent[] {
    const events = this.flushBuffer()
    if (exitCode === 0 && this.hasEvents) {
      events.push({
        type: 'done',
        exitCode: 0,
        output: this.accumulatedOutput.trim(),
        costUsd: this.lastCost > 0 ? this.lastCost : undefined,
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
      return this.handleEvent(ev)
    } catch {
      return [{ type: 'text', delta: remaining + '\n' }]
    }
  }

  private handleEvent(ev: Record<string, unknown>): AgentEvent[] {
    const type = ev.type as string

    if (type === 'text') {
      return this.handleText(ev)
    }

    if (type === 'tool_use') {
      return this.handleToolUse(ev)
    }

    if (type === 'step_finish') {
      return this.handleStepFinish(ev)
    }

    // step_start and others: ignored
    return []
  }

  private handleText(ev: Record<string, unknown>): AgentEvent[] {
    const part = ev.part as Record<string, unknown> | undefined
    if (!part) return []
    const text = part.text as string
    if (!text) return []
    this.accumulatedOutput += text
    this.hasEvents = true
    return [{ type: 'text', delta: text }]
  }

  private handleToolUse(ev: Record<string, unknown>): AgentEvent[] {
    const part = ev.part as Record<string, unknown> | undefined
    if (!part) return []
    const tool = part.tool as string
    const callID = part.callID as string || ''
    const state = part.state as Record<string, unknown> | undefined
    if (!state) return []
    this.hasEvents = true

    const input = state.input as Record<string, unknown> || {}
    const isError = (state.status as string) === 'error'
    const metadata = state.metadata as Record<string, unknown> | undefined
    const rawOutput = (state.output as string) || metadata?.output as string || ''
    const output = rawOutput.trim()

    if (!output && !isError) return []

    return [{
      type: 'tool_result',
      id: callID,
      name: tool,
      text: output,
      isError,
    }]
  }

  private handleStepFinish(ev: Record<string, unknown>): AgentEvent[] {
    const part = ev.part as Record<string, unknown> | undefined
    if (!part) return []
    const cost = part.cost as number
    if (typeof cost === 'number') this.lastCost = cost
    return []
  }
}
