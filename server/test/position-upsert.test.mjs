import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePositionUrl } from '../src/position-url.js';

test('normalizes equivalent public job URLs without changing meaningful query data', () => {
  assert.equal(
    normalizePositionUrl(' HTTPS://Example.COM:443/jobs/1/#details '),
    'https://example.com/jobs/1',
  );
  assert.equal(
    normalizePositionUrl('https://example.com/jobs/1?ref=abc'),
    'https://example.com/jobs/1?ref=abc',
  );
});

test('invalid or empty position URLs normalize to an empty value', () => {
  assert.equal(normalizePositionUrl(''), '');
  assert.equal(normalizePositionUrl('not a url'), '');
  assert.equal(normalizePositionUrl('file:///tmp/job'), '');
});

