import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

import { config } from '../src/config.js';
import {
  applyAccountConsolidation,
  buildAccountConsolidationPlan,
} from '../src/account-consolidation.js';

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, '')
    .replace('T', '-');
}

function tableCount(db, table) {
  return Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
}

const canonicalDisplayName = String(process.argv[2] || 'Leo Liu').trim();
const source = config.paths.dbFile;
if (!existsSync(source)) {
  throw new Error(`数据库不存在：${source}`);
}

const backupDir = join(dirname(source), 'backups');
const backup = join(
  backupDir,
  `app-before-account-consolidation-${timestamp()}.db`,
);
mkdirSync(backupDir, { recursive: true });
copyFileSync(source, backup);
if (statSync(backup).size <= 0) {
  throw new Error(`数据库备份为空：${backup}`);
}

const temporaryPassword = randomBytes(12).toString('base64url');
const passwordHash = bcrypt.hashSync(temporaryPassword, 10);
const db = new DatabaseSync(source);
db.exec('PRAGMA foreign_keys = ON');

try {
  const before = {
    users: tableCount(db, 'users'),
    sessions: tableCount(db, 'sessions'),
    resumes: tableCount(db, 'resumes'),
    positions: tableCount(db, 'positions'),
    analyses: tableCount(db, 'analyses'),
    followupBullets: tableCount(db, 'followup_bullets'),
  };
  const selected = buildAccountConsolidationPlan(db, canonicalDisplayName);
  const result = applyAccountConsolidation(db, {
    canonicalDisplayName,
    passwordHash,
  });
  const canonicalUser = db
    .prepare(
      `SELECT id, display_name, role, status,
              CASE
                WHEN password_hash IS NOT NULL AND trim(password_hash) <> ''
                THEN 1 ELSE 0
              END AS has_password
       FROM users`,
    )
    .get();
  const after = {
    users: tableCount(db, 'users'),
    sessions: tableCount(db, 'sessions'),
    resumes: tableCount(db, 'resumes'),
    positions: tableCount(db, 'positions'),
    analyses: tableCount(db, 'analyses'),
    followupBullets: tableCount(db, 'followup_bullets'),
  };
  const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all();
  const wrongOwnerCounts = Object.fromEntries(
    [
      ['resumes', 'resumes'],
      ['positions', 'positions'],
      ['analyses', 'analyses'],
      ['followupBullets', 'followup_bullets'],
    ].map(([key, table]) => [
      key,
      Number(
        db
          .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id <> ?`)
          .get(result.canonicalUserId).n,
      ),
    ]),
  );

  const preservedTables = ['resumes', 'positions', 'analyses', 'followupBullets'];
  for (const key of preservedTables) {
    if (after[key] !== before[key]) {
      throw new Error(
        `${key} 数量发生变化：迁移前 ${before[key]}，迁移后 ${after[key]}。请从备份恢复`,
      );
    }
  }
  if (
    after.users !== 1 ||
    after.sessions !== 0 ||
    canonicalUser?.id !== result.canonicalUserId ||
    canonicalUser?.role !== 'admin' ||
    canonicalUser?.status !== 'active' ||
    Number(canonicalUser?.has_password || 0) !== 1 ||
    Object.values(wrongOwnerCounts).some((count) => count !== 0) ||
    foreignKeyViolations.length !== 0
  ) {
    throw new Error(`迁移后审计失败，请从备份恢复：${backup}`);
  }

  console.log(
    JSON.stringify(
      {
        backup,
        canonicalDisplayName,
        temporaryPassword,
        before,
        selected,
        result,
        after,
        canonicalUser,
        wrongOwnerCounts,
        foreignKeyViolations: 0,
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
