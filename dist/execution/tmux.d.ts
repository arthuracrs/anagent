import type { RuntimeDefinition } from '../runtimes/base.js';
export declare function runTmux(runtime: RuntimeDefinition, systemPrompt: string, input: string, cwd?: string): Promise<string>;
export declare function streamTmux(runtime: RuntimeDefinition, systemPrompt: string, input: string, cwd?: string): Promise<void>;
