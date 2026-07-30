import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  applyAccountConsolidation,
  buildAccountConsolidationPlan,
} from '../src/account-consolidation.js';

function createFixtureDb({ conflictingPosition = false } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE invite_codes (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE positions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url TEXT
    );
    CREATE UNIQUE INDEX idx_positions_user_url_unique
      ON positions(user_id, url)
      WHERE trim(url) <> '';
    CREATE TABLE resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      position_id TEXT REFERENCES positions(id) ON DELETE SET NULL
    );
    CREATE TABLE analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE followup_bullets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const insertUser = db.prepare(
    'INSERT INTO users (id, display_name, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
  );
  insertUser.run('leo', 'Leo Liu', '$2b$10$old', 'user', 'disabled');
  insertUser.run('legacy', '测试用户', '$2b$10$legacy', 'admin', 'active');

  db.prepare('INSERT INTO invite_codes (id, code) VALUES (?, ?)').run(1, 'KEEP-ME');
  db.prepare('INSERT INTO sessions (token_hash, user_id) VALUES (?, ?)').run('leo-session', 'leo');
  db.prepare('INSERT INTO sessions (token_hash, user_id) VALUES (?, ?)').run(
    'legacy-session',
    'legacy',
  );
  db.prepare('INSERT INTO positions (id, user_id, url) VALUES (?, ?, ?)').run(
    'legacy-position',
    'legacy',
    'https://example.com/jobs/1',
  );
  if (conflictingPosition) {
    db.prepare('INSERT INTO positions (id, user_id, url) VALUES (?, ?, ?)').run(
      'leo-position',
      'leo',
      'https://example.com/jobs/1',
    );
  }
  db.prepare('INSERT INTO resumes (id, user_id, position_id) VALUES (?, ?, ?)').run(
    'leo-resume',
    'leo',
    null,
  );
  db.prepare('INSERT INTO resumes (id, user_id, position_id) VALUES (?, ?, ?)').run(
    'legacy-resume',
    'legacy',
    'legacy-position',
  );
  db.prepare('INSERT INTO analyses (id, user_id) VALUES (?, ?)').run(
    'legacy-analysis',
    'legacy',
  );
  db.prepare('INSERT INTO followup_bullets (id, user_id) VALUES (?, ?)').run(
    'legacy-bullet',
    'legacy',
  );
  return db;
}

test('consolidation transfers owned data before deleting legacy users', () => {
  const db = createFixtureDb();

  const result = applyAccountConsolidation(db, {
    canonicalDisplayName: 'Leo Liu',
    passwordHash: '$2b$10$replacement',
  });

  assert.deepEqual(result, {
    canonicalUserId: 'leo',
    deletedUsers: 1,
    revokedSessions: 2,
    moved: {
      resumes: 1,
      positions: 1,
      analyses: 1,
      followupBullets: 1,
    },
  });
  assert.deepEqual(
    db
      .prepare('SELECT id, display_name, password_hash, role, status FROM users')
      .all()
      .map((row) => ({ ...row })),
    [
      {
        id: 'leo',
        display_name: 'Leo Liu',
        password_hash: '$2b$10$replacement',
        role: 'admin',
        status: 'active',
      },
    ],
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invite_codes').get().n, 1);
  for (const table of ['resumes', 'positions', 'analyses', 'followup_bullets']) {
    assert.equal(
      db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id <> ?`).get('leo').n,
      0,
    );
  }
  assert.equal(
    db.prepare('SELECT position_id FROM resumes WHERE id = ?').get('legacy-resume').position_id,
    'legacy-position',
  );
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.close();
});

test('preflight rejects a missing canonical user without changing data', () => {
  const db = createFixtureDb();

  assert.throws(
    () => buildAccountConsolidationPlan(db, 'Missing User'),
    /exactly one canonical user/i,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 2);
  db.close();
});

test('position URL conflicts abort the entire consolidation', () => {
  const db = createFixtureDb({ conflictingPosition: true });

  assert.throws(
    () =>
      applyAccountConsolidation(db, {
        canonicalDisplayName: 'Leo Liu',
        passwordHash: '$2b$10$replacement',
      }),
    /position url conflict/i,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);
  assert.equal(
    db.prepare('SELECT user_id FROM resumes WHERE id = ?').get('legacy-resume').user_id,
    'legacy',
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 2);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.close();
});
