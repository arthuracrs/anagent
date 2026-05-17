#!/usr/bin/env node
import { Command } from 'commander'
import { runAgent } from './runner.js'
import { listAgents } from './agents/registry.js'
import { resolveAnagentDir, initAnagentDir } from './state/storage.js'
import { loadRuns } from './state/runs.js'

const program = new Command()
  .name('anagent')
  .description('Project-local Claude agent runner')
  .version('0.1.0')

program
  .command('run <agent> [input]')
  .description('Run an agent with the given input')
  .option('--stdin', 'Read input from stdin instead of argument')
  .option('--json', 'Output result as JSON')
  .option('--cwd <dir>', 'Working directory for the agent (default: current directory)')
  .action(async (agentName: string, inputArg: string | undefined, opts: { stdin?: boolean; json?: boolean; cwd?: string }) => {
    try {
      let input: string
      if (opts.stdin) {
        input = await readStdin()
      } else if (inputArg) {
        input = inputArg
      } else {
        console.error('Error: provide input as argument or use --stdin')
        process.exit(2)
      }

      const cwd = opts.cwd ?? process.cwd()
      const result = await runAgent(agentName, input, cwd)

      if (opts.json) {
        console.log(JSON.stringify(result))
      } else {
        const icon = result.verdict === 'APPROVED' ? '✓' : result.verdict === 'REJECTED' ? '✗' : 'ℹ'
        console.log(`${icon} ${result.verdict}: ${result.reason}`)
      }

      process.exit(result.verdict === 'REJECTED' ? 1 : 0)
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(2)
    }
  })

program
  .command('list')
  .description('List available agents')
  .action(() => {
    for (const agent of listAgents()) {
      console.log(`  ${agent.name.padEnd(16)} ${agent.description}`)
    }
  })

program
  .command('runs')
  .description('Show run history')
  .option('--agent <name>', 'Filter by agent name')
  .option('--json', 'Output as JSON')
  .action((opts: { agent?: string; json?: boolean }) => {
    const dir = resolveAnagentDir()
    const runs = loadRuns(dir, opts.agent)
    if (opts.json) {
      console.log(JSON.stringify(runs, null, 2))
      return
    }
    if (runs.length === 0) {
      console.log('No runs yet.')
      return
    }
    for (const r of runs) {
      const icon = r.result.verdict === 'APPROVED' ? '✓' : '✗'
      console.log(`${icon} [${r.timestamp}] ${r.agent}: ${r.result.reason}`)
    }
  })

program
  .command('init')
  .description('Initialize .anagent/ in the current directory')
  .action(() => {
    const dir = resolveAnagentDir(process.cwd())
    initAnagentDir(dir)
    console.log(`Initialized ${dir}`)
    console.log('  .anagent/prompts/   ← drop <agent>.md files here to customize prompts')
    console.log('  .anagent/runs/      ← run history is stored here')
  })

program.parse()

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => { data += chunk })
    process.stdin.on('end', () => resolve(data.trim()))
    process.stdin.on('error', reject)
  })
}
