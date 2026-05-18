export interface RuntimeDefinition {
  id: string
  name: string
  description: string
  defaultMode: 'headless' | 'tmux'
  headlessSnippet: string
  tmuxSnippet: string
}
