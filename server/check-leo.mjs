import { getDb, closeDb } from './src/db.js';

const db = getDb();
const u = db.prepare("SELECT id FROM users WHERE LOWER(display_name) = LOWER('Leo Liu')").all();
const invite = db.prepare("SELECT code, label, used_count, max_uses FROM invite_codes WHERE label = 'Leo Liu'").all();
console.log('Leo Liu 用户:', JSON.stringify(u));
console.log('Leo 邀请码:', JSON.stringify(invite));
closeDb();