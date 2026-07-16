import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getRuntime, listRuntimes } from '../src/runtimes/registry'

test('getRuntime returns claude-code', () => {
  const rt = getRuntime('claude-code')
  assert.ok(rt)
  assert.equal(rt.id, 'claude-code')
  assert.equal(rt.defaultMode, 'tmux')
})

test('getRuntime returns cursor', () => {
  const rt = getRuntime('cursor')
  assert.ok(rt)
  assert.equal(rt.id, 'cursor')
})

test('getRuntime returns undefined for unknown id', () => {
  assert.equal(getRuntime('does-not-exist'), undefined)
})

test('listRuntimes returns all runtimes', () => {
  const runtimes = listRuntimes()
  assert.ok(runtimes.length >= 2)
  const ids = runtimes.map(r => r.id)
  assert.ok(ids.includes('claude-code'))
  assert.ok(ids.includes('cursor'))
})

test('each runtime has required fields', () => {
  for (const rt of listRuntimes()) {
    assert.ok(rt.id, `${rt.id} missing id`)
    assert.ok(rt.name, `${rt.id} missing name`)
    assert.ok(rt.tmuxSnippet, `${rt.id} missing tmuxSnippet`)
    assert.ok(rt.headlessSnippet, `${rt.id} missing headlessSnippet`)
    assert.ok(['headless', 'tmux'].includes(rt.defaultMode), `${rt.id} invalid defaultMode`)
  }
})

test('claude-code tmux snippet constructs --session-id/--resume from shell vars', () => {
  const rt = getRuntime('claude-code')!
  assert.ok(rt.tmuxSnippet.includes('$RESUME'))
  assert.ok(rt.tmuxSnippet.includes('--session-id'))
  assert.ok(rt.tmuxSnippet.includes('--resume'))
})

test('opencode snippet supports --session for resume', () => {
  const rt = getRuntime('opencode')!
  assert.ok(rt.headlessSnippet.includes('--session'))
  assert.ok(rt.headlessSnippet.includes('$RESUME'))
})
