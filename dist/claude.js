"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callClaude = callClaude;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function callClaude(systemPrompt, userInput, cwd) {
    const id = crypto_1.default.randomBytes(6).toString('hex');
    const sessionName = `anagent-${id}`;
    const tmpDir = os_1.default.tmpdir();
    const syspromptPath = path_1.default.join(tmpDir, `anagent-sys-${id}.txt`);
    const inputPath = path_1.default.join(tmpDir, `anagent-in-${id}.txt`);
    const scriptPath = path_1.default.join(tmpDir, `anagent-run-${id}.sh`);
    fs_1.default.writeFileSync(syspromptPath, systemPrompt, 'utf8');
    fs_1.default.writeFileSync(inputPath, userInput, 'utf8');
    fs_1.default.writeFileSync(scriptPath, [
        '#!/bin/bash',
        `SYSPROMPT=$(cat "${syspromptPath}")`,
        `INPUT=$(cat "${inputPath}")`,
        `claude --dangerously-skip-permissions --system-prompt "$SYSPROMPT" -p "$INPUT"`,
    ].join('\n'), 'utf8');
    fs_1.default.chmodSync(scriptPath, '755');
    try {
        const tmuxArgs = [
            'new-session', '-d', '-s', sessionName,
            '-x', '220', '-y', '50',
        ];
        if (cwd)
            tmuxArgs.push('-c', cwd);
        tmuxArgs.push(scriptPath);
        await execFileAsync('tmux', tmuxArgs);
        await execFileAsync('tmux', ['set-option', '-t', sessionName, 'remain-on-exit', 'on']);
        // Poll until pane exits
        for (let i = 0; i < 120; i++) {
            await sleep(500);
            const { stdout } = await execFileAsync('tmux', [
                'display-message', '-p', '-t', sessionName, '#{pane_dead}',
            ]);
            if (stdout.trim() === '1')
                break;
            if (i === 119)
                throw new Error('Agent timed out after 60 seconds');
        }
        const { stdout: output } = await execFileAsync('tmux', [
            'capture-pane', '-p', '-t', sessionName, '-S', '-500',
        ]);
        return output
            .split('\n')
            .map(l => l.trimEnd())
            // Strip tmux status lines appended when remain-on-exit fires
            .filter(l => !/^Pane is dead/.test(l))
            .join('\n')
            .trim();
    }
    finally {
        try {
            await execFileAsync('tmux', ['kill-session', '-t', sessionName]);
        }
        catch { /* already dead */ }
        for (const f of [syspromptPath, inputPath, scriptPath]) {
            try {
                fs_1.default.unlinkSync(f);
            }
            catch { /* ok */ }
        }
    }
}
