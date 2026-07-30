import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

import { config } from '../src/config.js';
import { closeDb, getDb } from '../src/db.js';
import authRoutes from '../src/routes/auth.js';

const testDir = mkdtempSync(join(tmpdir(), 'resume-auth-registration-'));
const originalDbFile = config.paths.dbFile;
let server;
let baseUrl;

before(async () => {
  config.paths.dbFile = join(testDir, 'app.db');

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  closeDb();
  config.paths.dbFile = originalDbFile;
  rmSync(testDir, { recursive: true, force: true });
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  return { status: response.status, body: await response.json() };
}

test('first registration without an invite creates the administrator and later registrations still require an invite', async () => {
  const first = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ displayName: '首位管理员', password: 'first-pass-123' }),
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.user.role, 'admin');

  const second = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ displayName: '第二位用户', password: 'second-pass-123' }),
  });
  assert.equal(second.status, 400);
  assert.equal(second.body.error, '请提供邀请码');
});

test('an explicit empty invite code is accepted for the first user and rejected for a later user', async () => {
  const db = getDb();
  db.exec('DELETE FROM sessions; DELETE FROM users;');

  const first = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ code: '', displayName: '空码首位管理员', password: 'first-pass-456' }),
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.user.role, 'admin');

  const second = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ code: '', displayName: '空码第二位用户', password: 'second-pass-456' }),
  });
  assert.equal(second.status, 400);
  assert.equal(second.body.error, '请提供邀请码');
});
