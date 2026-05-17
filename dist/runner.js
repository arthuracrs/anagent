"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = runAgent;
const registry_js_1 = require("./agents/registry.js");
const storage_js_1 = require("./state/storage.js");
const runs_js_1 = require("./state/runs.js");
const claude_js_1 = require("./claude.js");
async function runAgent(agentName, input, cwd) {
    const agent = (0, registry_js_1.getAgent)(agentName);
    if (!agent)
        throw new Error(`Unknown agent: "${agentName}". Run 'anagent list' to see available agents.`);
    const anagentDir = (0, storage_js_1.resolveAnagentDir)();
    (0, storage_js_1.initAnagentDir)(anagentDir);
    const override = (0, storage_js_1.readPromptOverride)(anagentDir, agentName);
    const systemPrompt = override
        ? `${agent.defaultSystemPrompt}\n\n## Project-specific criteria\n\n${override}`
        : agent.defaultSystemPrompt;
    const raw = await (0, claude_js_1.callClaude)(systemPrompt, input, cwd);
    const result = agent.parseOutput(raw);
    (0, runs_js_1.saveRun)(anagentDir, {
        timestamp: new Date().toISOString(),
        agent: agentName,
        inputHash: (0, runs_js_1.hashInput)(input),
        input,
        raw,
        result,
    });
    return result;
}
