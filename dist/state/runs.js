"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveRun = saveRun;
exports.loadRuns = loadRuns;
exports.hashInput = hashInput;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
function saveRun(dir, record) {
    const runsDir = path_1.default.join(dir, 'runs');
    fs_1.default.mkdirSync(runsDir, { recursive: true });
    const ts = record.timestamp.replace(/[:.]/g, '-');
    const file = path_1.default.join(runsDir, `${ts}_${record.runtime}_${record.inputHash.slice(0, 8)}.json`);
    fs_1.default.writeFileSync(file, JSON.stringify(record, null, 2));
}
function loadRuns(dir) {
    const runsDir = path_1.default.join(dir, 'runs');
    if (!fs_1.default.existsSync(runsDir))
        return [];
    return fs_1.default.readdirSync(runsDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .map(f => JSON.parse(fs_1.default.readFileSync(path_1.default.join(runsDir, f), 'utf8')));
}
function hashInput(input) {
    return crypto_1.default.createHash('sha256').update(input).digest('hex');
}
