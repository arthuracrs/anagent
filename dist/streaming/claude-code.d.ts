import type { AgentEvent } from './events.js';
import type { Normalizer } from './normalizer.js';
export declare class ClaudeCodeNormalizer implements Normalizer {
    private buf;
    private toolBlocks;
    private toolUseNames;
    private accumulatedOutput;
    private hasResult;
    process(chunk: string): AgentEvent[];
    finish(exitCode: number): AgentEvent[];
    private flushBuffer;
    private handleLine;
    private handleStreamEvent;
    private handleUserMessage;
    private handleResult;
}
