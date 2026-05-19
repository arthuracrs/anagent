import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractFromJsonl } from '../src/execution/jsonl'

function line(obj: object): string {
  return JSON.stringify(obj)
}

function assistantLine(text: string, stopReason = 'end_turn'): string {
  return line({
    type: 'assistant',
    message: {
      content: [{ type: 'text', text }],
      stop_reason: stopReason,
    },
  })
}

test('extracts text from a terminal assistant message', () => {
  const jsonl = assistantLine('Hello world')
  assert.equal(extractFromJsonl(jsonl), 'Hello world')
})

test('returns the last terminal message when multiple exist', () => {
  const jsonl = [
    assistantLine('first response'),
    assistantLine('second response'),
  ].join('\n')
  assert.equal(extractFromJsonl(jsonl), 'second response')
})

test('skips tool_use stop reason', () => {
  const jsonl = [
    assistantLine('calling a tool', 'tool_use'),
    assistantLine('final answer'),
  ].join('\n')
  assert.equal(extractFromJsonl(jsonl), 'final answer')
})

test('skips pause_turn stop reason', () => {
  const jsonl = assistantLine('paused', 'pause_turn')
  assert.equal(extractFromJsonl(jsonl), null)
})

test('skips non-assistant event types', () => {
  const jsonl = [
    line({ type: 'system', subtype: 'init' }),
    line({ type: 'user', message: { content: 'hello' } }),
    assistantLine('response'),
  ].join('\n')
  assert.equal(extractFromJsonl(jsonl), 'response')
})

test('handles content as a plain string', () => {
  const jsonl = line({
    type: 'assistant',
    message: { content: 'plain string content', stop_reason: 'end_turn' },
  })
  assert.equal(extractFromJsonl(jsonl), 'plain string content')
})

test('joins multiple text blocks', () => {
  const jsonl = line({
    type: 'assistant',
    message: {
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
      ],
      stop_reason: 'end_turn',
    },
  })
  assert.equal(extractFromJsonl(jsonl), 'Hello world')
})

test('skips malformed JSON lines', () => {
  const jsonl = [
    'not valid json{{{{',
    assistantLine('valid response'),
  ].join('\n')
  assert.equal(extractFromJsonl(jsonl), 'valid response')
})

test('returns null for empty input', () => {
  assert.equal(extractFromJsonl(''), null)
})

test('returns null when no terminal message exists', () => {
  const jsonl = line({ type: 'system', subtype: 'init' })
  assert.equal(extractFromJsonl(jsonl), null)
})
