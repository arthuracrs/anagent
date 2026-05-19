"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFromJsonl = extractFromJsonl;
exports.readSessionOutput = readSessionOutput;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const NON_TERMINAL_STOP_REASONS = new Set(['tool_use', 'pause_turn']);
function findSessionJsonl(sessionId) {
    const projectsDir = path_1.default.join(os_1.default.homedir(), '.claude', 'projects');
    if (!fs_1.default.existsSync(projectsDir))
        return null;
    for (const entry of fs_1.default.readdirSync(projectsDir, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const candidate = path_1.default.join(projectsDir, entry.name, `${sessionId}.jsonl`);
        if (fs_1.default.existsSync(candidate))
            return candidate;
    }
    return null;
}
function extractText(content) {
    if (typeof content === 'string')
        return content;
    if (!Array.isArray(content))
        return '';
    return content
        .filter((b) => typeof b === 'object' && b !== null && b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();
}
function extractFromJsonl(content) {
    let lastText = null;
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        try {
            const event = JSON.parse(trimmed);
            if (event.type !== 'assistant')
                continue;
            const msg = event.message;
            if (!msg)
                continue;
            const stopReason = msg.stop_reason;
            if (!stopReason || NON_TERMINAL_STOP_REASONS.has(stopReason))
                continue;
            const text = extractText(msg.content);
            if (text)
                lastText = text;
        }
        catch { /* skip malformed lines */ }
    }
    return lastText;
}
function readJsonlText(filePath) {
    let lastText = null;
    try {
        return extractFromJsonl(fs_1.default.readFileSync(filePath, 'utf8'));
    }
    catch {
        return null;
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function readSessionOutput(sessionId) {
    for (let i = 0; i < 3; i++) {
        const filePath = findSessionJsonl(sessionId);
        if (filePath) {
            const text = readJsonlText(filePath);
            if (text)
                return text;
        }
        await sleep(200);
    }
    return null;
}
