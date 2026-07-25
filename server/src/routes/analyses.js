import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

/**
 * 分析结果列表（可按 resume_id 过滤）
 * GET /api/analyses?resume_id=...
 */
router.get('/', (req, res) => {
  const db = getDb();
  const { resume_id } = req.query;
  const rows = resume_id
    ? db
        .prepare(
          `SELECT id, resume_id, target_json, jd, extras, result_json, variant, created_at
           FROM analyses WHERE user_id = ? AND resume_id = ? ORDER BY created_at DESC`,
        )
        .all(req.auth.userId, String(resume_id))
    : db
        .prepare(
          `SELECT id, resume_id, target_json, jd, extras, result_json, variant, created_at
           FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
        )
        .all(req.auth.userId);

  res.json({
    analyses: rows.map((r) => ({
      id: r.id,
      resumeId: r.resume_id,
      target: r.target_json ? safeParse(r.target_json) : null,
      jd: r.jd,
      extras: r.extras,
      variant: r.variant,
      result: r.result_json ? safeParse(r.result_json) : null,
      createdAt: r.created_at,
    })),
  });
});

/**
 * 新建分析结果
 * POST /api/analyses
 * body: { resumeId?, target, jd, extras, result, variant? }
 */
router.post('/', (req, res) => {
  const { resumeId, target, jd, extras, result, variant } = req.body || {};
  if (!result) {
    return res.status(400).json({ error: 'result 必填' });
  }
  const id = crypto.randomUUID();
  const db = getDb();
  // 校验 resumeId 必须属于当前用户
  if (resumeId) {
    const own = db
      .prepare('SELECT id FROM resumes WHERE id = ? AND user_id = ?')
      .get(resumeId, req.auth.userId);
    if (!own) return res.status(400).json({ error: 'resumeId 无效' });
  }
  db.prepare(
    `INSERT INTO analyses (id, user_id, resume_id, target_json, jd, extras, result_json, variant)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    req.auth.userId,
    resumeId || null,
    target ? JSON.stringify(target) : null,
    jd || null,
    extras || null,
    JSON.stringify(result),
    variant || 'balanced',
  );
  res.json({ id });
});

/**
 * 追问 bullet 历史
 * GET /api/bullets
 */
router.get('/bullets', (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, ask_id, question, answer, bullet, created_at
       FROM followup_bullets WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    )
    .all(req.auth.userId);
  res.json({
    bullets: rows.map((r) => ({
      id: r.id,
      askId: r.ask_id,
      question: r.question,
      answer: r.answer,
      bullet: r.bullet,
      createdAt: r.created_at,
    })),
  });
});

/**
 * 保存追问 bullet
 * POST /api/bullets
 */
router.post('/bullets', (req, res) => {
  const { askId, question, answer, bullet } = req.body || {};
  if (!askId || !question || !answer || !bullet) {
    return res.status(400).json({ error: 'askId / question / answer / bullet 都必填' });
  }
  const id = crypto.randomUUID();
  const db = getDb();
  db.prepare(
    `INSERT INTO followup_bullets (id, user_id, ask_id, question, answer, bullet)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, req.auth.userId, String(askId), String(question), String(answer), String(bullet));
  res.json({ id });
});

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default router;
