export declare function runAgent(input: string, opts?: {
    systemPrompt?: string;
    runtime?: string;
    mode?: 'headless' | 'tmux';
    cwd?: string;
    stream?: boolean;
}): Promise<string | void>;
