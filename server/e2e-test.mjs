// 端到端测试 v2：用 Node 原生 fetch
import fs from 'node:fs';

const BASE = 'http://localhost:4000';

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, body: json };
}

function step(title) {
  console.log(`\n===== ${title} =====`);
}

function assert(cond, msg) {
  if (!cond) {
    console.log('  ❌', msg);
    throw new Error(msg);
  }
  console.log('  ✓', msg);
}

async function run() {
  // 1. admin 登录
  step('[1] admin 登录');
  const adminLogin = await call('/api/auth/login', { method: 'POST', body: { displayName: '测试用户', password: 'admin12345' } });
  assert(adminLogin.status === 200, 'admin 登录 200');
  assert(adminLogin.body.user.role === 'admin', '角色为 admin');
  const ADMIN_TOKEN = adminLogin.body.token;

  // 1b. 创建测试用邀请码（自包含，不依赖预置数据）
  step('[1b] 创建测试邀请码');
  const ic = await call('/api/admin/invites', {
    method: 'POST',
    body: { count: 2, maxUses: 1, label: 'e2e-auto' },
    token: ADMIN_TOKEN,
  });
  assert(ic.status === 200, '创建邀请码 200');
  const TEST_CODE = ic.body.codes[0];
  const TEST_CODE2 = ic.body.codes[1];
  console.log('  邀请码:', TEST_CODE, TEST_CODE2);

  // 2. 注册新用户
  step('[2] 注册 e2e2-小李');
  const reg = await call('/api/auth/register', {
    method: 'POST',
    body: { code: TEST_CODE, displayName: 'e2e2-小李', password: 'lizhang12345' },
  });
  assert(reg.status === 200, '注册 200');
  assert(reg.body.user.role === 'user', '新用户角色为 user');
  assert(reg.body.user.status === 'active', '新用户状态为 active');
  const Z_TOKEN = reg.body.token;
  const Z_ID = reg.body.user.id;

  // 3. 重复昵称注册失败
  step('[3] 重复昵称注册');
  const dup = await call('/api/auth/register', {
    method: 'POST',
    body: { code: TEST_CODE2, displayName: 'e2e2-小李', password: 'whatever12345' },
  });
  assert(dup.status === 409, '重复昵称应 409');

  // 4. 错误密码登录失败
  step('[4] 错误密码登录');
  const wrong = await call('/api/auth/login', { method: 'POST', body: { displayName: 'e2e2-小李', password: 'wrong-pwd-12345' } });
  assert(wrong.status === 401, '错误密码应 401');

  // 5. 正确密码登录
  step('[5] 正确密码登录');
  const ok = await call('/api/auth/login', { method: 'POST', body: { displayName: 'e2e2-小李', password: 'lizhang12345' } });
  assert(ok.status === 200, '正确密码 200');

  // 6. /me 正常
  step('[6] 小李 /me');
  const me = await call('/api/auth/me', { token: Z_TOKEN });
  assert(me.status === 200, '/me 200');
  assert(me.body.user.displayName === 'e2e2-小李', '昵称正确');

  // 7. admin 列表用户
  step('[7] admin 列表用户');
  const list = await call('/api/admin/users', { token: ADMIN_TOKEN });
  assert(list.status === 200, '列表 200');
  const z = list.body.users.find((u) => u.id === Z_ID);
  assert(Boolean(z), '小李在列表中');
  assert(z.role === 'user' && z.status === 'active', '角色与状态正确');

  // 8. 普通用户尝试访问 admin 接口（应 403）
  step('[8] 普通用户调 admin 接口');
  const forbid = await call('/api/admin/users', { token: Z_TOKEN });
  assert(forbid.status === 403, '普通用户应 403');

  // 9. admin 禁用小李
  step('[9] admin 禁用小李');
  const dis = await call(`/api/admin/users/${Z_ID}/disable`, { method: 'POST', token: ADMIN_TOKEN });
  assert(dis.status === 200, '禁用 200');

  // 10. 小李 /me 应 403
  step('[10] 小李 /me 被踢出（403）');
  const me2 = await call('/api/auth/me', { token: Z_TOKEN });
  assert(me2.status === 403, '应 403');

  // 11. 小李登录应 403
  step('[11] 小李登录应 403');
  const login2 = await call('/api/auth/login', { method: 'POST', body: { displayName: 'e2e2-小李', password: 'lizhang12345' } });
  assert(login2.status === 403, '被禁用用户登录应 403');

  // 12. admin 启用小李
  step('[12] admin 启用小李');
  const en = await call(`/api/admin/users/${Z_ID}/enable`, { method: 'POST', token: ADMIN_TOKEN });
  assert(en.status === 200, '启用 200');

  // 13. 小李 /me 恢复
  step('[13] 小李 /me 恢复');
  const me3 = await call('/api/auth/me', { token: Z_TOKEN });
  assert(me3.status === 200, '应恢复 200');

  // 14. admin 不能禁用 admin
  step('[14] admin 尝试禁用自己');
  const me_admin = await call('/api/auth/me', { token: ADMIN_TOKEN });
  const self = me_admin.body.user.id;
  const selfDis = await call(`/api/admin/users/${self}/disable`, { method: 'POST', token: ADMIN_TOKEN });
  assert(selfDis.status === 400, '应 400 拒绝');

  // 15. admin 重置小李密码
  step('[15] admin 重置小李密码');
  const rst = await call(`/api/admin/users/${Z_ID}/reset-password`, {
    method: 'POST',
    body: { newPassword: 'newpass12345' },
    token: ADMIN_TOKEN,
  });
  assert(rst.status === 200, '重置 200');

  // 16. 小李旧密码登录失败，新密码成功
  step('[16] 小李旧密码应失败');
  const oldPw = await call('/api/auth/login', { method: 'POST', body: { displayName: 'e2e2-小李', password: 'lizhang12345' } });
  assert(oldPw.status === 401, '旧密码应 401');

  step('[16b] 小李新密码应成功');
  const newPw = await call('/api/auth/login', { method: 'POST', body: { displayName: 'e2e2-小李', password: 'newpass12345' } });
  assert(newPw.status === 200, '新密码 200');
  // 用新登录的 token 替换原 token（强制下线测试用）
  const Z_TOKEN2 = newPw.body.token;

  // 17. admin 撤销小李全部 session（强制下线）
  step('[17] admin 撤销小李全部 session');
  const rev = await call(`/api/admin/users/${Z_ID}/revoke-sessions`, { method: 'POST', token: ADMIN_TOKEN });
  assert(rev.status === 200, '撤销 200');

  // 18. 小李原 token /me 应 401
  step('[18] 小李原 token 应 401');
  const me4 = await call('/api/auth/me', { token: Z_TOKEN2 });
  assert(me4.status === 401, '应 401');

  // 19. admin 删除小李
  step('[19] admin 删除小李');
  const del = await call(`/api/admin/users/${Z_ID}`, { method: 'DELETE', token: ADMIN_TOKEN });
  assert(del.status === 200, '删除 200');

  // 20. 小李新密码登录失败（用户不存在）
  step('[20] 小李再次登录应失败');
  const ghost = await call('/api/auth/login', { method: 'POST', body: { displayName: 'e2e2-小李', password: 'newpass12345' } });
  assert(ghost.status === 401, '应 401');

  // 21. admin 不能删除自己
  step('[21] admin 尝试删除自己');
  const selfDel = await call(`/api/admin/users/${self}`, { method: 'DELETE', token: ADMIN_TOKEN });
  assert(selfDel.status === 400, '应 400 拒绝');

  // 22. admin 创建邀请码
  step('[22] admin 邀请码创建');
  const ic2 = await call('/api/admin/invites', {
    method: 'POST',
    body: { count: 1, maxUses: 1, label: 'e2e-test' },
    token: ADMIN_TOKEN,
  });
  assert(ic2.status === 200, '创建 200');
  assert(Array.isArray(ic2.body.codes) && ic2.body.codes.length === 1, '返回 1 个码');

  console.log('\n✅ 端到端测试全部通过！');
}

run().catch((err) => {
  console.error('\n❌ 测试失败:', err.message);
  process.exit(1);
});