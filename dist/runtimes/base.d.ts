export type NormalizerId = 'claude-code' | 'cursor' | 'opencode' | 'passthrough';
export interface RuntimeDefinition {
    id: string;
    name: string;
    description: string;
    defaultMode: 'headless' | 'tmux';
    headlessSnippet: string;
    tmuxSnippet: string;
    normalizer: NormalizerId;
    streamArgs: string;
}
