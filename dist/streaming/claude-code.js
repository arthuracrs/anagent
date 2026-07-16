"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeNormalizer = void 0;
class ClaudeCodeNormalizer {
    buf = '';
    toolBlocks = new Map();
    toolUseNames = new Map();
    accumulatedOutput = '';
    hasResult = false;
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
                const parsed = this.handleLine(ev);
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
        if (exitCode === 0 && this.hasResult) {
            events.push({
                type: 'done',
                exitCode: 0,
                output: this.accumulatedOutput.trim(),
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
            return this.handleLine(ev);
        }
        catch {
            return [{ type: 'text', delta: remaining + '\n' }];
        }
    }
    handleLine(ev) {
        if (ev.type === 'stream_event') {
            return this.handleStreamEvent(ev.event ?? {});
        }
        if (ev.type === 'user') {
            return this.handleUserMessage(ev.message ?? {});
        }
        if (ev.type === 'result') {
            return this.handleResult(ev);
        }
        return [];
    }
    handleStreamEvent(event) {
        const type = event.type;
        if (type === 'content_block_start') {
            const block = event.content_block;
            if (block?.type === 'tool_use') {
                const id = block.id;
                this.toolUseNames.set(id, block.name);
                this.toolBlocks.set(event.index, {
                    name: block.name,
                    id,
                    inputJson: '',
                });
            }
            return [];
        }
        if (type === 'content_block_delta') {
            const delta = event.delta;
            if (delta?.type === 'text_delta') {
                const text = delta.text;
                this.accumulatedOutput += text;
                return [{ type: 'text', delta: text }];
            }
            if (delta?.type === 'input_json_delta') {
                const block = this.toolBlocks.get(event.index);
                if (block)
                    block.inputJson += delta.partial_json ?? '';
            }
            return [];
        }
        if (type === 'content_block_stop') {
            const block = this.toolBlocks.get(event.index);
            if (block) {
                this.toolBlocks.delete(event.index);
                let input = {};
                try {
                    input = JSON.parse(block.inputJson || '{}');
                }
                catch { /* partial or empty */ }
                return [{
                        type: 'tool_use',
                        id: block.id ?? String(event.index),
                        name: block.name,
                        input,
                    }];
            }
        }
        return [];
    }
    handleUserMessage(message) {
        const content = message.content ?? [];
        const events = [];
        for (const block of content) {
            if (block.type === 'tool_result') {
                const rawContent = block.content;
                const blocks = Array.isArray(rawContent) ? rawContent : [rawContent];
                const text = blocks
                    .filter((c) => typeof c === 'object' && c !== null && c.type === 'text')
                    .map(c => c.text)
                    .join('')
                    .trim();
                if (text) {
                    const toolUseId = block.tool_use_id;
                    events.push({
                        type: 'tool_result',
                        id: toolUseId,
                        name: this.toolUseNames.get(toolUseId) ?? '',
                        text,
                        isError: !!block.is_error,
                    });
                }
            }
        }
        return events;
    }
    handleResult(ev) {
        this.hasResult = true;
        const events = [{ type: 'text', delta: '\n' }];
        const cost = typeof ev.total_cost_usd === 'number' ? ev.total_cost_usd : undefined;
        const msg = cost !== undefined
            ? `\x1b[2m[done · $${cost.toFixed(4)}]\x1b[0m\n`
            : '\x1b[2m[done]\x1b[0m\n';
        events.push({ type: 'text', delta: msg });
        return events;
    }
}
exports.ClaudeCodeNormalizer = ClaudeCodeNormalizer;
