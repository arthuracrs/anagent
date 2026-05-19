"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRuntime = getRuntime;
exports.listRuntimes = listRuntimes;
const claudeCode = {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Anthropic Claude Code CLI',
    defaultMode: 'tmux',
    headlessSnippet: 'claude --dangerously-skip-permissions --system-prompt "$SYSPROMPT" -p "$INPUT"',
    tmuxSnippet: 'claude --dangerously-skip-permissions --system-prompt "$SYSPROMPT" --session-id "$SESSION_ID" "$INPUT"',
};
const cursor = {
    id: 'cursor',
    name: 'Cursor',
    description: 'Cursor AI agent CLI',
    defaultMode: 'headless',
    headlessSnippet: 'FULL="$SYSPROMPT\n\n$INPUT"\nagent -p --force "$FULL"',
    tmuxSnippet: 'FULL="$SYSPROMPT\n\n$INPUT"\nagent --force "$FULL"',
};
const RUNTIMES = [claudeCode, cursor];
function getRuntime(id) {
    return RUNTIMES.find(r => r.id === id);
}
function listRuntimes() {
    return RUNTIMES;
}
