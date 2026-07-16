import type { RuntimeDefinition } from '../runtimes/base.js';
export declare function streamHeadless(runtime: RuntimeDefinition, systemPrompt: string, input: string, cwd?: string): Promise<void>;
