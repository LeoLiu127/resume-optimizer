import test from 'node:test';
import assert from 'node:assert/strict';

import {
  draftStorageKeys,
  migrateLegacyDraft,
} from '../../src/services/resumeDraftStorage.js';

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

test('draft and active resume keys are isolated per user', () => {
  assert.deepEqual(draftStorageKeys('user-1'), {
    localKey: 'resume.draft.local.user-1',
    activeKey: 'resume.draft.activeId.user-1',
  });
  assert.notDeepEqual(draftStorageKeys('user-1'), draftStorageKeys('user-2'));
});

test('legacy global draft migrates once to the authenticated user', () => {
  const storage = fakeStorage({
    'resume.draft.local': '{"name":"legacy"}',
    'resume.draft.activeId': 'resume-legacy',
  });

  assert.equal(migrateLegacyDraft(storage, 'user-1'), true);
  assert.equal(storage.getItem('resume.draft.local.user-1'), '{"name":"legacy"}');
  assert.equal(storage.getItem('resume.draft.activeId.user-1'), 'resume-legacy');
  assert.equal(storage.getItem('resume.draft.local'), null);
  assert.equal(storage.getItem('resume.draft.activeId'), null);
});

test('an unauthenticated page never claims an unscoped legacy draft', () => {
  const storage = fakeStorage({
    'resume.draft.local': '{"name":"unknown owner"}',
  });

  assert.equal(migrateLegacyDraft(storage, ''), false);
  assert.equal(storage.getItem('resume.draft.local'), '{"name":"unknown owner"}');
});
