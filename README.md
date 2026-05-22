# anagent

AI coding tools are increasingly sold as **subscriptions** with an interactive terminal UI. When you want to drive them programmatically — from scripts, pipelines, or other apps — you're often pushed toward a separate API or a special headless mode that is billed differently, behaves differently, and can change or be restricted independently of the subscription you already pay for.

anagent bridges that gap. It runs the **interactive mode** of your coding tool through a real terminal session and exposes the result as a simple programmatic interface. Your subscription session is what executes the work.

The second thing anagent solves is **portability**. The runtime — which tool actually runs the task — is a swappable configuration. If you move from one tool to another, you change one line in anagent. Every app built on top keeps working without modification.

## Concepts

| Term | What it is |
|---|---|
| **Runtime** | The coding tool that executes the task (`claude-code`, `cursor`) |
| **Mode** | How the process is launched: `headless` (captures stdout) or `tmux` (observable session) |

The system prompt and output parsing are the responsibility of the calling application.

## How it works

anagent launches the runtime in **interactive mode** inside a tmux session, which provides a real terminal so tools like Claude Code run normally. After the process finishes, anagent reads the output and returns it.

For `claude-code`, anagent reads from Claude Code's local session JSONL (`~/.claude/projects/**/<session-id>.jsonl`) instead of scraping the terminal. Terminal capture is lossy — cursor redraws and spinner animations can corrupt the text. The JSONL is Claude Code's own lossless record of the session and is used as the source of truth. Terminal capture is kept as a fallback for runtimes that don't produce one.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `ANAGENT_RUNTIME` | `claude-code` | Runtime to use when `--runtime` is not passed |
| `ANAGENT_TIMEOUT_SEC` | `600` | Timeout in seconds (also settable with `--timeout`) |

## Prerequisites

- Node.js 18+
- `tmux` installed
- The CLI for whichever runtime you use (e.g. `claude` for `claude-code`)

## Usage

No installation needed:

```bash
npx github:arthuracrs/anagent run "your task here"
```

Or install globally for repeated use:

```bash
npm install -g github:arthuracrs/anagent
# to update: npm uninstall -g anagent && npm install -g github:arthuracrs/anagent
```

## Quick start

```bash
# Run with an inline system prompt
npx github:arthuracrs/anagent run "fix the null pointer in UserService" --system-prompt "You are a developer agent."

# Load system prompt from a file
npx github:arthuracrs/anagent run "review the payment flow" --prompt-file ./prompts/reviewer.md

# Pipe input via stdin
git diff | npx github:arthuracrs/anagent run --stdin --prompt-file ./prompts/reviewer.md

# See available runtimes
npx github:arthuracrs/anagent runtimes
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
npx github:arthuracrs/anagent run "add input validation to the signup form" --prompt-file ./dev.md

# Tmux mode — launches a visible session you can watch
npx github:arthuracrs/anagent run "refactor the auth module" --prompt-file ./dev.md --mode tmux

# Use Cursor as the runtime
npx github:arthuracrs/anagent run "review the payment flow" --prompt-file ./review.md --runtime cursor

# JSON output for scripting
git diff HEAD~1 | npx github:arthuracrs/anagent run --stdin --prompt-file ./validate.md --json
```

### `anagent runtimes`

List available runtimes with their IDs, names, and default modes.

## Built-in runtimes

| Runtime | Description | Default mode |
|---|---|---|
| `claude-code` | Anthropic Claude Code CLI | headless |
| `cursor` | Cursor AI agent CLI | headless |
