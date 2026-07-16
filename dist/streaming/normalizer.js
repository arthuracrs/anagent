"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PassthroughNormalizer = void 0;
exports.createNormalizer = createNormalizer;
class PassthroughNormalizer {
    buffer = '';
    process(chunk) {
        this.buffer += chunk;
        if (chunk.trim()) {
            return [{ type: 'text', delta: chunk }];
        }
        return [];
    }
    finish(exitCode) {
        const text = this.buffer.trim();
        if (exitCode === 0) {
            return [{ type: 'done', exitCode: 0, output: text }];
        }
        return [{ type: 'failed', error: text.slice(0, 1000) || `Exit code ${exitCode}`, exitCode, output: text }];
    }
}
exports.PassthroughNormalizer = PassthroughNormalizer;
function createNormalizer(id) {
    if (id === 'claude-code') {
        const { ClaudeCodeNormalizer } = require('./claude-code.js');
        return new ClaudeCodeNormalizer();
    }
    return new PassthroughNormalizer();
}
