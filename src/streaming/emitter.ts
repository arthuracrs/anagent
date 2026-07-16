import type { AgentEvent } from './events.js'

export function emit(event: AgentEvent): void {
  process.stdout.write(JSON.stringify(event) + '\n')
}
