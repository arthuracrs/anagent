"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emit = emit;
function emit(event) {
    process.stdout.write(JSON.stringify(event) + '\n');
}
