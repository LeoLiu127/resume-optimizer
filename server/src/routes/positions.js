import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db.js';
import { requireAuth } from '../auth.js';
import { normalizePositionUrl } from '../position-url.js';

const router = Router();
router.use(requireAuth);

/**
 * 岗位列表
 * GET /api/positions
 */
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, title, company, url, source_site, jd_content, target_industry,
              target_company_type, job_stage, highlight_skills, extras, status, created_at, updated_at
       FROM positions WHERE user_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(req.auth.userId);

  // 附带每个岗位关联的简历数量
  const countStmt = db.prepare('SELECT COUNT(*) as cnt FROM resumes WHERE position_id = ? AND user_id = ?');
  res.json({
    positions: rows.map((r) => ({
      ...mapRow(r),
      resumeCount: countStmt.get(r.id, req.auth.userId)?.cnt || 0,
    })),
  });
});

/**
 * 岗位详情 + 关联简历列表
 * GET /api/positions/:id
 */
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, title, company, url, source_site, jd_content, target_industry,
              target_company_type, job_stage, highlight_skills, extras, status, created_at, updated_at
       FROM positions WHERE id = ? AND user_id = ?`,
    )
    .get(req.params.id, req.auth.userId);
  if (!row) return res.status(404).json({ error: '岗位不存在' });

  const linkedResumes = db
    .prepare(
      `SELECT id, name, target_role, created_at, updated_at FROM resumes
       WHERE position_id = ? AND user_id = ? ORDER BY updated_at DESC`,
    )
    .all(req.params.id, req.auth.userId);

  res.json({
    ...mapRow(row),
    resumes: linkedResumes.map((r) => ({
      id: r.id,
      name: r.name,
      targetRole: r.target_role || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
});

/**
 * 创建岗位
 * POST /api/positions
 * body: { title, company?, url?, sourceSite?, jdContent?, targetIndustry?, targetCompanyType?, jobStage?, highlightSkills?, extras?, status? }
 */
router.post('/', (req, res) => {
  const { title, company, url, sourceSite, jdContent, targetIndustry, targetCompanyType, jobStage, highlightSkills, extras, status } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title 必填（岗位名称）' });
  }
  const db = getDb();
  const normalizedUrl = normalizePositionUrl(url);
  const values = {
    title: text(title, 120),
    company: text(company, 120),
    url: normalizedUrl,
    sourceSite: text(sourceSite, 50),
    jdContent: text(jdContent, 8000),
    targetIndustry: text(targetIndustry, 120),
    targetCompanyType: text(targetCompanyType, 80),
    jobStage: text(jobStage, 80),
    highlightSkills: text(highlightSkills, 500),
    extras: text(extras, 500),
    status: validStatus(status),
  };

  db.exec('BEGIN IMMEDIATE');
  try {
    if (normalizedUrl) {
      const existing = db
        .prepare('SELECT id FROM positions WHERE user_id = ? AND url = ? ORDER BY updated_at DESC LIMIT 1')
        .get(req.auth.userId, normalizedUrl);
      if (existing) {
        db.prepare(
          `UPDATE positions
           SET title = ?, company = ?, source_site = ?, jd_content = ?,
               target_industry = ?, target_company_type = ?, job_stage = ?,
               highlight_skills = ?, extras = ?, status = ?, updated_at = datetime('now')
           WHERE id = ? AND user_id = ?`,
        ).run(
          values.title,
          values.company,
          values.sourceSite,
          values.jdContent,
          values.targetIndustry,
          values.targetCompanyType,
          values.jobStage,
          values.highlightSkills,
          values.extras,
          values.status,
          existing.id,
          req.auth.userId,
        );
        db.exec('COMMIT');
        return res.json({ id: existing.id, created: false });
      }
    }

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO positions (id, user_id, title, company, url, source_site, jd_content, target_industry, target_company_type, job_stage, highlight_skills, extras, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      req.auth.userId,
      values.title,
      values.company,
      values.url,
      values.sourceSite,
      values.jdContent,
      values.targetIndustry,
      values.targetCompanyType,
      values.jobStage,
      values.highlightSkills,
      values.extras,
      values.status,
    );
    db.exec('COMMIT');
    return res.json({ id, created: true });
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
});

/**
 * 更新岗位（改状态/编辑 JD/修改信息）
 * PUT /api/positions/:id
 */
router.put('/:id', (req, res) => {
  const body = req.body || {};
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM positions WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.auth.userId);
  if (!existing) return res.status(404).json({ error: '岗位不存在' });

  const fields = [
    ['title', 'title', (value) => text(value, 120)],
    ['company', 'company', (value) => text(value, 120)],
    ['url', 'url', (value) => text(value, 500)],
    ['sourceSite', 'source_site', (value) => text(value, 50)],
    ['jdContent', 'jd_content', (value) => text(value, 8000)],
    ['targetIndustry', 'target_industry', (value) => text(value, 120)],
    ['targetCompanyType', 'target_company_type', (value) => text(value, 80)],
    ['jobStage', 'job_stage', (value) => text(value, 80)],
    ['highlightSkills', 'highlight_skills', (value) => text(value, 500)],
    ['extras', 'extras', (value) => text(value, 500)],
    ['status', 'status', validStatus],
  ];
  const assignments = [];
  const values = [];
  for (const [key, column, normalize] of fields) {
    if (!Object.hasOwn(body, key)) continue;
    assignments.push(`${column} = ?`);
    values.push(normalize(body[key]));
  }
  if (assignments.length > 0) {
    assignments.push("updated_at = datetime('now')");
    db.prepare(
      `UPDATE positions SET ${assignments.join(', ')}
       WHERE id = ? AND user_id = ?`,
    ).run(...values, req.params.id, req.auth.userId);
  }
  res.json({ ok: true });
});

/**
 * 删除岗位
 * DELETE /api/positions/:id
 */
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM positions WHERE id = ? AND user_id = ?').run(req.params.id, req.auth.userId);
  res.json({ ok: true });
});

/**
 * 从当前分析输入快速创建岗位
 * POST /api/positions/from-input
 * body: { input: { targetRole, targetIndustry, targetCompanyType, jobStage, highlightSkills, jd, extras } }
 */
router.post('/from-input', (req, res) => {
  const { input } = req.body || {};
  if (!input) return res.status(400).json({ error: 'input 必填' });
  const title = input.targetRole || '未命名岗位';
  const id = crypto.randomUUID();
  const db = getDb();
  db.prepare(
    `INSERT INTO positions (id, user_id, title, company, url, source_site, jd_content, target_industry, target_company_type, job_stage, highlight_skills, extras, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    req.auth.userId,
    text(title, 120),
    '', '', '',
    text(input.jd, 8000),
    text(input.targetIndustry, 120),
    text(input.targetCompanyType, 80),
    text(input.jobStage, 80),
    text(input.highlightSkills, 500),
    text(input.extras, 500),
    'preparing',
  );
  res.json({ id });
});

/* ============ helpers ============ */

const VALID_STATUSES = new Set(['preparing', 'applied', 'interview', 'offer', 'rejected']);

function validStatus(s) {
  return VALID_STATUSES.has(s) ? s : 'preparing';
}

/**
 * 统一转字符串（核心防御：node:sqlite 不能绑定 undefined）
 * - undefined / null / NaN → '' 空字符串（避免 NOT NULL 冲突；为 '' 而非 null 让 UI 显示为空）
 * - 对象 / 数组 → JSON 字符串
 * - 其他 → String(val).slice(0, maxLen)
 */
function text(val, maxLen = 4000) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val).slice(0, maxLen);
    } catch {
      return '';
    }
  }
  if (typeof val === 'number' && !Number.isFinite(val)) return '';
  return String(val).slice(0, maxLen);
}

function mapRow(r) {
  return {
    id: r.id,
    title: r.title,
    company: r.company || '',
    url: r.url || '',
    sourceSite: r.source_site || '',
    jdContent: r.jd_content || '',
    targetIndustry: r.target_industry || '',
    targetCompanyType: r.target_company_type || '',
    jobStage: r.job_stage || '',
    highlightSkills: r.highlight_skills || '',
    extras: r.extras || '',
    status: r.status || 'preparing',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export default router;
