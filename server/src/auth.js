import crypto from 'node:crypto';
import { getDb } from './db.js';
import { config } from './config.js';

const TOKEN_BYTES = 32;

export function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

export function generateInviteCode(length = config.invite.codeLength) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆字符
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getTokenTtlMs() {
  return config.invite.tokenTtlDays * 24 * 60 * 60 * 1000;
}

export function getTokenExpiryIso() {
  return new Date(Date.now() + getTokenTtlMs()).toISOString();
}

/**
 * 验证并解析 Bearer token
 * 成功时返回 { userId, displayName }，失败抛异常
 */
export function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return res.status(401).json({ error: '未提供 Authorization 头' });
  }
  const token = match[1].trim();
  if (!token || token.length < 16) {
    return res.status(401).json({ error: 'Token 无效' });
  }

  const db = getDb();
  // 数据库只存 token 的 hash，避免数据库泄露时 token 可直接使用
  const tokenHash = hashToken(token);
  const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(tokenHash);
  if (!session) {
    return res.status(401).json({ error: 'Token 不存在或已失效' });
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    return res.status(401).json({ error: 'Token 已过期，请重新输入邀请码' });
  }

  const user = db
    .prepare('SELECT id, display_name, role, status FROM users WHERE id = ?')
    .get(session.user_id);
  if (!user) {
    return res.status(401).json({ error: '用户不存在' });
  }
  if (user.status === 'disabled') {
    return res.status(403).json({ error: '账号已被管理员禁用，请联系管理员' });
  }

  // 更新 last_seen_at
  db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(user.id);

  req.auth = { token, userId: user.id, displayName: user.display_name, role: user.role };
  return next();
}

/**
 * 要求管理员角色（需在 requireAuth 之后调用）
 */
export function requireAdmin(req, res, next) {
  if (!req.auth || req.auth.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  return next();
}
