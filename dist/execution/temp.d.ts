export interface TempFiles {
    id: string;
    sessionId: string;
    syspromptPath: string;
    inputPath: string;
    scriptPath: string;
}
export declare function createTempFiles(systemPrompt: string, input: string, snippet: string): TempFiles;
export declare function cleanupTempFiles(files: TempFiles): void;
