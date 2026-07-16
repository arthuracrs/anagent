import type { RuntimeDefinition } from '../runtimes/base.js';
import { type ExecOpts } from './temp.js';
export declare function runTmux(runtime: RuntimeDefinition, systemPrompt: string, input: string, cwd?: string, execOpts?: ExecOpts): Promise<string>;
export declare function streamTmux(runtime: RuntimeDefinition, systemPrompt: string, input: string, cwd?: string, execOpts?: ExecOpts): Promise<void>;
