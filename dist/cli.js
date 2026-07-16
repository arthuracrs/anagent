#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs_1 = __importDefault(require("fs"));
const runner_js_1 = require("./runner.js");
const registry_js_1 = require("./runtimes/registry.js");
const program = new commander_1.Command()
    .name('anagent')
    .description('Project-local AI agent runner')
    .version('0.1.0');
program
    .command('run [input]')
    .description('Run an agent with the given input')
    .option('--stdin', 'Read input from stdin instead of argument')
    .option('--json', 'Output result as JSON')
    .option('--stream', 'Emit NDJSON events on stdout for programmatic consumption')
    .option('--system-prompt <text>', 'System prompt string')
    .option('--prompt-file <path>', 'Read system prompt from file')
    .option('--cwd <dir>', 'Working directory for the agent (default: current directory)')
    .option('--runtime <id>', 'Runtime to use (default: opencode)')
    .option('--mode <mode>', 'Execution mode: headless | tmux')
    .option('--timeout <seconds>', 'Timeout in seconds (default: 600)')
    .option('--resume <sessionId>', 'Resume an existing agent session by its id')
    .option('--session-id <id>', 'Use an explicit session id instead of generating one')
    .option('--mcp-config <path>', 'Path to an MCP server config file the agent should load')
    .action(async (inputArg, opts) => {
    try {
        if (opts.json && opts.stream) {
            console.error('Error: --json and --stream are mutually exclusive');
            process.exit(2);
        }
        let input;
        if (opts.stdin) {
            input = await readStdin();
        }
        else if (inputArg) {
            input = inputArg;
        }
        else {
            console.error('Error: provide input as argument or use --stdin');
            process.exit(2);
        }
        let systemPrompt;
        if (opts.promptFile) {
            systemPrompt = fs_1.default.readFileSync(opts.promptFile, 'utf8').trim();
        }
        else if (opts.systemPrompt) {
            systemPrompt = opts.systemPrompt;
        }
        if (opts.timeout)
            process.env.ANAGENT_TIMEOUT_SEC = opts.timeout;
        const cwd = opts.cwd ?? process.cwd();
        const mode = opts.mode;
        if (opts.stream) {
            await (0, runner_js_1.runAgent)(input, {
                systemPrompt,
                runtime: opts.runtime,
                mode,
                cwd,
                stream: true,
                resume: opts.resume,
                sessionId: opts.sessionId,
                mcpConfigPath: opts.mcpConfig,
            });
        }
        else {
            const output = await (0, runner_js_1.runAgent)(input, {
                systemPrompt,
                runtime: opts.runtime,
                mode,
                cwd,
                resume: opts.resume,
                sessionId: opts.sessionId,
                mcpConfigPath: opts.mcpConfig,
            });
            if (opts.json) {
                console.log(JSON.stringify({ output }));
            }
            else {
                console.log(output);
            }
        }
    }
    catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(2);
    }
});
program
    .command('runtimes')
    .description('List available runtimes')
    .option('--json', 'Output as JSON array')
    .action((opts) => {
    const runtimes = (0, registry_js_1.listRuntimes)();
    if (opts.json) {
        console.log(JSON.stringify(runtimes));
    }
    else {
        for (const rt of runtimes) {
            console.log(`  ${rt.id.padEnd(16)} ${rt.name.padEnd(16)} default: ${rt.defaultMode.padEnd(8)} — ${rt.description}`);
        }
    }
});
program.parse();
function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => { data += chunk; });
        process.stdin.on('end', () => resolve(data.trim()));
        process.stdin.on('error', reject);
    });
}
