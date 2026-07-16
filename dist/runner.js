"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = runAgent;
const registry_js_1 = require("./runtimes/registry.js");
const headless_sync_js_1 = require("./execution/headless-sync.js");
const headless_js_1 = require("./execution/headless.js");
const tmux_js_1 = require("./execution/tmux.js");
async function runAgent(input, opts = {}) {
    const runtimeId = opts.runtime ?? process.env.ANAGENT_RUNTIME ?? 'opencode';
    const runtime = (0, registry_js_1.getRuntime)(runtimeId);
    if (!runtime)
        throw new Error(`Unknown runtime: "${runtimeId}". Run 'anagent runtimes' to see available runtimes.`);
    const mode = opts.mode ?? runtime.defaultMode;
    const systemPrompt = opts.systemPrompt ?? '';
    const execOpts = {
        resume: opts.resume,
        sessionId: opts.sessionId,
        mcpConfigPath: opts.mcpConfigPath,
    };
    if (opts.stream) {
        if (mode === 'headless') {
            await (0, headless_js_1.streamHeadless)(runtime, systemPrompt, input, opts.cwd, execOpts);
        }
        else {
            await (0, tmux_js_1.streamTmux)(runtime, systemPrompt, input, opts.cwd, execOpts);
        }
        return;
    }
    return mode === 'headless'
        ? (0, headless_sync_js_1.runHeadlessSync)(runtime, systemPrompt, input, opts.cwd, execOpts)
        : (0, tmux_js_1.runTmux)(runtime, systemPrompt, input, opts.cwd, execOpts);
}
