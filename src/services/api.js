/**
 * 后端 API 客户端
 *
 * 统一管理 token、调用 /api/* 端点。
 * Token 存于 localStorage（关闭浏览器不丢失，过期由后端拒绝）。
 *
 * 旧版"前端直调 MiniMax"已被废弃，API Key 全部移交到后端 .env。
 */

const TOKEN_KEY = 'resume.token';
const USER_KEY = 'resume.user';

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function setToken(token, user) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  setToken('', null);
}

export function notifyUnauthorized(windowLike = globalThis.window) {
  if (!windowLike?.dispatchEvent) return;
  const EventCtor = windowLike.CustomEvent || globalThis.CustomEvent;
  const detail = { reason: 'unauthorized' };
  const event = EventCtor
    ? new EventCtor('resume:logout', { detail })
    : { type: 'resume:logout', detail };
  windowLike.dispatchEvent(event);
}

export function isAuthed() {
  return Boolean(getToken());
}

const API_BASE =
  import.meta.env?.VITE_API_BASE ||
  (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:4000` : 'http://localhost:4000');

async function request(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (!token) {
      const err = new Error('未登录，请先输入邀请码');
      err.code = 'UNAUTHED';
      throw err;
    }
    headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    const e = new Error(`后端连接失败：${err.message || err}（API: ${API_BASE}）`);
    e.code = 'NETWORK';
    throw e;
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 非 JSON 响应 */
  }
  if (!res.ok) {
    const message = (data && data.error) || `请求失败 (${res.status})`;
    const err = new Error(message);
    err.code = res.status === 401 ? 'UNAUTHED' : 'API';
    err.status = res.status;
    // 401 自动清登录态
    if (err.code === 'UNAUTHED') {
      clearAuth();
      notifyUnauthorized();
    }
    throw err;
  }
  return data;
}

/* ============ 认证 ============ */

export const auth = {
  bootstrap() {
    return request('/api/auth/bootstrap', { auth: false });
  },
  async register({ code, displayName, password }) {
    const data = await request('/api/auth/register', {
      method: 'POST',
      body: { code, displayName, password },
      auth: false,
    });
    setToken(data.token, data.user);
    return data;
  },
  async login({ displayName, password }) {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: { displayName, password },
      auth: false,
    });
    setToken(data.token, data.user);
    return data;
  },
  async redeem(code, displayName) {
    const data = await request('/api/auth/redeem', {
      method: 'POST',
      body: { code, displayName },
      auth: false,
    });
    setToken(data.token, data.user);
    return data;
  },
  me() {
    return request('/api/auth/me');
  },
  async logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    clearAuth();
  },
  async changePassword({ oldPassword, newPassword }) {
    return request('/api/auth/change-password', {
      method: 'POST',
      body: { oldPassword, newPassword },
    });
  },
};

/* ============ 简历库 ============ */

export const resumes = {
  list(positionId) {
    const q = positionId ? `?position_id=${encodeURIComponent(positionId)}` : '';
    return request(`/api/resumes${q}`);
  },
  get(id) {
    return request(`/api/resumes/${encodeURIComponent(id)}`);
  },
  create(payload) {
    return request('/api/resumes', { method: 'POST', body: payload });
  },
  update(id, payload) {
    return request(`/api/resumes/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
  },
  remove(id) {
    return request(`/api/resumes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

/* ============ 目标岗位 ============ */

export const positions = {
  list() {
    return request('/api/positions');
  },
  get(id) {
    return request(`/api/positions/${encodeURIComponent(id)}`);
  },
  create(payload) {
    return request('/api/positions', { method: 'POST', body: payload });
  },
  update(id, payload) {
    return request(`/api/positions/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
  },
  remove(id) {
    return request(`/api/positions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  fromInput(input) {
    return request('/api/positions/from-input', { method: 'POST', body: { input } });
  },
};

/* ============ JD 链接提取 ============ */

export const jd = {
  extract(url) {
    return request('/api/jd/extract', { method: 'POST', body: { url } });
  },
  translate({ title, jdContent }) {
    return request('/api/jd/translate', {
      method: 'POST',
      body: { title, jdContent },
    });
  },
  loginAssist(site) {
    return request('/api/jd/login-assist', { method: 'POST', body: { site } });
  },
};

/* ============ 分析结果 / 追问 bullet ============ */

export const analyses = {
  list(resumeId) {
    const q = resumeId ? `?resume_id=${encodeURIComponent(resumeId)}` : '';
    return request(`/api/analyses${q}`);
  },
  create(payload) {
    return request('/api/analyses', { method: 'POST', body: payload });
  },
  listBullets() {
    return request('/api/analyses/bullets');
  },
  saveBullet(payload) {
    return request('/api/analyses/bullets', { method: 'POST', body: payload });
  },
};

/* ============ AI 代理（核心，保护 API Key） ============ */

export const ai = {
  analyze(input, answers) {
    return request('/api/analyze', { method: 'POST', body: { input, answers } });
  },
  followup(input, askItem, userAnswer) {
    return request('/api/analyze/followup', { method: 'POST', body: { input, askItem, userAnswer } });
  },
  rewrite(input, items, style) {
    return request('/api/analyze/rewrite', { method: 'POST', body: { input, items, style } });
  },
  enhance(input, summary) {
    return request('/api/analyze/enhance', { method: 'POST', body: { input, summary } });
  },
  resumeEnglish(finalResume, role) {
    return request('/api/analyze/resume-english', {
      method: 'POST',
      body: { finalResume, role },
    });
  },
};

export const apiConfig = { API_BASE };

/* ============ 管理后台（仅 admin） ============ */

export const admin = {
  listUsers() {
    return request('/api/admin/users');
  },
  getUser(id) {
    return request(`/api/admin/users/${encodeURIComponent(id)}`);
  },
  disableUser(id) {
    return request(`/api/admin/users/${encodeURIComponent(id)}/disable`, { method: 'POST' });
  },
  enableUser(id) {
    return request(`/api/admin/users/${encodeURIComponent(id)}/enable`, { method: 'POST' });
  },
  resetPassword(id, newPassword) {
    return request(`/api/admin/users/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      body: { newPassword },
    });
  },
  revokeSessions(id) {
    return request(`/api/admin/users/${encodeURIComponent(id)}/revoke-sessions`, { method: 'POST' });
  },
  deleteUser(id) {
    return request(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  listInvites() {
    return request('/api/admin/invites');
  },
  createInvites({ count, maxUses, label, expiresAt }) {
    return request('/api/admin/invites', { method: 'POST', body: { count, maxUses, label, expiresAt } });
  },
  revokeInvite(code) {
    return request(`/api/admin/invites/${encodeURIComponent(code)}/revoke`, { method: 'POST' });
  },
};
