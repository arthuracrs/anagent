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
const storage_js_1 = require("./state/storage.js");
const runs_js_1 = require("./state/runs.js");
const program = new commander_1.Command()
    .name('anagent')
    .description('Project-local AI agent runner')
    .version('0.1.0');
program
    .command('run [input]')
    .description('Run an agent with the given input')
    .option('--stdin', 'Read input from stdin instead of argument')
    .option('--json', 'Output result as JSON')
    .option('--system-prompt <text>', 'System prompt string')
    .option('--prompt-file <path>', 'Read system prompt from file')
    .option('--cwd <dir>', 'Working directory for the agent (default: current directory)')
    .option('--runtime <id>', 'Runtime to use (default: claude-code)')
    .option('--mode <mode>', 'Execution mode: headless | tmux')
    .option('--timeout <seconds>', 'Timeout in seconds (default: 600)')
    .action(async (inputArg, opts) => {
    try {
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
        const output = await (0, runner_js_1.runAgent)(input, { systemPrompt, runtime: opts.runtime, mode, cwd });
        if (opts.json) {
            console.log(JSON.stringify({ output }));
        }
        else {
            console.log(output);
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
    .action(() => {
    for (const rt of (0, registry_js_1.listRuntimes)()) {
        console.log(`  ${rt.id.padEnd(16)} ${rt.name.padEnd(16)} default: ${rt.defaultMode}  — ${rt.description}`);
    }
});
program
    .command('runs')
    .description('Show run history')
    .option('--json', 'Output as JSON')
    .action((opts) => {
    const dir = (0, storage_js_1.resolveAnagentDir)();
    const runs = (0, runs_js_1.loadRuns)(dir);
    if (opts.json) {
        console.log(JSON.stringify(runs, null, 2));
        return;
    }
    if (runs.length === 0) {
        console.log('No runs yet.');
        return;
    }
    for (const r of runs) {
        console.log(`[${r.timestamp}] ${r.runtime}/${r.mode}: ${r.input.slice(0, 60)}`);
    }
});
program
    .command('init')
    .description('Initialize .anagent/ in the current directory')
    .action(() => {
    const dir = (0, storage_js_1.resolveAnagentDir)(process.cwd());
    (0, storage_js_1.initAnagentDir)(dir);
    console.log(`Initialized ${dir}`);
    console.log('  .anagent/runs/   ← run history is stored here');
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
