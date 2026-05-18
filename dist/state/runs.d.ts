export interface RunRecord {
    timestamp: string;
    runtime: string;
    mode: 'headless' | 'tmux';
    inputHash: string;
    input: string;
    raw: string;
}
export declare function saveRun(dir: string, record: RunRecord): void;
export declare function loadRuns(dir: string): RunRecord[];
export declare function hashInput(input: string): string;
