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
  const { position_id } = req.query;
  let sql = `SELECT id, name, target_role, content, input_json, position_id, created_at, updated_at
       FROM resumes WHERE user_id = ?`;
  const params = [req.auth.userId];
  if (position_id) {
    sql += ' AND position_id = ?';
    params.push(position_id);
  }
  sql += ' ORDER BY updated_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({
    resumes: rows.map((r) => ({
      id: r.id,
      name: r.name,
      targetRole: r.target_role,
      content: r.content,
      input: r.input_json ? safeParse(r.input_json) : null,
      positionId: r.position_id || null,
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
      `SELECT id, name, target_role, content, input_json, position_id, created_at, updated_at
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
    positionId: row.position_id || null,
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
  const { name, content, targetRole, input, positionId } = req.body || {};
  // name 必填；content 可为空（用户可能还在填）
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name 必填' });
  }
  const id = crypto.randomUUID();
  const db = getDb();
  db.prepare(
    `INSERT INTO resumes (id, user_id, name, target_role, content, input_json, position_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    req.auth.userId,
    String(name).slice(0, 80),
    targetRole ? String(targetRole).slice(0, 80) : null,
    content ? String(content) : '',
    input ? JSON.stringify(input) : null,
    positionId || null,
  );
  res.json({ id });
});

/**
 * 更新简历
 * PUT /api/resumes/:id
 */
router.put('/:id', (req, res) => {
  const body = req.body || {};
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM resumes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.auth.userId);
  if (!existing) return res.status(404).json({ error: '简历不存在' });

  const assignments = [];
  const values = [];
  if (Object.hasOwn(body, 'name') && body.name) {
    assignments.push('name = ?');
    values.push(String(body.name).slice(0, 80));
  }
  if (Object.hasOwn(body, 'targetRole')) {
    assignments.push('target_role = ?');
    values.push(body.targetRole == null ? null : String(body.targetRole).slice(0, 80));
  }
  if (Object.hasOwn(body, 'content')) {
    assignments.push('content = ?');
    values.push(body.content == null ? '' : String(body.content));
  }
  if (Object.hasOwn(body, 'input')) {
    assignments.push('input_json = ?');
    values.push(body.input == null ? null : JSON.stringify(body.input));
  }
  if (Object.hasOwn(body, 'positionId')) {
    assignments.push('position_id = ?');
    values.push(body.positionId || null);
  }
  if (assignments.length > 0) {
    assignments.push("updated_at = datetime('now')");
    db.prepare(
      `UPDATE resumes SET ${assignments.join(', ')}
       WHERE id = ? AND user_id = ?`,
    ).run(...values, req.params.id, req.auth.userId);
  }
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
