import type { RuntimeDefinition } from './base.js'

const claudeCode: RuntimeDefinition = {
  id: 'claude-code',
  name: 'Claude Code',
  description: 'Anthropic Claude Code CLI',
  defaultMode: 'tmux',
  headlessSnippet: 'claude --dangerously-skip-permissions --system-prompt "$SYSPROMPT" -p "$INPUT"',
  tmuxSnippet: 'claude --dangerously-skip-permissions --system-prompt "$SYSPROMPT" --session-id "$SESSION_ID" "$INPUT"',
  normalizer: 'claude-code',
  streamArgs: '--output-format stream-json --verbose --include-partial-messages',
}

const cursor: RuntimeDefinition = {
  id: 'cursor',
  name: 'Cursor',
  description: 'Cursor AI agent CLI',
  defaultMode: 'headless',
  headlessSnippet: 'FULL="$SYSPROMPT\n\n$INPUT"\nagent -p --force "$FULL"',
  tmuxSnippet: 'FULL="$SYSPROMPT\n\n$INPUT"\nagent --force "$FULL"',
  normalizer: 'passthrough',
  streamArgs: '',
}

const opencode: RuntimeDefinition = {
  id: 'opencode',
  name: 'OpenCode',
  description: 'OpenCode AI coding agent CLI',
  defaultMode: 'headless',
  headlessSnippet: 'FULL="$SYSPROMPT\n\n$INPUT"\nopencode run --auto "$FULL"',
  tmuxSnippet: 'FULL="$SYSPROMPT\n\n$INPUT"\nopencode run --auto "$FULL"',
  normalizer: 'passthrough',
  streamArgs: '',
}

const RUNTIMES: RuntimeDefinition[] = [claudeCode, cursor, opencode]

export function getRuntime(id: string): RuntimeDefinition | undefined {
  return RUNTIMES.find(r => r.id === id)
}

export function listRuntimes(): RuntimeDefinition[] {
  return RUNTIMES
}
