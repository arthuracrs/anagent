"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRuntime = getRuntime;
exports.listRuntimes = listRuntimes;
const claudeCode = {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Anthropic Claude Code CLI',
    defaultMode: 'tmux',
    headlessSnippet: 'claude --dangerously-skip-permissions --system-prompt "$SYSPROMPT" -p "$INPUT" $([ -n "$RESUME" ] && echo "--resume $RESUME") $([ -n "$MCP_CONFIG" ] && echo "--mcp-config $MCP_CONFIG")',
    tmuxSnippet: 'claude --dangerously-skip-permissions --system-prompt "$SYSPROMPT" $([ -z "$RESUME" ] && echo "--session-id $SESSION_ID") "$INPUT" $([ -n "$RESUME" ] && echo "--resume $RESUME") $([ -n "$MCP_CONFIG" ] && echo "--mcp-config $MCP_CONFIG")',
    normalizer: 'claude-code',
    streamArgs: '--output-format stream-json --verbose --include-partial-messages',
};
const cursor = {
    id: 'cursor',
    name: 'Cursor',
    description: 'Cursor AI agent CLI',
    defaultMode: 'headless',
    headlessSnippet: 'FULL="$SYSPROMPT\n\n$INPUT"\nagent -p --force "$FULL"',
    tmuxSnippet: 'FULL="$SYSPROMPT\n\n$INPUT"\nagent --force "$FULL"',
    normalizer: 'cursor',
    streamArgs: '--output-format stream-json --stream-partial-output',
};
const opencode = {
    id: 'opencode',
    name: 'OpenCode',
    description: 'OpenCode AI coding agent CLI',
    defaultMode: 'headless',
    headlessSnippet: 'FULL="$SYSPROMPT\n\n$INPUT"\nopencode run --auto "$FULL" $([ -n "$RESUME" ] && echo "--session $RESUME")',
    tmuxSnippet: 'FULL="$SYSPROMPT\n\n$INPUT"\nopencode run --auto "$FULL" $([ -n "$RESUME" ] && echo "--session $RESUME")',
    normalizer: 'opencode',
    streamArgs: '--format json',
};
const RUNTIMES = [claudeCode, cursor, opencode];
function getRuntime(id) {
    return RUNTIMES.find(r => r.id === id);
}
function listRuntimes() {
    return RUNTIMES;
}
