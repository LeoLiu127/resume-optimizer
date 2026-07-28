import test from 'node:test';
import assert from 'node:assert/strict';

import { extractJsonObject } from '../src/json-response.js';
import { parseCompletionResponse } from '../src/minimax-client.js';

test('extracts the final JSON object after a MiniMax think block', () => {
  assert.deepEqual(
    extractJsonObject('<think>内部推理，不应进入业务结果</think>\n{"ok":true,"score":86}'),
    { ok: true, score: 86 },
  );
});

test('extracts a balanced JSON object without being confused by braces in strings', () => {
  assert.deepEqual(
    extractJsonObject('说明文字\n{"message":"保留 } 字符","nested":{"items":[1,2]}}\n结束'),
    {
      message: '保留 } 字符',
      nested: { items: [1, 2] },
    },
  );
});

test('rejects a completion truncated by the model output limit', () => {
  assert.throws(
    () =>
      parseCompletionResponse({
        model: 'MiniMax-M3',
        choices: [
          {
            finish_reason: 'length',
            message: {
              content: '{"summary":',
              reasoning_content: '分析中',
            },
          },
        ],
      }),
    /输出被截断/,
  );
});

test('returns final content separately from reasoning content', () => {
  assert.deepEqual(
    parseCompletionResponse({
      model: 'MiniMax-M3',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: '{"ok":true}',
            reasoning_content: '内部推理',
          },
        },
      ],
      usage: { completion_tokens: 42 },
    }),
    {
      content: '{"ok":true}',
      reasoningContent: '内部推理',
      finishReason: 'stop',
      model: 'MiniMax-M3',
      usage: { completion_tokens: 42 },
    },
  );
});
