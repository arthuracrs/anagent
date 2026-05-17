export interface AgentDefinition {
    name: string;
    description: string;
    defaultSystemPrompt: string;
    parseOutput(raw: string): AgentResult;
}
export interface AgentResult {
    verdict: 'APPROVED' | 'REJECTED' | 'INFO';
    reason: string;
    raw: string;
}
