import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateWhenStable } from '../src/jd-extractor.js';

test('retries page evaluation after a navigation destroys the execution context', async () => {
  let attempts = 0;
  const page = {
    async evaluate() {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('Execution context was destroyed, most likely because of a navigation.');
      }
      return { title: '岗位', jdContent: '岗位要求' };
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
  };

  const result = await evaluateWhenStable(page, () => null);

  assert.deepEqual(result, { title: '岗位', jdContent: '岗位要求' });
  assert.equal(attempts, 2);
});
