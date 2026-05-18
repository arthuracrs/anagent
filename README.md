# anagent

A project-local CLI for running AI coding agents against your codebase. Give it a task and a system prompt, and it dispatches the work to Claude Code (or Cursor) — headlessly or in a visible tmux session.

## Concepts

| Term | What it is |
|---|---|
| **Runtime** | The coding tool that executes the task (`claude-code`, `cursor`) |
| **Mode** | How the process is launched: `headless` (captures stdout) or `tmux` (observable session) |

The system prompt and output parsing are the responsibility of the calling application.

## How it works

Each runtime runs in **interactive mode** through a tmux session (which provides a real terminal, satisfying tools like Claude Code that refuse to run without one). After the process finishes, anagent reads the output and returns it.

For `claude-code` specifically, anagent reads from Claude Code's local session JSONL file (`~/.claude/projects/**/<session-id>.jsonl`) instead of scraping the terminal. This matters because terminal capture is lossy — cursor redraws and spinner animations can corrupt the captured text. The JSONL file is Claude Code's own lossless record of the conversation. Terminal capture is kept as a fallback for runtimes that don't produce a JSONL file.

This design means:
- You use your existing Claude Code subscription session, not the API
- If Anthropic changes or restricts `claude -p` (the headless/API path), anagent is unaffected because it uses the interactive mode
- Swapping to a different tool (Codex, Cursor, etc.) only requires changing the runtime in anagent — the apps calling anagent stay the same

## Prerequisites

- Node.js 18+
- `claude` CLI in PATH (for the `claude-code` runtime) — [install Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- `tmux` installed if you use `--mode tmux`

## Installation

```bash
npx github:arthuracrs/anagent <command>
```

Or install globally:

```bash
npm install -g github:arthuracrs/anagent
```

## Quick start

```bash
# Run with an inline system prompt
anagent run "fix the null pointer in UserService" --system-prompt "You are a developer agent."

# Load system prompt from a file
anagent run "review the payment flow" --prompt-file ./prompts/reviewer.md

# Pipe input via stdin
git diff | anagent run --stdin --prompt-file ./prompts/reviewer.md

# See available runtimes
anagent runtimes
```

## Commands

### `anagent run [input]`

Run an agent on a task.

```
Options:
  --stdin                 Read input from stdin instead of argument
  --json                  Output result as JSON: { "output": "..." }
  --system-prompt <text>  System prompt string
  --prompt-file <path>    Read system prompt from file
  --cwd <dir>             Working directory for the agent (default: current directory)
  --runtime <id>          Runtime to use (default: claude-code)
  --mode <mode>           headless | tmux
```

```bash
# Headless (default) — captures output, returns when done
anagent run "add input validation to the signup form" --prompt-file ./dev.md

# Tmux mode — launches a visible session you can watch
anagent run "refactor the auth module" --prompt-file ./dev.md --mode tmux

# Use Cursor as the runtime
anagent run "review the payment flow" --prompt-file ./review.md --runtime cursor

# JSON output for scripting
git diff HEAD~1 | anagent run --stdin --prompt-file ./validate.md --json
```

### `anagent runtimes`

List available runtimes with their IDs, names, and default modes.

### `anagent runs`

Show the run history for this project.

```
Options:
  --json   Output as JSON
```

### `anagent init`

Initialize a `.anagent/` directory in the current project. Run this once per repo.

```
.anagent/
  runs/   ← run history (JSON)
```

## Built-in runtimes

| Runtime | Description | Default mode |
|---|---|---|
| `claude-code` | Anthropic Claude Code CLI | headless |
| `cursor` | Cursor AI agent CLI | headless |
