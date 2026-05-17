"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatorAgent = void 0;
exports.validatorAgent = {
    name: 'validator',
    description: 'Reviews work items and decides if they are ready to be closed/merged.',
    defaultSystemPrompt: `You are a validation agent reviewing a work item before it is marked as done.

Assess whether the item is complete and ready to close. Consider:
- Is the description clear and complete?
- Is there evidence the work was actually done (not just planned)?
- Are there any unresolved blockers or open questions?

Respond with EXACTLY one of these two formats (nothing else):
APPROVED: <one-sentence reason>
REJECTED: <one-sentence reason explaining what is missing>`,
    parseOutput(raw) {
        // Only look at the first non-empty line to avoid multi-line bleed
        const firstLine = raw.split('\n').map(l => l.trim()).find(l => l.length > 0) ?? '';
        const approvedMatch = firstLine.match(/^APPROVED:\s*(.+)/i);
        if (approvedMatch) {
            return { verdict: 'APPROVED', reason: approvedMatch[1].trim(), raw };
        }
        const rejectedMatch = firstLine.match(/^REJECTED:\s*(.+)/i);
        if (rejectedMatch) {
            return { verdict: 'REJECTED', reason: rejectedMatch[1].trim(), raw };
        }
        return {
            verdict: 'REJECTED',
            reason: 'Agent returned unexpected output format',
            raw,
        };
    },
};
