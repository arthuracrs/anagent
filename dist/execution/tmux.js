"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTmux = runTmux;
const child_process_1 = require("child_process");
const util_1 = require("util");
const temp_js_1 = require("./temp.js");
const jsonl_js_1 = require("./jsonl.js");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
async function runTmux(runtime, systemPrompt, input, cwd) {
    const timeoutMs = process.env.ANAGENT_TIMEOUT_SEC
        ? parseInt(process.env.ANAGENT_TIMEOUT_SEC, 10) * 1000
        : DEFAULT_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    const files = (0, temp_js_1.createTempFiles)(systemPrompt, input, runtime.tmuxSnippet);
    const sessionName = `anagent-${files.id}`;
    try {
        const tmuxArgs = ['new-session', '-d', '-s', sessionName, '-x', '220', '-y', '50'];
        if (cwd)
            tmuxArgs.push('-c', cwd);
        tmuxArgs.push(files.scriptPath);
        await execFileAsync('tmux', tmuxArgs);
        await execFileAsync('tmux', ['set-option', '-t', sessionName, 'remain-on-exit', 'on']);
        console.log(sessionName);
        while (Date.now() < deadline) {
            await sleep(500);
            // Check if the process exited (headless runtimes)
            const { stdout } = await execFileAsync('tmux', [
                'display-message', '-p', '-t', sessionName, '#{pane_dead}',
            ]);
            if (stdout.trim() === '1')
                break;
            // Check JSONL for a completed response (interactive runtimes like claude-code
            // never exit on their own — they wait for more input)
            const jsonlOutput = await (0, jsonl_js_1.readSessionOutput)(files.sessionId);
            if (jsonlOutput)
                return jsonlOutput;
            if (Date.now() >= deadline)
                throw new Error(`Agent timed out after ${timeoutMs / 1000}s`);
        }
        // Process exited — try JSONL first, fall back to terminal capture
        const jsonlOutput = await (0, jsonl_js_1.readSessionOutput)(files.sessionId);
        if (jsonlOutput)
            return jsonlOutput;
        const { stdout: output } = await execFileAsync('tmux', [
            'capture-pane', '-p', '-t', sessionName, '-S', '-500',
        ]);
        return output
            .split('\n')
            .map(l => l.trimEnd())
            .filter(l => !/^Pane is dead/.test(l))
            .join('\n')
            .trim();
    }
    finally {
        try {
            await execFileAsync('tmux', ['kill-session', '-t', sessionName]);
        }
        catch { /* already dead */ }
        (0, temp_js_1.cleanupTempFiles)(files);
    }
}
