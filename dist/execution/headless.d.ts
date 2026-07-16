import type { RuntimeDefinition } from '../runtimes/base.js';
import { type ExecOpts } from './temp.js';
export declare function streamHeadless(runtime: RuntimeDefinition, systemPrompt: string, input: string, cwd?: string, execOpts?: ExecOpts): Promise<void>;
