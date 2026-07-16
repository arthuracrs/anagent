# anagent + beads-ui — Streaming integration

## Goal

anagent is the **single abstraction layer** for code agents. beads-ui knows nothing about Claude Code, Cursor, or OpenCode — it spawns `anagent run --stream`, reads NDJSON events, and renders them.

Remove all code-agent-specific logic from beads-ui. Add a streaming machine-readable mode to anagent so beads-ui can show live, structured output for **any** runtime without per-agent parsers.

---

## Architecture: before → after

### Before

```
beads-ui
  ├── server/runtimes.ts        hardcoded BUILTINS: claude-code, claude-tmux, cursor, anagent
  ├── server/executions.ts      StreamJsonParser (claude-specific), TmuxManager, ExecutionManager
  └── src/components/           runtime picker, ExecutionView (stream-json), TmuxSessionView (pane capture)

anagent
  └── src/                      runtimes (claude-code, cursor, opencode), headless (spawnSync), tmux

Problems:
  - Two runtime registries, already drifted (opencode missing from beads-ui, defaultMode mismatch)
  - StreamJsonParser in beads-ui is claude-specific
  - anagent's clean JSONL output is thrown away (beads-ui shows lossy terminal capture)
  - Completion relies on agent calling curl/MCP (fragile, couples agent to beads-ui)
  - No live streaming through anagent (headless uses spawnSync, blocks until done)
```

### After

```
beads-ui
  ├── server/runtimes.ts        DELETE — discovers runtimes from `anagent runtimes --json`
  ├── server/executions.ts      no StreamJsonParser, no BUILTINS — spawns anagent, pipes NDJSON → SSE
  └── src/components/           unified ExecutionView renders NDJSON events (text, tool calls, results)

anagent
  ├── src/streaming/            event schema + per-runtime normalizers (claude-code, opencode, cursor)
  ├── src/execution/headless.ts async spawn, pipes stdout through normalizer, emits NDJSON
  ├── src/execution/tmux.ts     interactive mode (kept for opt-in "watch & intervene" UX)
  └── src/cli.ts                --stream flag, runtimes --json

Contract: NDJSON event stream on stdout (see schema below)
```

---

## NDJSON event schema

The contract between anagent and beads-ui. One JSON object per line on stdout.

```jsonl
{"type":"start","runtime":"opencode","mode":"headless","sessionId":"uuid","tmuxSession":null}
{"type":"text","delta":"Let me look at the files..."}
{"type":"tool_use","id":"toolu_01","name":"Bash","input":{"command":"ls -la"}}
{"type":"tool_result","id":"toolu_01","name":"Bash","text":"total 42...","isError":false}
{"type":"text","delta":"I found the issue in src/auth.ts..."}
{"type":"done","exitCode":0,"durationMs":12450}
{"type":"failed","error":"Agent process exited with code 1","exitCode":1,"durationMs":3000}
```

### Event types

| type | when | fields |
|---|---|---|
| `start` | immediately on launch | `runtime`, `mode`, `sessionId`, `tmuxSession?` (only if mode=tmux) |
| `text` | assistant text output | `delta` (incremental text chunk) |
| `tool_use` | agent calls a tool | `id`, `name`, `input` (parsed object) |
| `tool_result` | tool returns output | `id`, `name`, `text`, `isError` |
| `done` | agent finished successfully | `exitCode`, `durationMs` |
| `failed` | agent failed | `error`, `exitCode`, `durationMs` |

### Design rules

- Events are **runtime-agnostic**. beads-ui renders them identically regardless of which agent produced them.
- `text` events carry **deltas** (not full accumulated text) so beads-ui can append incrementally.
- `tool_use.input` is a parsed JSON object (not a raw string) so the UI can render structured args (e.g. command for Bash, file path for Edit).
- `done`/`failed` are terminal — no events follow. beads-ui closes the SSE stream on receipt.
- For runtimes with no structured output (see normalizer tiers below), `text` events carry raw stdout chunks and no `tool_use`/`tool_result` events are emitted. This is the **passthrough tier** — degraded but functional.

---

## Normalizer tiers

Each runtime has a **normalizer** that converts its native output format into the NDJSON event schema. Three tiers:

| tier | what | runtimes | events emitted |
|---|---|---|---|
| **structured** | native streaming JSON / NDJSON from the agent | claude-code (`--output-format stream-json`) | all event types |
| **semi-structured** | agent outputs JSONL session log (not streamed) | claude-code tmux mode (tail JSONL) | text, tool_use, tool_result (delayed) |
| **passthrough** | raw stdout, no structure | opencode, cursor (until researched) | text (raw chunks), done/failed |

### Runtime → normalizer mapping

| runtime | headless --stream | tmux --stream | tmux (no stream) |
|---|---|---|---|
| claude-code | structured (stream-json parser) | semi-structured (JSONL tail) | pane capture (existing) |
| opencode | passthrough → research `--json` | passthrough | pane capture |
| cursor | passthrough → research `--json` | passthrough | pane capture |

**Research tasks** (block upgrading passthrough → structured):
- Does `opencode run` have a `--json` or streaming-JSON output mode?
- Does `agent` (Cursor) have a `--json` or streaming-JSON output mode?

If yes, add a structured normalizer for that runtime. If no, passthrough is the permanent fallback (still better than terminal scraping — beads-ui gets live text + clean completion).

---

## Phase 1 — anagent streaming engine

### New file structure

```
src/
  cli.ts                        # add --stream flag, `runtimes --json`
  runner.ts                     # route --stream to streaming executors
  runtimes/
    base.ts                     # add: normalizer field
    registry.ts                 # unchanged runtimes, add normalizerId
  streaming/
    events.ts                   # event type definitions
    emitter.ts                  # writes NDJSON lines to stdout
    normalizer.ts               # Normalizer interface + passthrough impl
    claude-code.ts              # structured: parse stream-json → events
    opencode.ts                 # passthrough (upgrade later)
    cursor.ts                   # passthrough (upgrade later)
  execution/
    headless.ts                 # REWRITE: async spawn + stream through normalizer
    headless-sync.ts            # RENAME: existing spawnSync path (for non-stream --json)
    tmux.ts                     # MODIFY: emit start/done events when --stream
    temp.ts                     # unchanged
    jsonl.ts                    # unchanged
```

### RuntimeDefinition update (`src/runtimes/base.ts`)

```ts
export type NormalizerId = 'claude-code' | 'passthrough'

export interface RuntimeDefinition {
  id: string
  name: string
  description: string
  defaultMode: 'headless' | 'tmux'
  headlessSnippet: string
  tmuxSnippet: string
  normalizer: NormalizerId      // NEW — which normalizer to use
  streamArgs?: string           // NEW — args appended to headlessSnippet when --stream
                                //   e.g. '--output-format stream-json --verbose --include-partial-messages' for claude
}
```

Registry changes:
- `claude-code`: `normalizer: 'claude-code'`, `streamArgs: '--output-format stream-json --verbose --include-partial-messages'`
- `opencode`: `normalizer: 'passthrough'`
- `cursor`: `normalizer: 'passthrough'`

### Normalizer interface (`src/streaming/normalizer.ts`)

```ts
import type { AgentEvent } from './events.js'

export interface Normalizer {
  /** Feed a raw stdout chunk. Returns zero or more normalized events. */
  process(chunk: string): AgentEvent[]
  /** Called on process exit. Returns terminal event (done/failed). */
  finish(exitCode: number): AgentEvent[]
}
```

### Claude Code normalizer (`src/streaming/claude-code.ts`)

Port the `StreamJsonParser` logic from beads-ui `server/executions.ts:36-125` into anagent. It already parses `stream-json` into text deltas, tool_use blocks, and tool_results. Adapt it to emit `AgentEvent` objects instead of ANSI-formatted strings.

Key mapping:
| beads-ui StreamJsonParser | anagent event |
|---|---|
| `text_delta` → `onText(text)` | `{type:"text", delta:text}` |
| `content_block_stop` (tool_use) → `▶ name input` | `{type:"tool_use", id, name, input}` |
| `user` message `tool_result` content | `{type:"tool_result", id, name, text, isError}` |
| `result` event (cost) | `{type:"done", exitCode:0}` (append cost to a metadata field) |

### Headless streaming executor (`src/execution/headless.ts`)

Rewrite from `spawnSync` to async `spawn`:

```
1. Create temp files (sysprompt, input, script)
2. If --stream: append runtime.streamArgs to the script snippet
3. spawn(scriptPath, { stdio: ['ignore', 'pipe', 'pipe'] })
4. Instantiate normalizer based on runtime.normalizer
5. Emit {type:"start", runtime, mode:"headless", sessionId}
6. On stdout data: normalizer.process(chunk) → emit each event as NDJSON line
7. On close: normalizer.finish(exitCode) → emit terminal event
8. Cleanup temp files
```

Non-streaming path (`--json` without `--stream`) keeps the existing `spawnSync` behavior — rename to `headless-sync.ts`.

### Tmux streaming executor (`src/execution/tmux.ts`)

When `--stream` is passed with `--mode tmux`:

```
1. Create temp files, start tmux session (existing logic)
2. Emit {type:"start", runtime, mode:"tmux", sessionId, tmuxSession:"anagent-<id>"}
3. For claude-code: tail the JSONL file, parse assistant messages, emit text/tool events
4. Poll pane_dead (existing logic) — on dead, emit done/failed
5. Kill session, cleanup
```

For passthrough runtimes in tmux mode: emit `start`, then poll pane_dead and emit `done`/`failed`. No intermediate text events (the user watches the pane via beads-ui's xterm view). This is acceptable — tmux mode is for interactive watching.

### CLI (`src/cli.ts`)

New flags:

```
anagent run [input]
  --stream              Emit NDJSON events on stdout (see event schema)
  --mode <mode>         headless | tmux
  --runtime <id>        Runtime to use
  ...existing flags...
```

New command:

```
anagent runtimes --json    # machine-readable: [{ id, name, description, defaultMode, normalizer }]
```

`--stream` and `--json` are mutually exclusive:
- `--json`: blocking, returns `{output: "..."}` on completion (existing behavior, for scripting)
- `--stream`: emits NDJSON events live, terminal event on completion (for beads-ui)

### Runner (`src/runner.ts`)

```ts
export async function runAgent(
  input: string,
  opts: {
    systemPrompt?: string
    runtime?: string
    mode?: 'headless' | 'tmux'
    cwd?: string
    stream?: boolean              // NEW
  }
): Promise<string | void>         // string if !stream, void if stream (events go to stdout)
```

- `opts.stream === true` → call streaming executor (headless or tmux), events written to stdout via emitter
- `opts.stream === false` → existing blocking path (headless-sync or tmux), return string

---

## Phase 2 — beads-ui consumes anagent stream

### Runtime discovery (`server/runtimes.ts`)

Delete `BUILTINS` array. Replace `RuntimeRegistry` with a class that shells out to `anagent runtimes --json`:

```ts
export class RuntimeRegistry {
  private cache: AgentRuntime[] | null = null

  async list(): Promise<AgentRuntime[]> {
    if (this.cache) return this.cache
    const anagent = this.resolveAnagentBin()   // $PATH first, npx fallback
    const { stdout } = await execFileAsync(anagent, ['runtimes', '--json'])
    this.cache = JSON.parse(stdout).map(this.fromAnagent)
    return this.cache
  }

  private resolveAnagentBin(): string {
    // check $PATH for 'anagent', fall back to 'npx --yes github:arthuracrs/anagent'
  }
}
```

The `AgentRuntime` type in beads-ui becomes a thin projection of anagent's runtime definition. `commandTemplate` is removed — beads-ui no longer builds the command. `kind` (process/tmux) is replaced by `defaultMode` (headless/tmux) from anagent.

### Execution start (`server/index.ts`)

The `POST /api/executions` handler changes from "build a shell command from a template" to "spawn anagent with args":

```ts
// Before: interpolate commandTemplate, spawn sh -c <command>
// After:
const args = [
  'run', finalPrompt,
  '--stream',
  '--runtime', runtimeId,
  '--mode', mode,                           // from request body (headless | tmux)
  '--system-prompt', issueContext,           // bd show output as system prompt
  '--cwd', bd.projectDir,
]
const proc = spawn(anagentBin, args, { cwd: bd.projectDir, stdio: ['ignore','pipe','pipe'] })
```

Issue context (`bd show <id>` output) is passed via `--system-prompt`. The user's task prompt is the positional `input` argument. This respects anagent's prompt architecture (system prompt vs. user input).

### NDJSON → SSE proxy (`server/executions.ts`)

Delete `StreamJsonParser` (moved to anagent). The `ExecutionManager.start()` method now:

```
1. spawn anagent run --stream ...
2. Read stdout line-by-line (each line is an NDJSON event)
3. For each line: parse JSON, forward to SSE listeners as { type: event.type, data: event }
4. On `done`/`failed` event: set exec status, close SSE stream
5. On process close: if no terminal event was emitted, emit failed
```

No runtime-specific logic. beads-ui doesn't know or care what agent is running.

### What gets deleted from beads-ui

| file | what to delete |
|---|---|
| `server/runtimes.ts` | `BUILTINS` array, `commandTemplate` field, `kind` field — replaced by anagent discovery |
| `server/executions.ts` | `StreamJsonParser` class (lines 36-125) — moved to anagent |
| `server/executions.ts` | `TmuxManager` — only needed if beads-ui still does pane capture for tmux mode (see below) |
| `server/index.ts` | `BdClient.shQuote`, `BdClient.interpolate` for runtime templates — no longer building shell commands |

### TmuxManager — keep or delete?

**Keep**, but reduced. For `--mode tmux` (interactive watch), beads-ui still needs to:
1. Get the tmux session name (from anagent's `start` event: `tmuxSession` field)
2. Capture the pane for the xterm.js view (existing `/api/executions/:id/pane` SSE endpoint)

anagent owns the tmux session lifecycle (start, detect completion, kill). beads-ui only reads the pane for display. `TmuxManager.start()` is deleted; `capture()`, `hasSession()`, `paneDead()` are kept.

For `--mode headless` (the default streaming path), `TmuxManager` is not used at all — anagent pipes NDJSON to stdout, beads-ui pipes it to SSE. No tmux involved.

---

## Phase 3 — UX changes in beads-ui

### Unified ExecutionView

Replace the split `ExecutionView` (stream-json text) + `TmuxSessionView` (xterm pane capture) with a single component that adapts based on mode:

- **headless mode**: render NDJSON events as a structured activity feed
  - `text` → append to output stream (monospace, like current ExecutionView)
  - `tool_use` → render as "▶ ToolName `args`" line (like current StreamJsonParser output)
  - `tool_result` → render as dimmed output block
  - `done`/`failed` → status badge update
- **tmux mode**: render xterm.js pane capture (existing TmuxSessionView logic) + show "Attach cmd" button

The component picks the view based on the `mode` field from the `start` event.

### Runtime picker redesign (`RunAgentModal.tsx`)

Before: list of runtime buttons (Claude Code, Claude tmux, Cursor, anagent) — confusing because anagent is a meta-runtime alongside its own children.

After:
- **Runtime dropdown**: Claude Code / Cursor / OpenCode (sourced from `anagent runtimes --json`)
- **Mode toggle**: Headless (default) / Interactive (tmux) — two radio buttons
- No "anagent" entry in the list — it's the engine, not a user-facing choice
- Remove `commandTemplate` display (leaky implementation detail)

### Remove completion hacks from DEFAULT_PROMPT

Delete from `RunAgentModal.tsx:20`:
```
3. Run: curl -s -X POST $BEADS_API_URL/tmux/sessions/$BEADS_EXEC_ID/complete
```

Completion is now detected by anagent (process exit / JSONL stop_reason) and signaled via the `done` event. The agent no longer needs to know about beads-ui's API.

The `end_session` MCP tool instruction (appended in `server/index.ts:391`) is also removed — anagent detects completion natively.

### Decouple "do work" from "close issue"

Current `DEFAULT_PROMPT` tells the agent to `bd close` itself. Change to:

```
When done:
1. Run: bd comment {id} --actor agent "<brief summary of what was done>"
2. Leave the issue open for review.
```

beads-ui shows a **review step** when an execution completes:
- "Agent finished — [Review diff] [Close issue] [Re-run] [Comment]"
- User closes the issue after reviewing, not the agent.
- If the agent determines the task is impossible, it comments and leaves the issue open with a blocked status.

### Per-issue runtime preference

Store last-used `runtimeId` + `mode` per issue in `localStorage`. The quick-run button (`AgentsPanel.tsx:163`) uses the stored preference instead of always defaulting to `"anagent"`.

### Show clean final output

When anagent emits `done`, include the extracted final text (from JSONL for claude-code, from stdout for passthrough) in the event:

```jsonl
{"type":"done","exitCode":0,"durationMs":12450,"output":"I fixed the null pointer in UserService by..."}
```

beads-ui shows this as the primary "result" view, with the full event log as a collapsible "details" section.

---

## File-by-file changes

### anagent

| File | Action | What |
|---|---|---|
| `src/streaming/events.ts` | CREATE | `AgentEvent` union type |
| `src/streaming/emitter.ts` | CREATE | `emit(event: AgentEvent)` → `console.log(JSON.stringify(event))` |
| `src/streaming/normalizer.ts` | CREATE | `Normalizer` interface + `PassthroughNormalizer` |
| `src/streaming/claude-code.ts` | CREATE | `ClaudeCodeNormalizer` (ported from beads-ui StreamJsonParser) |
| `src/execution/headless.ts` | REWRITE | async spawn + normalizer + NDJSON emit (streaming path) |
| `src/execution/headless-sync.ts` | RENAME from headless.ts | existing spawnSync path (non-streaming) |
| `src/execution/tmux.ts` | MODIFY | emit start/done events when --stream; JSONL tail for claude-code |
| `src/runtimes/base.ts` | MODIFY | add `normalizer` + `streamArgs` fields |
| `src/runtimes/registry.ts` | MODIFY | add normalizer/streamArgs to each runtime |
| `src/runner.ts` | MODIFY | add `stream` option, route to streaming executor |
| `src/cli.ts` | MODIFY | add `--stream` flag, `runtimes --json` command |
| `tests/streaming.test.ts` | CREATE | unit tests for normalizers (feed sample stream-json, assert events) |

### beads-ui

| File | Action | What |
|---|---|---|
| `server/runtimes.ts` | REWRITE | discover from `anagent runtimes --json` instead of BUILTINS |
| `server/executions.ts` | MODIFY | delete StreamJsonParser, simplify ExecutionManager to NDJSON→SSE proxy |
| `server/executions.ts` | MODIFY | reduce TmuxManager (delete start, keep capture/hasSession/paneDead) |
| `server/index.ts` | MODIFY | POST /api/executions spawns `anagent run --stream` instead of building shell command |
| `server/index.ts` | MODIFY | pass issue context via `--system-prompt`, task as positional input |
| `server/index.ts` | DELETE | `BdClient.shQuote`, `BdClient.interpolate` (no longer needed) |
| `src/types/index.ts` | MODIFY | `AgentRuntime` — drop `commandTemplate`/`kind`, add `defaultMode`/`normalizer` |
| `src/components/RunAgentModal.tsx` | MODIFY | runtime dropdown + mode toggle, remove commandTemplate display |
| `src/components/RunAgentModal.tsx` | MODIFY | remove curl/MCP completion hack from DEFAULT_PROMPT |
| `src/components/RunAgentModal.tsx` | MODIFY | decouple "do work" from "close issue" in prompt |
| `src/components/ExecutionView.tsx` | MODIFY | render NDJSON events (text, tool_use, tool_result, done) |
| `src/components/TmuxSessionView.tsx` | MODIFY | get tmuxSession from start event instead of exec record |
| `src/components/AgentsPanel.tsx` | MODIFY | per-issue runtime preference in localStorage |
| `tests/anagent.integration.test.js` | MODIFY | test `anagent run --stream` + `anagent runtimes --json` |

---

## Implementation order

### Step 1 — anagent: event schema + emitter + passthrough normalizer
Create `src/streaming/events.ts`, `emitter.ts`, `normalizer.ts`. Wire up `--stream` flag in CLI. Passthrough normalizer emits `start`, raw `text` chunks, `done`/`failed`. Verify: `echo "what is 2+2" | anagent run --stdin --stream` emits valid NDJSON.

### Step 2 — anagent: claude-code structured normalizer
Port `StreamJsonParser` from beads-ui into `src/streaming/claude-code.ts`. Add `streamArgs` to claude-code runtime. Verify: `anagent run "list files" --stream --runtime claude-code` emits text/tool_use/tool_result/done events.

### Step 3 — anagent: `runtimes --json`
Add JSON output to runtimes command. Verify: `anagent runtimes --json | jq .` returns valid array.

### Step 4 — anagent: tmux streaming
Modify `tmux.ts` to emit `start`/`done` events. Add JSONL tail for claude-code. Verify: `anagent run "test" --stream --mode tmux` emits start + done.

### Step 5 — beads-ui: runtime discovery
Rewrite `server/runtimes.ts` to call `anagent runtimes --json`. Detect anagent on $PATH. Update `AgentRuntime` type. Verify: `GET /api/runtimes` returns anagent's runtimes.

### Step 6 — beads-ui: spawn anagent + NDJSON→SSE
Rewrite `POST /api/executions` to spawn `anagent run --stream`. Delete `StreamJsonParser`. Pipe NDJSON → SSE. Verify: run an agent from the UI, see live output.

### Step 7 — beads-ui: UX cleanup
Runtime dropdown + mode toggle. Remove completion hacks. Decouple work from close. Per-issue preference. Unified ExecutionView.

### Step 8 — research + upgrade normalizers
Research opencode/cursor JSON output modes. Upgrade from passthrough → structured if available.

---

## Verification

```bash
# anagent
npm run build
anagent runtimes --json | jq '.[0]'
echo "what is 2+2" | anagent run --stdin --stream                    # passthrough NDJSON
anagent run "list files in src" --stream --runtime claude-code       # structured NDJSON
anagent run "list files" --stream --mode tmux                        # tmux NDJSON

# beads-ui
npm run dev
# open browser → run agent on an issue → verify live streaming output
# verify no claude-specific code remains in server/
grep -r "stream-json\|claude --\|StreamJsonParser" server/           # should return nothing
grep -r "commandTemplate" server/                                     # should return nothing

# integration
npm run test:anagent                                                  # updated tests
```
