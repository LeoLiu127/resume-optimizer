import { getDb, closeDb } from './src/db.js';
import crypto from 'node:crypto';

const db = getDb();

// 1) 清理测试遗留的 Leo Liu
const before = db.prepare("SELECT id FROM users WHERE LOWER(display_name) = LOWER('Leo Liu')").all();
for (const u of before) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  console.log('已清理旧 Leo Liu:', u.id);
}

// 2) 清理 Leo Liu 旧邀请码（已经 used_count=1，留着没意义）
const oldInvites = db.prepare("SELECT code FROM invite_codes WHERE label = 'Leo Liu'").all();
for (const inv of oldInvites) {
  db.prepare('DELETE FROM invite_codes WHERE code = ?').run(inv.code);
  console.log('已删除旧邀请码:', inv.code);
}

// 3) 重新生成一个 Leo Liu 专属邀请码
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateInviteCode(length = 10) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return out;
}

let code;
for (let i = 0; i < 5; i += 1) {
  code = generateInviteCode();
  const exists = db.prepare('SELECT 1 FROM invite_codes WHERE code = ?').get(code);
  if (!exists) break;
}

db.prepare(
  'INSERT INTO invite_codes (code, label, max_uses) VALUES (?, ?, ?)',
).run(code, 'Leo Liu', 1);

console.log('\n=== 已为 Leo Liu 生成新的专属邀请码 ===');
console.log('  CODE:   ' + code);
console.log('  LABEL:  Leo Liu');
console.log('  USES:   1');

closeDb();