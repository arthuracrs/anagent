"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTmux = runTmux;
exports.streamTmux = streamTmux;
const child_process_1 = require("child_process");
const util_1 = require("util");
const temp_js_1 = require("./temp.js");
const jsonl_js_1 = require("./jsonl.js");
const emitter_js_1 = require("../streaming/emitter.js");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
async function runTmux(runtime, systemPrompt, input, cwd, execOpts) {
    const timeoutMs = process.env.ANAGENT_TIMEOUT_SEC
        ? parseInt(process.env.ANAGENT_TIMEOUT_SEC, 10) * 1000
        : DEFAULT_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    const files = (0, temp_js_1.createTempFiles)(systemPrompt, input, runtime.tmuxSnippet, execOpts);
    const sessionName = `anagent-${files.id}`;
    try {
        await execFileAsync('tmux', ['set-option', '-g', 'remain-on-exit', 'on']);
        const tmuxArgs = ['new-session', '-d', '-s', sessionName, '-x', '220', '-y', '50'];
        if (cwd)
            tmuxArgs.push('-c', cwd);
        tmuxArgs.push(files.scriptPath);
        await execFileAsync('tmux', tmuxArgs);
        await execFileAsync('tmux', ['set-option', '-g', 'remain-on-exit', 'off']);
        await execFileAsync('tmux', ['set-option', '-t', sessionName, 'remain-on-exit', 'on']);
        console.log(`tmux attach -t ${sessionName}`);
        while (Date.now() < deadline) {
            await sleep(500);
            const { stdout } = await execFileAsync('tmux', [
                'display-message', '-p', '-t', sessionName, '#{pane_dead}',
            ]);
            if (stdout.trim() === '1')
                break;
            const jsonlOutput = await (0, jsonl_js_1.readSessionOutput)(files.sessionId);
            if (jsonlOutput)
                return jsonlOutput;
            if (Date.now() >= deadline)
                throw new Error(`Agent timed out after ${timeoutMs / 1000}s`);
        }
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
            await execFileAsync('tmux', ['set-option', '-t', sessionName, 'remain-on-exit', 'on']);
        }
        catch { /* already dead */ }
        (0, temp_js_1.cleanupTempFiles)(files);
    }
}
async function streamTmux(runtime, systemPrompt, input, cwd, execOpts) {
    const timeoutMs = process.env.ANAGENT_TIMEOUT_SEC
        ? parseInt(process.env.ANAGENT_TIMEOUT_SEC, 10) * 1000
        : DEFAULT_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    const files = (0, temp_js_1.createTempFiles)(systemPrompt, input, runtime.tmuxSnippet, execOpts);
    const sessionName = `anagent-${files.id}`;
    (0, emitter_js_1.emit)({ type: 'start', runtime: runtime.id, mode: 'tmux', sessionId: files.sessionId, tmuxSession: sessionName });
    console.log(`tmux attach -t ${sessionName}`);
    try {
        await execFileAsync('tmux', ['set-option', '-g', 'remain-on-exit', 'on']);
        const tmuxArgs = ['new-session', '-d', '-s', sessionName, '-x', '220', '-y', '50'];
        if (cwd)
            tmuxArgs.push('-c', cwd);
        tmuxArgs.push(files.scriptPath);
        await execFileAsync('tmux', tmuxArgs);
        await execFileAsync('tmux', ['set-option', '-g', 'remain-on-exit', 'off']);
        await execFileAsync('tmux', ['set-option', '-t', sessionName, 'remain-on-exit', 'on']);
        while (Date.now() < deadline) {
            await sleep(500);
            const { stdout: paneInfo } = await execFileAsync('tmux', [
                'display-message', '-p', '-t', sessionName, '#{pane_dead}:#{pane_dead_status}',
            ]);
            const [dead, statusStr] = paneInfo.trim().split(':');
            if (dead === '1') {
                const exitCode = parseInt(statusStr ?? '0', 10);
                const jsonlOutput = await (0, jsonl_js_1.readSessionOutput)(files.sessionId);
                if (jsonlOutput) {
                    if (exitCode === 0) {
                        (0, emitter_js_1.emit)({ type: 'done', exitCode: 0, output: jsonlOutput });
                    }
                    else {
                        (0, emitter_js_1.emit)({ type: 'failed', error: jsonlOutput.slice(0, 1000), exitCode, output: jsonlOutput });
                    }
                    return;
                }
                const { stdout: output } = await execFileAsync('tmux', [
                    'capture-pane', '-p', '-t', sessionName, '-S', '-500',
                ]);
                const clean = output
                    .split('\n')
                    .map(l => l.trimEnd())
                    .filter(l => !/^Pane is dead/.test(l))
                    .join('\n')
                    .trim();
                if (exitCode === 0) {
                    (0, emitter_js_1.emit)({ type: 'done', exitCode: 0, output: clean });
                }
                else {
                    (0, emitter_js_1.emit)({ type: 'failed', error: clean.slice(0, 1000) || `Exit code ${exitCode}`, exitCode, output: clean });
                }
                return;
            }
            const jsonlOutput = await (0, jsonl_js_1.readSessionOutput)(files.sessionId);
            if (jsonlOutput) {
                (0, emitter_js_1.emit)({ type: 'done', exitCode: 0, output: jsonlOutput });
                return;
            }
            if (Date.now() >= deadline) {
                (0, emitter_js_1.emit)({ type: 'failed', error: `Agent timed out after ${timeoutMs / 1000}s`, exitCode: -1 });
                return;
            }
        }
        // Process exited during sleep — fallback
        const { stdout: paneInfo } = await execFileAsync('tmux', [
            'display-message', '-p', '-t', sessionName, '#{pane_dead}:#{pane_dead_status}',
        ]);
        const [dead, statusStr] = paneInfo.trim().split(':');
        const exitCode = dead === '1' ? parseInt(statusStr ?? '0', 10) : -1;
        const jsonlOutput = await (0, jsonl_js_1.readSessionOutput)(files.sessionId);
        const output = jsonlOutput || await capturePane(sessionName);
        if (exitCode === 0) {
            (0, emitter_js_1.emit)({ type: 'done', exitCode: 0, output });
        }
        else {
            (0, emitter_js_1.emit)({ type: 'failed', error: output.slice(0, 1000) || `Exit code ${exitCode}`, exitCode, output });
        }
    }
    catch (err) {
        (0, emitter_js_1.emit)({ type: 'failed', error: err.message, exitCode: -1 });
    }
    finally {
        try {
            await execFileAsync('tmux', ['set-option', '-t', sessionName, 'remain-on-exit', 'on']);
        }
        catch { /* ok */ }
        (0, temp_js_1.cleanupTempFiles)(files);
    }
}
async function capturePane(sessionName) {
    try {
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
    catch {
        return '';
    }
}
