import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeRewriteItems } from '../src/ai-response.js';

test('rewrite response normalization unwraps the optimizedItems object contract', () => {
  const items = [
    {
      id: 'opt-1',
      section: '工作经历',
      before: '参与需求讨论',
      after: '协同业务与研发完成需求澄清',
      reason: '岗位匹配',
      riskWarning: '需补充结果',
    },
  ];

  assert.deepEqual(normalizeRewriteItems({ optimizedItems: items }), items);
  assert.deepEqual(normalizeRewriteItems(items), items);
});

test('rewrite response normalization rejects malformed model output', () => {
  assert.throws(
    () => normalizeRewriteItems({ result: 'not-an-array' }),
    /optimizedItems/,
  );
});
