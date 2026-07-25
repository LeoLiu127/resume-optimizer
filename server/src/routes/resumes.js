import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

/**
 * 简历列表
 * GET /api/resumes
 */
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, target_role, content, input_json, created_at, updated_at
       FROM resumes WHERE user_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(req.auth.userId);
  res.json({
    resumes: rows.map((r) => ({
      id: r.id,
      name: r.name,
      targetRole: r.target_role,
      content: r.content,
      input: r.input_json ? safeParse(r.input_json) : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
});

/**
 * 简历详情
 * GET /api/resumes/:id
 */
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, target_role, content, input_json, created_at, updated_at
       FROM resumes WHERE id = ? AND user_id = ?`,
    )
    .get(req.params.id, req.auth.userId);
  if (!row) return res.status(404).json({ error: '简历不存在' });
  res.json({
    id: row.id,
    name: row.name,
    targetRole: row.target_role,
    content: row.content,
    input: row.input_json ? safeParse(row.input_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
});

/**
 * 新建简历
 * POST /api/resumes
 * body: { name, content, targetRole?, input? }
 */
router.post('/', (req, res) => {
  const { name, content, targetRole, input } = req.body || {};
  // name 必填；content 可为空（用户可能还在填）
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name 必填' });
  }
  const id = crypto.randomUUID();
  const db = getDb();
  db.prepare(
    `INSERT INTO resumes (id, user_id, name, target_role, content, input_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    req.auth.userId,
    String(name).slice(0, 80),
    targetRole ? String(targetRole).slice(0, 80) : null,
    content ? String(content) : '',
    input ? JSON.stringify(input) : null,
  );
  res.json({ id });
});

/**
 * 更新简历
 * PUT /api/resumes/:id
 */
router.put('/:id', (req, res) => {
  const { name, content, targetRole, input } = req.body || {};
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM resumes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.auth.userId);
  if (!existing) return res.status(404).json({ error: '简历不存在' });

  db.prepare(
    `UPDATE resumes
     SET name = COALESCE(?, name),
         target_role = COALESCE(?, target_role),
         content = COALESCE(?, content),
         input_json = COALESCE(?, input_json),
         updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`,
  ).run(
    name ? String(name).slice(0, 80) : null,
    targetRole ? String(targetRole).slice(0, 80) : null,
    content ? String(content) : null,
    input ? JSON.stringify(input) : null,
    req.params.id,
    req.auth.userId,
  );
  res.json({ ok: true });
});

/**
 * 删除简历（级联删除 analyses）
 * DELETE /api/resumes/:id
 */
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM resumes WHERE id = ? AND user_id = ?').run(req.params.id, req.auth.userId);
  res.json({ ok: true });
});

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default router;
