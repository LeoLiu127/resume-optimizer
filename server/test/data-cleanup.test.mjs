import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import { exampleInput } from '../../src/mockData.js';
import {
  applyCleanupPlan,
  buildCleanupPlan,
} from '../src/data-cleanup.js';

function createFixtureDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE positions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      url TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      input_json TEXT,
      position_id TEXT REFERENCES positions(id) ON DELETE SET NULL
    );
  `);
  const insertPosition = db.prepare(
    'INSERT INTO positions (id, user_id, url, updated_at) VALUES (?, ?, ?, ?)',
  );
  insertPosition.run('linked-position', 'user-1', 'HTTPS://EXAMPLE.COM:443/job/1/#saved', '2026-07-28 03:00:00');
  insertPosition.run('orphan-older', 'user-1', 'https://example.com/job/1/', '2026-07-28 01:00:00');
  insertPosition.run('orphan-newer', 'user-1', 'HTTPS://EXAMPLE.COM:443/job/1#details', '2026-07-28 02:00:00');
  insertPosition.run('other-user-position', 'user-2', 'https://example.com/job/1', '2026-07-28 04:00:00');

  const insertResume = db.prepare(
    'INSERT INTO resumes (id, user_id, input_json, position_id) VALUES (?, ?, ?, ?)',
  );
  insertResume.run(
    'linked-resume',
    'user-1',
    JSON.stringify({ ...exampleInput, resume: 'uploaded resume content' }),
    'linked-position',
  );
  insertResume.run('exact-example', 'user-1', JSON.stringify(exampleInput), null);
  insertResume.run(
    'real-resume',
    'user-1',
    JSON.stringify({ ...exampleInput, resume: 'real content' }),
    null,
  );
  return db;
}

test('cleanup plan selects only orphan duplicate positions and exact examples', () => {
  const db = createFixtureDb();
  const plan = buildCleanupPlan(db, exampleInput);

  assert.deepEqual(plan.duplicatePositionIds.sort(), ['orphan-newer', 'orphan-older']);
  assert.deepEqual(plan.exactExampleResumeIds, ['exact-example']);
  assert.equal(plan.duplicatePositionIds.includes('linked-position'), false);
  assert.equal(plan.duplicatePositionIds.includes('other-user-position'), false);
  db.close();
});

test('cleanup applies exact deletes without touching linked positions or real resumes', () => {
  const db = createFixtureDb();
  const plan = buildCleanupPlan(db, exampleInput);

  const result = applyCleanupPlan(db, plan, exampleInput);

  assert.deepEqual(result, { deletedPositions: 2, deletedResumes: 1 });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM positions').get().n, 2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM resumes').get().n, 2);
  assert.equal(
    db.prepare('SELECT COUNT(*) n FROM positions WHERE id = ?').get('linked-position').n,
    1,
  );
  assert.equal(
    db.prepare('SELECT url FROM positions WHERE id = ?').get('linked-position').url,
    'https://example.com/job/1',
  );
  assert.equal(
    db.prepare('SELECT COUNT(*) n FROM resumes WHERE id = ?').get('real-resume').n,
    1,
  );
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.close();
});
