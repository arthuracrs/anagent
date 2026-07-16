export interface TempFiles {
    id: string;
    sessionId: string;
    syspromptPath: string;
    inputPath: string;
    scriptPath: string;
}
export interface ExecOpts {
    resume?: string;
    sessionId?: string;
    mcpConfigPath?: string;
}
export declare function createTempFiles(systemPrompt: string, input: string, snippet: string, opts?: ExecOpts): TempFiles;
export declare function cleanupTempFiles(files: TempFiles): void;
