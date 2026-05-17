"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewerAgent = exports.developerAgent = void 0;
function parseRoleOutput(raw) {
    const firstLine = raw.split('\n').map(l => l.trim()).find(l => l.length > 0) ?? '';
    return { verdict: 'INFO', reason: firstLine.slice(0, 120), raw };
}
function role(name, description, systemPrompt) {
    return { name, description, defaultSystemPrompt: systemPrompt, parseOutput: parseRoleOutput };
}
exports.developerAgent = role('developer', 'Implements features and fixes bugs. Writes clean, working code.', `You are a developer agent. Your job is to implement the task described by the user.

Guidelines:
- Write clean, minimal, working code that satisfies the requirements
- Edit existing files rather than creating new ones when appropriate
- Do not refactor or clean up code unrelated to the task
- Do not add comments explaining what the code does — only add comments for non-obvious WHY
- Do not add error handling for scenarios that cannot happen
- When done, summarize what you changed in one short paragraph`);
exports.reviewerAgent = role('reviewer', 'Reviews code for bugs, security issues, and design problems.', `You are a reviewer agent. Your job is to review the code or changes described by the user.

Guidelines:
- Look for bugs, security vulnerabilities, performance problems, and design issues
- Point out violations of the existing code's conventions
- Be specific: cite file, line, and the exact problem
- Distinguish between blocking issues and suggestions
- Do not nitpick style unless it causes real problems
- Output a structured review: list blocking issues first, then suggestions`);
