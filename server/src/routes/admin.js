import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { config } from '../config.js';

const router = Router();
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInviteCode(length = config.invite.codeLength) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return out;
}

router.use(requireAuth, requireAdmin);

/**
 * 列出所有用户（管理员视角）
 * GET /api/admin/users
 */
router.get('/users', (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.id, u.display_name, u.role, u.status, u.created_at, u.last_seen_at,
              (SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) AS resume_count,
              (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS active_sessions
       FROM users u
       ORDER BY u.created_at DESC`,
    )
    .all();

  // 找到每个用户最近使用的邀请码（用于显示）
  const codeByUser = new Map();
  for (const u of rows) {
    const codeRow = db
      .prepare(
        `SELECT i.code, i.label FROM sessions s
         LEFT JOIN invite_codes i ON s.invite_code_id = i.id
         WHERE s.user_id = ?
         ORDER BY s.created_at DESC LIMIT 1`,
      )
      .get(u.id);
    codeByUser.set(u.id, codeRow);
  }

  res.json({
    users: rows.map((u) => ({
      id: u.id,
      displayName: u.display_name,
      role: u.role,
      status: u.status,
      createdAt: u.created_at,
      lastSeenAt: u.last_seen_at,
      resumeCount: u.resume_count,
      activeSessions: u.active_sessions,
      inviteCode: codeByUser.get(u.id)?.code || null,
      inviteLabel: codeByUser.get(u.id)?.label || null,
    })),
  });
});

/**
 * 查看用户详情
 * GET /api/admin/users/:id
 */
router.get('/users/:id', (req, res) => {
  const db = getDb();
  const user = db
    .prepare(
      `SELECT id, display_name, role, status, created_at, last_seen_at
       FROM users WHERE id = ?`,
    )
    .get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const resumes = db
    .prepare(
      `SELECT id, name, target_role, updated_at FROM resumes
       WHERE user_id = ? ORDER BY updated_at DESC`,
    )
    .all(req.params.id);
  const sessions = db
    .prepare(`SELECT created_at, expires_at FROM sessions WHERE user_id = ?`)
    .all(req.params.id);
  res.json({
    user: {
      id: user.id,
      displayName: user.display_name,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
      lastSeenAt: user.last_seen_at,
    },
    resumes: resumes.map((r) => ({
      id: r.id,
      name: r.name,
      targetRole: r.target_role,
      updatedAt: r.updated_at,
    })),
    sessions: sessions.map((s) => ({
      createdAt: s.created_at,
      expiresAt: s.expires_at,
    })),
  });
});

/**
 * 禁用 / 启用用户
 * POST /api/admin/users/:id/disable
 * POST /api/admin/users/:id/enable
 */
function setStatus(req, res, status) {
  const db = getDb();
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.role === 'admin' && status === 'disabled') {
    return res.status(400).json({ error: '不能禁用管理员账号' });
  }
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true, status });
}

router.post('/users/:id/disable', (req, res) => setStatus(req, res, 'disabled'));
router.post('/users/:id/enable', (req, res) => setStatus(req, res, 'active'));

/**
 * 重置用户密码（管理员操作）
 * POST /api/admin/users/:id/reset-password
 * body: { newPassword }
 */
router.post('/users/:id/reset-password', (req, res) => {
  const { newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: '密码至少 8 位' });
  }
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ ok: true });
});

/**
 * 重置用户的全部 session（强制下线）
 * POST /api/admin/users/:id/revoke-sessions
 */
router.post('/users/:id/revoke-sessions', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const r = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
  res.json({ ok: true, revoked: r.changes });
});

/**
 * 删除用户（级联删除简历/分析/session）
 * DELETE /api/admin/users/:id
 */
router.delete('/users/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.role === 'admin') {
    return res.status(400).json({ error: '不能删除管理员账号' });
  }
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.json({ ok: true });
});

/**
 * 列出邀请码（含使用情况）
 * GET /api/admin/invites
 */
router.get('/invites', (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, code, label, revoked, max_uses, used_count, created_at, expires_at
       FROM invite_codes ORDER BY created_at DESC`,
    )
    .all();
  res.json({
    invites: rows.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      revoked: Boolean(r.revoked),
      maxUses: r.max_uses,
      usedCount: r.used_count,
      remaining: r.max_uses - r.used_count,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    })),
  });
});

/**
 * 生成新邀请码
 * POST /api/admin/invites
 * body: { count?, maxUses?, label?, expiresAt? }
 */
router.post('/invites', (req, res) => {
  const count = Math.min(50, Math.max(1, Number(req.body?.count) || 1));
  const maxUses = Math.min(50, Math.max(1, Number(req.body?.maxUses) || 1));
  const label = (req.body?.label || '').toString().slice(0, 64);
  const expiresAt = req.body?.expiresAt || null;

  const db = getDb();
  const created = [];
  for (let i = 0; i < count; i += 1) {
    let code;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      code = generateInviteCode();
      const exists = db.prepare('SELECT 1 FROM invite_codes WHERE code = ?').get(code);
      if (!exists) break;
      code = null;
    }
    if (!code) return res.status(500).json({ error: '生成邀请码失败（冲突）' });
    db.prepare(
      'INSERT INTO invite_codes (code, label, max_uses, expires_at) VALUES (?, ?, ?, ?)',
    ).run(code, label || null, maxUses, expiresAt);
    created.push(code);
  }
  res.json({ ok: true, codes: created, maxUses, label, expiresAt });
});

/**
 * 撤销邀请码
 * POST /api/admin/invites/:code/revoke
 */
router.post('/invites/:code/revoke', (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const db = getDb();
  const r = db.prepare('UPDATE invite_codes SET revoked = 1 WHERE code = ?').run(code);
  if (r.changes === 0) return res.status(404).json({ error: '邀请码不存在' });
  res.json({ ok: true });
});

export default router;
