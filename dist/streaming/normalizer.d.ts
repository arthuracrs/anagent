import type { AgentEvent } from './events.js';
export interface Normalizer {
    process(chunk: string): AgentEvent[];
    finish(exitCode: number): AgentEvent[];
}
export declare class PassthroughNormalizer implements Normalizer {
    private buffer;
    process(chunk: string): AgentEvent[];
    finish(exitCode: number): AgentEvent[];
}
export declare function createNormalizer(id: string): Normalizer;
