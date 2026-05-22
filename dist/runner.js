"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = runAgent;
const registry_js_1 = require("./runtimes/registry.js");
const headless_js_1 = require("./execution/headless.js");
const tmux_js_1 = require("./execution/tmux.js");
async function runAgent(input, opts = {}) {
    const runtimeId = opts.runtime ?? process.env.ANAGENT_RUNTIME ?? 'claude-code';
    const runtime = (0, registry_js_1.getRuntime)(runtimeId);
    if (!runtime)
        throw new Error(`Unknown runtime: "${runtimeId}". Run 'anagent runtimes' to see available runtimes.`);
    const mode = opts.mode ?? runtime.defaultMode;
    const systemPrompt = opts.systemPrompt ?? '';
    return mode === 'headless'
        ? (0, headless_js_1.runHeadless)(runtime, systemPrompt, input, opts.cwd)
        : (0, tmux_js_1.runTmux)(runtime, systemPrompt, input, opts.cwd);
}
