export interface StartEvent {
  type: 'start'
  runtime: string
  mode: string
  sessionId: string
  tmuxSession?: string
}

export interface TextEvent {
  type: 'text'
  delta: string
}

export interface ToolUseEvent {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultEvent {
  type: 'tool_result'
  id: string
  name: string
  text: string
  isError: boolean
}

export interface DoneEvent {
  type: 'done'
  exitCode: number
  durationMs?: number
  output?: string
  costUsd?: number
}

export interface FailedEvent {
  type: 'failed'
  error: string
  exitCode: number
  durationMs?: number
  output?: string
}

export type AgentEvent = StartEvent | TextEvent | ToolUseEvent | ToolResultEvent | DoneEvent | FailedEvent
