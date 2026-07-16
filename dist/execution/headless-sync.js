"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runHeadlessSync = runHeadlessSync;
const child_process_1 = require("child_process");
const temp_js_1 = require("./temp.js");
function runHeadlessSync(runtime, systemPrompt, input, cwd, execOpts) {
    const files = (0, temp_js_1.createTempFiles)(systemPrompt, input, runtime.headlessSnippet, execOpts);
    try {
        const result = (0, child_process_1.spawnSync)(files.scriptPath, {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd,
        });
        if (result.status !== 0) {
            const stderr = result.stderr?.toString().trim() ?? '';
            throw new Error(`Agent process exited with code ${result.status}${stderr ? `: ${stderr}` : ''}`);
        }
        return result.stdout.toString().trim();
    }
    finally {
        (0, temp_js_1.cleanupTempFiles)(files);
    }
}
