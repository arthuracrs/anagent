import type { AgentDefinition } from './base.js'
import { validatorAgent } from './validator.js'
import { developerAgent, reviewerAgent } from './roles.js'

const registry = new Map<string, AgentDefinition>([
  ['validator',  validatorAgent],
  ['developer',  developerAgent],
  ['reviewer',   reviewerAgent],
])

export function getAgent(name: string): AgentDefinition | undefined {
  return registry.get(name)
}

export function listAgents(): AgentDefinition[] {
  return Array.from(registry.values())
}
