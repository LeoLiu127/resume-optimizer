import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

import { config } from '../src/config.js';
import { closeDb, getDb } from '../src/db.js';
import { hashToken } from '../src/auth.js';
import analyzeRoutes from '../src/routes/analyze.js';
import jdRoutes from '../src/routes/jd.js';
import positionRoutes from '../src/routes/positions.js';
import resumeRoutes from '../src/routes/resumes.js';

const testDir = mkdtempSync(join(tmpdir(), 'resume-api-contract-'));
const token = 'test-token-that-is-long-enough-for-auth';
const userId = 'test-user';

let server;
let baseUrl;

before(async () => {
  config.paths.dbFile = join(testDir, 'app.db');
  config.minimax.apiKey = '';

  const db = getDb();
  db.prepare(
    'INSERT INTO users (id, display_name, role, status) VALUES (?, ?, ?, ?)',
  ).run(userId, '测试用户', 'user', 'active');
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
  ).run(hashToken(token), userId, new Date(Date.now() + 60_000).toISOString());

  const app = express();
  app.use(express.json());
  app.use('/api/analyze', analyzeRoutes);
  app.use('/api/jd', jdRoutes);
  app.use('/api/positions', positionRoutes);
  app.use('/api/resumes', resumeRoutes);
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `路由不存在：${req.method} ${req.path}` });
  });

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  closeDb();
  rmSync(testDir, { recursive: true, force: true });
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await response.json();
  return { status: response.status, body };
}

test('POST /api/analyze does not silently return mock by default', async () => {
  const previous = process.env.SERVER_FALLBACK_MOCK;
  delete process.env.SERVER_FALLBACK_MOCK;
  try {
    const result = await request('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        input: {
          targetRole: 'AI 产品经理',
          jd: '负责 AI 产品规划与落地',
          resume: '负责过跨部门产品项目',
        },
        answers: {},
      }),
    });

    assert.equal(result.status, 503);
    assert.equal(result.body.engine, undefined);
    assert.match(result.body.error, /未配置 MiniMax API Key/);
  } finally {
    if (previous === undefined) {
      delete process.env.SERVER_FALLBACK_MOCK;
    } else {
      process.env.SERVER_FALLBACK_MOCK = previous;
    }
  }
});

test('POST /api/analyze returns mock only in explicit demo mode', async () => {
  const previous = process.env.SERVER_FALLBACK_MOCK;
  process.env.SERVER_FALLBACK_MOCK = 'true';
  try {
    const result = await request('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        input: {
          targetRole: 'AI 产品经理',
          jd: '负责 AI 产品规划与落地',
          resume: '负责过跨部门产品项目',
        },
        answers: {},
      }),
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.engine, 'mock');
    assert.ok(result.body.data?.summary);
  } finally {
    if (previous === undefined) {
      delete process.env.SERVER_FALLBACK_MOCK;
    } else {
      process.env.SERVER_FALLBACK_MOCK = previous;
    }
  }
});

test('POST /api/analyze/resume-english validates finalResume', async () => {
  const result = await request('/api/analyze/resume-english', {
    method: 'POST',
    body: JSON.stringify({ role: 'AI Product Manager' }),
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /finalResume/);
});

test('POST /api/analyze/resume-english reports missing MiniMax config', async () => {
  const result = await request('/api/analyze/resume-english', {
    method: 'POST',
    body: JSON.stringify({ finalResume: { basic: ['张晨'] }, role: 'AI产品经理' }),
  });
  assert.equal(result.status, 503);
  assert.match(result.body.error, /MiniMax API Key/);
});

test('POST /api/jd/translate returns a stable bilingual contract for Chinese content', async () => {
  const result = await request('/api/jd/translate', {
    method: 'POST',
    body: JSON.stringify({
      title: '普通话翻译专家',
      jdContent: '岗位要求：负责普通话和英语翻译、内容校对以及远程团队协作。',
    }),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.originalTitle, '普通话翻译专家');
  assert.equal(result.body.bilingualTitle, '普通话翻译专家');
  assert.equal(
    result.body.originalJd,
    '岗位要求：负责普通话和英语翻译、内容校对以及远程团队协作。',
  );
  assert.equal(result.body.bilingualJd, result.body.originalJd);
});

test('updating only a position status preserves all omitted position fields', async () => {
  const created = await request('/api/positions', {
    method: 'POST',
    body: JSON.stringify({
      title: 'AI 产品经理',
      company: '示例科技',
      url: 'https://jobs.example.com/ai-pm',
      sourceSite: '示例招聘',
      jdContent: '负责 AI 产品规划、用户研究与跨部门落地。',
      targetIndustry: '人工智能',
      targetCompanyType: '成长型公司',
      jobStage: '准备投递',
      highlightSkills: '产品策略、AI 应用',
      extras: '优先考虑 B 端经验',
      status: 'preparing',
    }),
  });
  assert.equal(created.status, 200);

  const updated = await request(`/api/positions/${created.body.id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'applied' }),
  });
  assert.equal(updated.status, 200);

  const detail = await request(`/api/positions/${created.body.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.status, 'applied');
  assert.equal(detail.body.company, '示例科技');
  assert.equal(detail.body.jdContent, '负责 AI 产品规划、用户研究与跨部门落地。');
  assert.equal(detail.body.targetIndustry, '人工智能');
  assert.equal(detail.body.extras, '优先考虑 B 端经验');
});

test('posting the same normalized position URL updates one record', async () => {
  const first = await request('/api/positions', {
    method: 'POST',
    body: JSON.stringify({
      title: '旧标题',
      url: 'https://jobs.example.com/upsert-role/',
      jdContent: '旧 JD',
    }),
  });
  const second = await request('/api/positions', {
    method: 'POST',
    body: JSON.stringify({
      title: '新标题',
      url: 'HTTPS://JOBS.EXAMPLE.COM:443/upsert-role#details',
      jdContent: '新 JD',
    }),
  });

  assert.equal(first.status, 200);
  assert.equal(first.body.created, true);
  assert.equal(second.status, 200);
  assert.equal(second.body.id, first.body.id);
  assert.equal(second.body.created, false);

  const detail = await request(`/api/positions/${first.body.id}`);
  assert.equal(detail.body.title, '新标题');
  assert.equal(detail.body.jdContent, '新 JD');

  const listed = await request('/api/positions');
  assert.equal(
    listed.body.positions.filter((position) => position.url === 'https://jobs.example.com/upsert-role').length,
    1,
  );
});

test('positions without URLs remain independent records', async () => {
  const first = await request('/api/positions', {
    method: 'POST',
    body: JSON.stringify({ title: '手工岗位' }),
  });
  const second = await request('/api/positions', {
    method: 'POST',
    body: JSON.stringify({ title: '手工岗位' }),
  });

  assert.notEqual(first.body.id, second.body.id);
  assert.equal(first.body.created, true);
  assert.equal(second.body.created, true);
});

test('an explicit empty value or null clears a resume field and position binding', async () => {
  const position = await request('/api/positions', {
    method: 'POST',
    body: JSON.stringify({ title: '待解绑岗位' }),
  });
  const created = await request('/api/resumes', {
    method: 'POST',
    body: JSON.stringify({
      name: '待编辑简历',
      content: '原始简历内容',
      targetRole: '产品经理',
      input: { resume: '原始简历内容', targetRole: '产品经理' },
      positionId: position.body.id,
    }),
  });
  assert.equal(created.status, 200);

  const updated = await request(`/api/resumes/${created.body.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      content: '',
      targetRole: '',
      input: null,
      positionId: null,
    }),
  });
  assert.equal(updated.status, 200);

  const detail = await request(`/api/resumes/${created.body.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.content, '');
  assert.equal(detail.body.targetRole, '');
  assert.equal(detail.body.input, null);
  assert.equal(detail.body.positionId, null);
});
