"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamHeadless = streamHeadless;
const child_process_1 = require("child_process");
const temp_js_1 = require("./temp.js");
const emitter_js_1 = require("../streaming/emitter.js");
const normalizer_js_1 = require("../streaming/normalizer.js");
function streamHeadless(runtime, systemPrompt, input, cwd, execOpts) {
    const snippet = runtime.streamArgs
        ? runtime.headlessSnippet + ' ' + runtime.streamArgs
        : runtime.headlessSnippet;
    const files = (0, temp_js_1.createTempFiles)(systemPrompt, input, snippet, execOpts);
    const normalizer = (0, normalizer_js_1.createNormalizer)(runtime.normalizer);
    const startTime = Date.now();
    (0, emitter_js_1.emit)({ type: 'start', runtime: runtime.id, mode: 'headless', sessionId: files.sessionId });
    return new Promise((resolve) => {
        const proc = (0, child_process_1.spawn)(files.scriptPath, {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd,
        });
        proc.stdout?.on('data', (data) => {
            const chunk = data.toString();
            for (const event of normalizer.process(chunk))
                (0, emitter_js_1.emit)(event);
        });
        proc.stderr?.on('data', (data) => {
            const chunk = data.toString();
            for (const event of normalizer.process(chunk))
                (0, emitter_js_1.emit)(event);
        });
        proc.on('close', (code) => {
            const exitCode = code ?? -1;
            const elapsed = Date.now() - startTime;
            for (const event of normalizer.finish(exitCode)) {
                if (event.type === 'done')
                    (0, emitter_js_1.emit)({ ...event, durationMs: elapsed });
                else if (event.type === 'failed')
                    (0, emitter_js_1.emit)({ ...event, durationMs: elapsed });
            }
            (0, temp_js_1.cleanupTempFiles)(files);
            resolve();
        });
        proc.on('error', (err) => {
            (0, emitter_js_1.emit)({ type: 'failed', error: err.message, exitCode: -1, durationMs: Date.now() - startTime });
            (0, temp_js_1.cleanupTempFiles)(files);
            resolve();
        });
    });
}
