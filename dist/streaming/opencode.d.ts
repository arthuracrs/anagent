import type { AgentEvent } from './events.js';
import type { Normalizer } from './normalizer.js';
export declare class OpenCodeNormalizer implements Normalizer {
    private buf;
    private accumulatedOutput;
    private lastCost;
    private hasEvents;
    process(chunk: string): AgentEvent[];
    finish(exitCode: number): AgentEvent[];
    private flushBuffer;
    private handleEvent;
    private handleText;
    private handleToolUse;
    private handleStepFinish;
}
