import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeApiBase, notifyUnauthorized } from '../../src/services/api.js';

test('same-origin /api deployment base does not duplicate the API prefix', () => {
  assert.equal(normalizeApiBase('/api'), '');
  assert.equal(normalizeApiBase('/api/'), '');
});

test('unauthorized notification dispatches the shared logout event', () => {
  const events = [];
  const windowLike = {
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    dispatchEvent(event) {
      events.push(event);
    },
  };

  notifyUnauthorized(windowLike);

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'resume:logout');
  assert.deepEqual(events[0].detail, { reason: 'unauthorized' });
});
