# anagent — Runtime-aware agent runner

## Context

`anagent` currently has the agent concept (roles + system prompts) but hardcodes Claude Code as the only backend in `claude.ts`. The goal is to introduce a proper **runtime** layer so any coding agent (Claude Code, Cursor, future others) can be used interchangeably, and to support two explicit **execution modes**: headless (direct process, capture stdout) and tmux (observable session, wait and capture).

---

## Two orthogonal axes

| Concept | What it is | Examples |
|---|---|---|
| **Agent** | Role + system prompt + output parser | `developer`, `reviewer`, `validator` |
| **Runtime** | Which coding tool executes the task | `claude-code`, `cursor` |
| **Mode** | How the process is launched | `headless`, `tmux` |

Agent defines WHAT. Runtime defines WHO. Mode defines HOW.

---

## New file structure

```
src/
  cli.ts                  # adds --runtime, --mode flags + `anagent runtimes` command
  runner.ts               # orchestrates agent + runtime + executor
  agents/                 # unchanged
  runtimes/
    base.ts               # RuntimeDefinition interface
    registry.ts           # built-ins: claude-code, cursor
  execution/
    headless.ts           # spawn process directly, capture stdout
    tmux.ts               # tmux session, wait for pane_dead, capture output
    temp.ts               # shared temp file helpers
  state/
    storage.ts            # unchanged
    runs.ts               # add runtime + mode fields to RunRecord
```

`src/claude.ts` is deleted — replaced by `execution/headless.ts` + `execution/tmux.ts`.

---

## RuntimeDefinition (`src/runtimes/base.ts`)

```ts
interface RuntimeDefinition {
  id: string
  name: string
  description: string
  defaultMode: 'headless' | 'tmux'
  // Shell snippet injected into the temp script.
  // Vars SYSPROMPT and INPUT are already set when this runs.
  headlessSnippet: string
  tmuxSnippet: string
}
```

Both snippets run inside a temp bash script that pre-loads:
```bash
SYSPROMPT=$(cat /tmp/anagent-sys-<id>.txt)
INPUT=$(cat /tmp/anagent-in-<id>.txt)
<snippet here>
```

This avoids all shell quoting issues — content is in files, snippets only reference `$SYSPROMPT` and `$INPUT`.

---

## Built-in runtimes (`src/runtimes/registry.ts`)

**`claude-code`** (default):
```bash
# headless snippet
claude --dangerously-skip-permissions --system-prompt "$SYSPROMPT" -p "$INPUT"
# tmux snippet (no -p — interactive)
claude --dangerously-skip-permissions --system-prompt "$SYSPROMPT" "$INPUT"
```
defaultMode: `headless`

**`cursor`**:
```bash
# headless snippet (system prompt prepended to input)
FULL="$SYSPROMPT

$INPUT"
agent -p --force "$FULL"
# tmux snippet
FULL="$SYSPROMPT

$INPUT"
agent --force "$FULL"
```
defaultMode: `headless`

---

## Executors

### `HeadlessExecutor` (`src/execution/headless.ts`)
1. Write sysprompt + input to temp files
2. Build and write temp script with runtime's `headlessSnippet`
3. `spawnSync(scriptPath, { stdio: ['ignore', 'pipe', 'pipe'] })`
4. Throw if non-zero exit
5. Return `stdout.trim()`
6. Clean up temp files in finally

### `TmuxExecutor` (`src/execution/tmux.ts`)
1. Write sysprompt + input to temp files
2. Build and write temp script with runtime's `tmuxSnippet`
3. `tmux new-session -d -s <name> -x 220 -y 50 [-c cwd] <script>`
4. `set-option remain-on-exit on`
5. Poll `#{pane_dead}` every 500ms (120 iterations = 60s timeout)
6. `capture-pane -p -S -500`
7. Strip "Pane is dead…" lines, trim
8. Kill session + clean up files in finally
9. Return output

Shared temp file logic lives in `src/execution/temp.ts`.

---

## Runner (`src/runner.ts`)

```ts
export async function runAgent(
  agentName: string,
  input: string,
  opts: { runtime?: string; mode?: 'headless' | 'tmux'; cwd?: string }
): Promise<AgentResult>
```

Steps:
1. Resolve agent (throw if unknown)
2. Resolve runtime (default: `claude-code`)
3. Determine mode: `opts.mode ?? runtime.defaultMode`
4. Build system prompt: default + optional `.anagent/prompts/<name>.md` override
5. Execute via HeadlessExecutor or TmuxExecutor
6. `agent.parseOutput(raw)` → AgentResult
7. `saveRun(...)` — includes `runtime` + `mode`
8. Return result

---

## CLI (`src/cli.ts`)

**`run` command** — new flags:
```bash
anagent run <agent> [input]
  --stdin              read input from stdin
  --json               output as JSON
  --cwd <dir>          working directory
  --runtime <id>       which runtime to use (default: claude-code)
  --mode <mode>        headless | tmux
```

**New `runtimes` command:**
```bash
anagent runtimes      # list available runtimes with id, name, defaultMode
```

---

## RunRecord update (`src/state/runs.ts`)

Add fields: `runtime: string`, `mode: 'headless' | 'tmux'`

---

## Files to change

| File | Action |
|---|---|
| `src/runtimes/base.ts` | CREATE |
| `src/runtimes/registry.ts` | CREATE |
| `src/execution/temp.ts` | CREATE |
| `src/execution/headless.ts` | CREATE |
| `src/execution/tmux.ts` | CREATE |
| `src/runner.ts` | MODIFY |
| `src/cli.ts` | MODIFY |
| `src/state/runs.ts` | MODIFY |
| `src/claude.ts` | DELETE |

---

## Verification

```bash
npm run build
anagent list
anagent runtimes

echo "what is 2+2" | anagent run developer --stdin --json           # headless default
echo "what is 2+2" | anagent run developer --stdin --mode tmux      # tmux mode
echo "review this" | anagent run reviewer --stdin --runtime cursor  # cursor runtime
anagent runs --json | python3 -m json.tool | head -30               # check runtime+mode in record
```
