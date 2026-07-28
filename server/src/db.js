import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

/**
 * 使用 Node 24 内置 node:sqlite（替代 better-sqlite3，免编译）
 */

let db = null;

export function getDb() {
  if (db) return db;
  mkdirSync(dirname(config.paths.dbFile), { recursive: true });
  const fresh = !existsSync(config.paths.dbFile);
  db = new DatabaseSync(config.paths.dbFile);
  // WAL 模式对 node:sqlite 不一定可用，简化使用
  db.exec('PRAGMA foreign_keys = ON');
  initSchema(db);
  if (fresh) {
    console.log(`[db] 已创建新数据库：${config.paths.dbFile}`);
  } else {
    console.log(`[db] 已连接数据库：${config.paths.dbFile}`);
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT,
      revoked INTEGER NOT NULL DEFAULT 0,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_name ON users(display_name);

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      invite_code_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (invite_code_id) REFERENCES invite_codes(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      target_role TEXT,
      content TEXT NOT NULL,
      input_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      resume_id TEXT,
      target_json TEXT,
      jd TEXT,
      extras TEXT,
      result_json TEXT NOT NULL,
      variant TEXT NOT NULL DEFAULT 'balanced',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS followup_bullets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ask_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      bullet TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bullets_user ON followup_bullets(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT,
      url TEXT,
      source_site TEXT,
      jd_content TEXT,
      target_industry TEXT,
      target_company_type TEXT,
      job_stage TEXT,
      highlight_skills TEXT,
      extras TEXT,
      status TEXT NOT NULL DEFAULT 'preparing',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id, updated_at DESC);
  `);
  applyMigrations(database);
}

/**
 * 轻量迁移：给已存在的表补充新列
 */
function applyMigrations(database) {
  // users 表迁移
  const cols = database.prepare('PRAGMA table_info(users)').all();
  const colNames = new Set(cols.map((c) => c.name));
  const alters = [];
  if (!colNames.has('password_hash')) alters.push('ALTER TABLE users ADD COLUMN password_hash TEXT');
  if (!colNames.has('role')) alters.push("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  if (!colNames.has('status')) alters.push("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");

  // resumes 表迁移：新增 position_id 关联岗位
  const resumeCols = database.prepare('PRAGMA table_info(resumes)').all();
  const resumeColNames = new Set(resumeCols.map((c) => c.name));
  if (!resumeColNames.has('position_id')) {
    alters.push('ALTER TABLE resumes ADD COLUMN position_id TEXT REFERENCES positions(id) ON DELETE SET NULL');
  }

  for (const sql of alters) {
    try {
      database.exec(sql);
      console.log(`[db] 迁移：${sql}`);
    } catch (err) {
      // 列已存在则忽略
    }
  }

  try {
    database.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_user_url_unique
       ON positions(user_id, url)
       WHERE trim(url) <> ''`,
    );
  } catch (err) {
    console.warn('[db] 岗位 URL 唯一索引暂未创建，请先清理旧重复岗位：', err.message);
  }
}

export function closeDb() {
  if (db) {
    try {
      db.close();
    } catch (err) {
      // ignore
    }
    db = null;
  }
}
