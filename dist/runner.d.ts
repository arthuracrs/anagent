import type { AgentResult } from './agents/base.js';
export declare function runAgent(agentName: string, input: string, cwd?: string): Promise<AgentResult>;
