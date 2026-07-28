import test from 'node:test';
import assert from 'node:assert/strict';

import { analysisFailureState } from '../../src/services/analysisPolicy.js';

test('an AI API failure leaves analysis empty instead of creating mock data', () => {
  const error = new Error('MiniMax 输出被截断');
  error.code = 'API';

  assert.deepEqual(analysisFailureState(error), {
    data: null,
    engine: '',
    error: 'AI 分析失败：MiniMax 输出被截断',
  });
});
