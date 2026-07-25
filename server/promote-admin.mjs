import { getDb } from './src/db.js';
import bcrypt from 'bcryptjs';

const db = getDb();
const total = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
const admins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin'").get().c;
console.log(`total=${total} admins=${admins}`);

const first = db.prepare('SELECT id, display_name, role, status, password_hash IS NOT NULL AS has_pw FROM users ORDER BY created_at LIMIT 3').all();
console.log('first 3:', JSON.stringify(first, null, 2));

if (admins === 0 && total > 0) {
  // 提升最早的用户为 admin
  const earliest = db.prepare('SELECT id, display_name FROM users ORDER BY created_at LIMIT 1').get();
  if (earliest) {
    db.prepare("UPDATE users SET role='admin' WHERE id=?").run(earliest.id);
    console.log(`✓ 提升 ${earliest.display_name} (${earliest.id}) 为 admin`);
    const has = db.prepare('SELECT password_hash FROM users WHERE id=?').get(earliest.id);
    if (!has.password_hash) {
      const hash = bcrypt.hashSync('admin12345', 10);
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, earliest.id);
      console.log(`✓ 已为 ${earliest.display_name} 设置初始密码: admin12345`);
    }
  }
}

const after = db.prepare("SELECT id, display_name, role, status, password_hash IS NOT NULL AS has_pw FROM users WHERE role='admin'").all();
console.log('admins after:', JSON.stringify(after, null, 2));

db.close();
process.exit(0);