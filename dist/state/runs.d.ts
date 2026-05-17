import type { AgentResult } from '../agents/base.js';
export interface RunRecord {
    timestamp: string;
    agent: string;
    inputHash: string;
    input: string;
    raw: string;
    result: AgentResult;
}
export declare function saveRun(dir: string, record: RunRecord): void;
export declare function loadRuns(dir: string, agentFilter?: string): RunRecord[];
export declare function hashInput(input: string): string;
