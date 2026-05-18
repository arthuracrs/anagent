"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAnagentDir = resolveAnagentDir;
exports.initAnagentDir = initAnagentDir;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DIR_NAME = '.anagent';
function resolveAnagentDir(from = process.cwd()) {
    let current = from;
    while (true) {
        const candidate = path_1.default.join(current, DIR_NAME);
        if (fs_1.default.existsSync(candidate))
            return candidate;
        const parent = path_1.default.dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    return path_1.default.join(from, DIR_NAME);
}
function initAnagentDir(dir) {
    fs_1.default.mkdirSync(path_1.default.join(dir, 'runs'), { recursive: true });
}
