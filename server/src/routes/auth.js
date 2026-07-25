import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { config } from '../config.js';
import {
  generateToken,
  hashToken,
  getTokenExpiryIso,
  requireAuth,
} from '../auth.js';

const router = Router();

const PASSWORD_MIN = 8;

/**
 * 校验密码强度
 */
function isValidPassword(pwd) {
  return typeof pwd === 'string' && pwd.length >= PASSWORD_MIN;
}

/**
 * 创建 session 并返回登录响应
 */
function createSessionAndRespond(userId, res, inviteCodeId = null) {
  const db = getDb();
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = getTokenExpiryIso();
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, invite_code_id, expires_at) VALUES (?, ?, ?, ?)',
  ).run(tokenHash, userId, inviteCodeId, expiresAt);

  const user = db
    .prepare('SELECT id, display_name, role, status FROM users WHERE id = ?')
    .get(userId);

  return res.json({
    token,
    user: {
      id: user.id,
      displayName: user.display_name,
      role: user.role,
      status: user.status,
    },
    expiresAt,
    config: {
      tokenTtlDays: config.invite.tokenTtlDays,
    },
  });
}

/**
 * 注册：邀请码 + 昵称 + 密码
 * POST /api/auth/register
 * body: { code, displayName, password }
 * - 邀请码合法、未撤销、未用完、未过期
 * - 昵称不能与已有用户重复
 * - 密码 ≥ 8 位
 * - 第一个注册成功的用户自动成为 admin
 */
function handleRegister(req, res) {
  const { code, displayName, password } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: '请提供邀请码' });
  }
  if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
    return res.status(400).json({ error: '请填写昵称' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: `密码至少 ${PASSWORD_MIN} 位` });
  }

  const cleanCode = code.trim().toUpperCase();
  const cleanName = displayName.trim().slice(0, 32);
  const db = getDb();

  const invite = db
    .prepare(
      'SELECT id, code, label, revoked, max_uses, used_count, expires_at FROM invite_codes WHERE code = ?',
    )
    .get(cleanCode);
  if (!invite) return res.status(404).json({ error: '邀请码不存在' });
  if (invite.revoked) return res.status(403).json({ error: '邀请码已被撤销' });
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return res.status(403).json({ error: '邀请码已过期' });
  }
  if (invite.used_count >= invite.max_uses) {
    return res.status(403).json({ error: '邀请码已被用完' });
  }

  // 昵称唯一性（不区分大小写）
  const existingName = db
    .prepare('SELECT id FROM users WHERE LOWER(display_name) = LOWER(?)')
    .get(cleanName);
  if (existingName) {
    return res.status(409).json({ error: '昵称已被占用，请换一个' });
  }

  // 第一个用户自动 admin
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const role = userCount === 0 ? 'admin' : 'user';

  const userId = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);

  const tx = () => {
    db.exec('BEGIN');
    try {
      db.prepare(
        'INSERT INTO users (id, display_name, password_hash, role) VALUES (?, ?, ?, ?)',
      ).run(userId, cleanName, passwordHash, role);
      db.prepare(
        'UPDATE invite_codes SET used_count = used_count + 1 WHERE id = ?',
      ).run(invite.id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
  try {
    tx();
  } catch (err) {
    return res.status(500).json({ error: '注册失败：' + (err.message || '未知错误') });
  }

  return createSessionAndRespond(userId, res, invite.id);
}

router.post('/register', handleRegister);

/**
 * 登录：昵称 + 密码
 * POST /api/auth/login
 * body: { displayName, password }
 */
router.post('/login', (req, res) => {
  const { displayName, password } = req.body || {};
  if (!displayName || !password) {
    return res.status(400).json({ error: '请填写昵称和密码' });
  }
  const db = getDb();
  const user = db
    .prepare('SELECT id, display_name, password_hash, role, status FROM users WHERE LOWER(display_name) = LOWER(?)')
    .get(displayName.trim());
  if (!user) {
    return res.status(401).json({ error: '昵称或密码错误' });
  }
  if (!user.password_hash) {
    return res.status(401).json({ error: '该账号未设置密码，请联系管理员' });
  }
  if (user.status === 'disabled') {
    return res.status(403).json({ error: '账号已被管理员禁用，请联系管理员' });
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '昵称或密码错误' });
  }
  return createSessionAndRespond(user.id, res);
});

/**
 * 当前会话信息
 * GET /api/auth/me
 */
router.get('/me', requireAuth, (req, res) => {
  const db = getDb();
  const user = db
    .prepare(
      'SELECT id, display_name, role, status, created_at, last_seen_at FROM users WHERE id = ?',
    )
    .get(req.auth.userId);
  res.json({
    user: {
      id: user.id,
      displayName: user.display_name,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
      lastSeenAt: user.last_seen_at,
    },
    config: {
      tokenTtlDays: config.invite.tokenTtlDays,
    },
  });
});

/**
 * 登出：撤销当前 token
 * POST /api/auth/logout
 */
router.post('/logout', requireAuth, (req, res) => {
  const db = getDb();
  const tokenHash = hashToken(req.auth.token);
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  res.json({ ok: true });
});

/**
 * 修改自己的密码（需先登录，验证老密码）
 * POST /api/auth/change-password
 * body: { oldPassword, newPassword }
 */
router.post('/change-password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ error: `新密码至少 ${PASSWORD_MIN} 位` });
  }
  if (!oldPassword || typeof oldPassword !== 'string') {
    return res.status(400).json({ error: '请输入当前密码' });
  }
  if (oldPassword === newPassword) {
    return res.status(400).json({ error: '新密码不能与当前密码相同' });
  }
  const db = getDb();
  const user = db
    .prepare('SELECT password_hash, status FROM users WHERE id = ?')
    .get(req.auth.userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.status === 'disabled') {
    return res.status(403).json({ error: '账号已被禁用，不能修改密码' });
  }
  if (!user.password_hash || !bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(401).json({ error: '当前密码错误' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.auth.userId);
  res.json({ ok: true });
});

/**
 * 服务端运行时配置（前端可读，用于显示提示）
 * GET /api/auth/bootstrap
 */
router.get('/bootstrap', (req, res) => {
  const db = getDb();
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  res.json({
    inviteOnly: config.invite.inviteOnly,
    minimaxConfigured:
      Boolean(config.minimax.apiKey) && !/^请替换|^eyJhbGciOi\.\.\./.test(config.minimax.apiKey),
    hasUsers: userCount > 0,
  });
});

/**
 * 兼容旧路径：/api/auth/redeem
 * - 如果传了 password，直接走注册逻辑
 * - 如果只传 code，走老逻辑（创建无密码账号）以保持向后兼容
 */
router.post('/redeem', (req, res) => {
  const { code, displayName, password } = req.body || {};
  if (password) {
    // 调用 /register 同一个 handler：手动复用逻辑
    req.body = { code, displayName, password };
    return handleRegister(req, res);
  }
  if (!code) return res.status(400).json({ error: '请提供邀请码' });
  const cleanCode = String(code).trim().toUpperCase();
  const db = getDb();
  const invite = db
    .prepare(
      'SELECT id, code, label, revoked, max_uses, used_count, expires_at FROM invite_codes WHERE code = ?',
    )
    .get(cleanCode);
  if (!invite) return res.status(404).json({ error: '邀请码不存在' });
  if (invite.revoked) return res.status(403).json({ error: '邀请码已被撤销' });
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return res.status(403).json({ error: '邀请码已过期' });
  }
  if (invite.used_count >= invite.max_uses) {
    return res.status(403).json({ error: '邀请码已被用完' });
  }
  const userId = crypto.randomUUID();
  const safeName = (displayName || `用户-${cleanCode.slice(0, 4)}`).toString().slice(0, 32);
  // 昵称唯一性检查（与 /register 保持一致）
  const existingName = db
    .prepare('SELECT id FROM users WHERE LOWER(display_name) = LOWER(?)')
    .get(safeName);
  if (existingName) {
    return res.status(409).json({ error: '昵称已被占用，请换一个' });
  }
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const role = userCount === 0 ? 'admin' : 'user';
  db.prepare(
    'INSERT INTO users (id, display_name, role) VALUES (?, ?, ?)',
  ).run(userId, safeName, role);
  db.prepare('UPDATE invite_codes SET used_count = used_count + 1 WHERE id = ?').run(invite.id);
  return createSessionAndRespond(userId, res, invite.id);
});

export default router;
