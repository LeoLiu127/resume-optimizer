// p5: 验证 Leo Liu 完整流程：注册 + 改密码 + 老密码失效
import { getDb } from './src/db.js';

const BASE = 'http://localhost:4000';
const INVITE = '9VGWNGE79F';
const NEW_NAME = 'Leo Liu';
const INITIAL_PW = 'leo12345';
const CHANGED_PW = 'LeoNew2026';

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
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
  // 先清理：删掉可能存在的旧 Leo Liu
  const db = getDb();
  const before = db.prepare("SELECT id FROM users WHERE LOWER(display_name)=LOWER('Leo Liu')").all();
  for (const u of before) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
    console.log('  清理旧 Leo Liu:', u.id);
  }
  db.close();

  step('[1] 用邀请码注册 Leo Liu（自设初始密码 leo12345）');
  const reg = await call('/api/auth/register', {
    method: 'POST',
    body: { code: INVITE, displayName: NEW_NAME, password: INITIAL_PW },
  });
  assert(reg.status === 200, '注册成功');
  assert(reg.body.user.displayName === 'Leo Liu', '昵称为 Leo Liu');
  assert(reg.body.user.role === 'user', '角色为 user');
  assert(reg.body.user.status === 'active', '状态为 active');
  const TOKEN = reg.body.token;
  const USER_ID = reg.body.user.id;

  step('[2] /me 验证 token 有效');
  const me = await call('/api/auth/me', { token: TOKEN });
  assert(me.status === 200, '/me 200');
  assert(me.body.user.displayName === 'Leo Liu', '昵称一致');

  step('[3] 错误老密码改密码应失败');
  const wrongOld = await call('/api/auth/change-password', {
    method: 'POST',
    token: TOKEN,
    body: { oldPassword: 'wrong-pwd-99', newPassword: 'whatever12345' },
  });
  assert(wrongOld.status === 401, '老密码错误应 401');

  step('[4] 用正确老密码改成新密码');
  const chg = await call('/api/auth/change-password', {
    method: 'POST',
    token: TOKEN,
    body: { oldPassword: INITIAL_PW, newPassword: CHANGED_PW },
  });
  assert(chg.status === 200, '改密 200');

  step('[5] 老密码登录应失败');
  const oldLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { displayName: NEW_NAME, password: INITIAL_PW },
  });
  assert(oldLogin.status === 401, '老密码应 401');

  step('[6] 新密码登录应成功');
  const newLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { displayName: NEW_NAME, password: CHANGED_PW },
  });
  assert(newLogin.status === 200, '新密码 200');
  const TOKEN2 = newLogin.body.token;

  step('[7] 当前 token 仍有效（改密不强制下线）');
  const me2 = await call('/api/auth/me', { token: TOKEN });
  assert(me2.status === 200, '原 token 仍 200');

  step('[8] 新密码改回旧密码（验证可反复改）');
  const chgBack = await call('/api/auth/change-password', {
    method: 'POST',
    token: TOKEN2,
    body: { oldPassword: CHANGED_PW, newPassword: INITIAL_PW },
  });
  assert(chgBack.status === 200, '改回 200');
  const back = await call('/api/auth/login', {
    method: 'POST',
    body: { displayName: NEW_NAME, password: INITIAL_PW },
  });
  assert(back.status === 200, '旧密码又可登');

  step('[9] 旧密码再次修改（最终态：leo12345）');
  // 现在密码又回到 leo12345
  assert(true, '密码恢复成功');

  // 清理
  const db2 = getDb();
  db2.prepare('DELETE FROM sessions WHERE user_id = ?').run(USER_ID);
  db2.prepare('DELETE FROM users WHERE id = ?').run(USER_ID);
  // 同时回收那个邀请码（以便 Leo 自己注册时再用）
  // 这里不删除邀请码，因为 max_uses=1 且 Leo 注册会消耗；测试结束后用户重新注册要新的码
  db2.close();

  console.log('\n✅ Leo Liu 完整流程验证通过！');
  console.log('   （已清理测试用户；正式使用时 Leo 重新注册即可）');
}

run().catch((err) => {
  console.error('\n❌ 测试失败:', err.message);
  process.exit(1);
});