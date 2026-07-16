"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTempFiles = createTempFiles;
exports.cleanupTempFiles = cleanupTempFiles;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
function createTempFiles(systemPrompt, input, snippet, opts) {
    const id = crypto_1.default.randomBytes(6).toString('hex');
    // When resuming, the session id IS the resume id (for JSONL lookup).
    // When an explicit sessionId is provided, use it. Otherwise generate one.
    const sessionId = opts?.resume ?? opts?.sessionId ?? crypto_1.default.randomUUID();
    const tmpDir = os_1.default.tmpdir();
    const syspromptPath = path_1.default.join(tmpDir, `anagent-sys-${id}.txt`);
    const inputPath = path_1.default.join(tmpDir, `anagent-in-${id}.txt`);
    const scriptPath = path_1.default.join(tmpDir, `anagent-run-${id}.sh`);
    const resume = opts?.resume ?? '';
    const mcpConfig = opts?.mcpConfigPath ?? '';
    fs_1.default.writeFileSync(syspromptPath, systemPrompt, 'utf8');
    fs_1.default.writeFileSync(inputPath, input, 'utf8');
    fs_1.default.writeFileSync(scriptPath, [
        '#!/bin/bash',
        `SYSPROMPT=$(cat "${syspromptPath}")`,
        `INPUT=$(cat "${inputPath}")`,
        `SESSION_ID="${sessionId}"`,
        `RESUME="${resume}"`,
        `MCP_CONFIG="${mcpConfig}"`,
        snippet,
    ].join('\n'), 'utf8');
    fs_1.default.chmodSync(scriptPath, '755');
    return { id, sessionId, syspromptPath, inputPath, scriptPath };
}
function cleanupTempFiles(files) {
    for (const f of [files.syspromptPath, files.inputPath, files.scriptPath]) {
        try {
            fs_1.default.unlinkSync(f);
        }
        catch { /* ok */ }
    }
}
