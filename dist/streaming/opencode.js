"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenCodeNormalizer = void 0;
class OpenCodeNormalizer {
    buf = '';
    accumulatedOutput = '';
    lastCost = 0;
    hasEvents = false;
    process(chunk) {
        const events = [];
        this.buf += chunk;
        const lines = this.buf.split('\n');
        this.buf = lines.pop() ?? '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            try {
                const ev = JSON.parse(trimmed);
                const parsed = this.handleEvent(ev);
                events.push(...parsed);
            }
            catch {
                events.push({ type: 'text', delta: trimmed + '\n' });
            }
        }
        return events;
    }
    finish(exitCode) {
        const events = this.flushBuffer();
        if (exitCode === 0 && this.hasEvents) {
            events.push({
                type: 'done',
                exitCode: 0,
                output: this.accumulatedOutput.trim(),
                costUsd: this.lastCost > 0 ? this.lastCost : undefined,
            });
        }
        else {
            events.push({
                type: 'failed',
                error: this.accumulatedOutput.trim().slice(0, 1000) || `Exit code ${exitCode}`,
                exitCode,
                output: this.accumulatedOutput.trim(),
            });
        }
        return events;
    }
    flushBuffer() {
        const remaining = this.buf.trim();
        this.buf = '';
        if (!remaining)
            return [];
        try {
            const ev = JSON.parse(remaining);
            return this.handleEvent(ev);
        }
        catch {
            return [{ type: 'text', delta: remaining + '\n' }];
        }
    }
    handleEvent(ev) {
        const type = ev.type;
        if (type === 'text') {
            return this.handleText(ev);
        }
        if (type === 'tool_use') {
            return this.handleToolUse(ev);
        }
        if (type === 'step_finish') {
            return this.handleStepFinish(ev);
        }
        // step_start and others: ignored
        return [];
    }
    handleText(ev) {
        const part = ev.part;
        if (!part)
            return [];
        const text = part.text;
        if (!text)
            return [];
        this.accumulatedOutput += text;
        this.hasEvents = true;
        return [{ type: 'text', delta: text }];
    }
    handleToolUse(ev) {
        const part = ev.part;
        if (!part)
            return [];
        const tool = part.tool;
        const callID = part.callID || '';
        const state = part.state;
        if (!state)
            return [];
        this.hasEvents = true;
        const input = state.input || {};
        const isError = state.status === 'error';
        const metadata = state.metadata;
        const rawOutput = state.output || metadata?.output || '';
        const output = rawOutput.trim();
        if (!output && !isError)
            return [];
        return [{
                type: 'tool_result',
                id: callID,
                name: tool,
                text: output,
                isError,
            }];
    }
    handleStepFinish(ev) {
        const part = ev.part;
        if (!part)
            return [];
        const cost = part.cost;
        if (typeof cost === 'number')
            this.lastCost = cost;
        return [];
    }
}
exports.OpenCodeNormalizer = OpenCodeNormalizer;
