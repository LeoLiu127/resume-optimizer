import test from 'node:test';
import assert from 'node:assert/strict';

import {
  answerStorageKeys,
  clearAllAnswerStorage,
  clearTransientAnswerStorage,
  ensureTransientAnswerContext,
} from '../../src/services/answerStorage.js';

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test('answer storage keys are scoped to the authenticated user', () => {
  assert.deepEqual(answerStorageKeys('user-1'), {
    bankKey: 'resume.answerBank.user-1',
    answersKey: 'resume.answers.user-1',
    bulletsKey: 'resume.bullets.user-1',
    contextKey: 'resume.answerContext.user-1',
  });
});

test('transient cleanup preserves the long-term answer bank', () => {
  const storage = fakeStorage({
    'resume.answerBank.user-1': '{"question":{"answer":"kept"}}',
    'resume.answers.user-1': '{"q1":"temporary"}',
    'resume.bullets.user-1': '{"q1":"temporary bullet"}',
  });

  clearTransientAnswerStorage(storage, 'user-1');

  assert.equal(storage.getItem('resume.answerBank.user-1'), '{"question":{"answer":"kept"}}');
  assert.equal(storage.getItem('resume.answers.user-1'), null);
  assert.equal(storage.getItem('resume.bullets.user-1'), null);
});

test('explicit full cleanup removes all answer storage', () => {
  const storage = fakeStorage({
    'resume.answerBank.user-1': '{}',
    'resume.answers.user-1': '{}',
    'resume.bullets.user-1': '{}',
    'resume.answerContext.user-1': 'context-1',
  });

  clearAllAnswerStorage(storage, 'user-1');

  for (const key of Object.values(answerStorageKeys('user-1'))) {
    assert.equal(storage.getItem(key), null);
  }
});

test('a changed analysis context clears transient answers but keeps the answer bank', () => {
  const storage = fakeStorage({
    'resume.answerBank.user-1': '{"saved":{"answer":"keep"}}',
    'resume.answers.user-1': '{"q1":"old answer"}',
    'resume.bullets.user-1': '{"q1":"old bullet"}',
    'resume.answerContext.user-1': 'old-context',
  });

  assert.equal(ensureTransientAnswerContext(storage, 'user-1', 'new-context'), true);
  assert.equal(storage.getItem('resume.answers.user-1'), null);
  assert.equal(storage.getItem('resume.bullets.user-1'), null);
  assert.equal(storage.getItem('resume.answerBank.user-1'), '{"saved":{"answer":"keep"}}');
  assert.equal(storage.getItem('resume.answerContext.user-1'), 'new-context');
});

test('the same analysis context keeps transient answers', () => {
  const storage = fakeStorage({
    'resume.answers.user-1': '{"q1":"keep current"}',
    'resume.answerContext.user-1': 'same-context',
  });

  assert.equal(ensureTransientAnswerContext(storage, 'user-1', 'same-context'), false);
  assert.equal(storage.getItem('resume.answers.user-1'), '{"q1":"keep current"}');
});
