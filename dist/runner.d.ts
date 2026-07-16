export declare function runAgent(input: string, opts?: {
    systemPrompt?: string;
    runtime?: string;
    mode?: 'headless' | 'tmux';
    cwd?: string;
    stream?: boolean;
    resume?: string;
    sessionId?: string;
    mcpConfigPath?: string;
}): Promise<string | void>;
