#!/usr/bin/env node
/**
 * 邀请码管理 CLI
 *
 * 用法：
 *   node src/admin.js create [label] [maxUses]
 *   node src/admin.js list
 *   node src/admin.js revoke <code>
 *   node src/admin.js delete <code>
 *   node src/admin.js seed     # 首次启动生成 5 个默认邀请码
 */
import { getDb, closeDb } from './db.js';
import { generateInviteCode } from './auth.js';

const HELP = `
邀请码管理 CLI

用法:
  node src/admin.js create [label] [maxUses=1]   新建一个邀请码
  node src/admin.js list                          列出所有邀请码
  node src/admin.js revoke <code>                 撤销（停用）一个邀请码
  node src/admin.js unrevoke <code>               恢复一个被撤销的邀请码
  node src/admin.js delete <code>                 物理删除一个邀请码
  node src/admin.js seed [count=5]                批量生成（首次启动推荐）
`;

const [, , cmd, ...args] = process.argv;

function getFlag(flag, fallback) {
  const i = args.indexOf(flag);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return fallback;
}

function printTable(rows) {
  if (!rows.length) {
    console.log('（无数据）');
    return;
  }
  const headers = ['ID', 'CODE', 'LABEL', 'USED/MAX', 'REVOKED', 'CREATED'];
  const widths = [4, 14, 20, 10, 8, 20];
  const fmt = (cell, i) => String(cell ?? '').padEnd(widths[i]).slice(0, widths[i]);
  console.log(headers.map(fmt).join(' | '));
  console.log(widths.map((w) => '-'.repeat(w)).join('-+-'));
  for (const r of rows) {
    console.log(
      [
        fmt(r.id, 0),
        fmt(r.code, 1),
        fmt(r.label || '-', 2),
        fmt(`${r.used_count}/${r.max_uses}`, 3),
        fmt(r.revoked ? 'YES' : 'no', 4),
        fmt(r.created_at, 5),
      ].join(' | '),
    );
  }
}

function main() {
  const db = getDb();
  switch (cmd) {
    case 'create': {
      // 兼容两种用法：
      //   node src/admin.js create [label] [maxUses]
      //   node src/admin.js create --label "描述" [--max 3]
      const label = getFlag('--label', args[0] || '') || '';
      const maxUsesStr = getFlag('--max', args[1] || '1');
      const maxUses = Math.max(1, Number.parseInt(maxUsesStr, 10) || 1);
      const code = generateInviteCode();
      const info = db
        .prepare('INSERT INTO invite_codes (code, label, max_uses) VALUES (?, ?, ?)')
        .run(code, label, maxUses);
      console.log('✓ 已创建邀请码:');
      console.log(`  ID:        ${info.lastInsertRowid}`);
      console.log(`  CODE:      ${code}`);
      console.log(`  LABEL:     ${label || '(空)'}`);
      console.log(`  MAX_USES:  ${maxUses}`);
      break;
    }
    case 'seed': {
      const count = Math.max(1, Number.parseInt(args[0] || '5', 10) || 5);
      const codes = [];
      for (let i = 0; i < count; i += 1) {
        const code = generateInviteCode();
        db.prepare('INSERT INTO invite_codes (code, label, max_uses) VALUES (?, ?, ?)').run(code, `seed #${i + 1}`, 1);
        codes.push(code);
      }
      console.log(`✓ 已生成 ${count} 个邀请码：`);
      codes.forEach((c) => console.log('  ' + c));
      break;
    }
    case 'list': {
      const rows = db
        .prepare(
          'SELECT id, code, label, used_count, max_uses, revoked, created_at FROM invite_codes ORDER BY id DESC',
        )
        .all();
      printTable(rows);
      break;
    }
    case 'revoke': {
      const code = (args[0] || '').toUpperCase();
      if (!code) {
        console.error('请提供邀请码');
        process.exit(1);
      }
      const info = db.prepare('UPDATE invite_codes SET revoked = 1 WHERE code = ?').run(code);
      if (info.changes === 0) {
        console.error(`未找到邀请码：${code}`);
        process.exit(1);
      }
      console.log(`✓ 已撤销：${code}`);
      break;
    }
    case 'unrevoke': {
      const code = (args[0] || '').toUpperCase();
      if (!code) {
        console.error('请提供邀请码');
        process.exit(1);
      }
      const info = db.prepare('UPDATE invite_codes SET revoked = 0 WHERE code = ?').run(code);
      if (info.changes === 0) {
        console.error(`未找到邀请码：${code}`);
        process.exit(1);
      }
      console.log(`✓ 已恢复：${code}`);
      break;
    }
    case 'delete': {
      const code = (args[0] || '').toUpperCase();
      if (!code) {
        console.error('请提供邀请码');
        process.exit(1);
      }
      const info = db.prepare('DELETE FROM invite_codes WHERE code = ?').run(code);
      if (info.changes === 0) {
        console.error(`未找到邀请码：${code}`);
        process.exit(1);
      }
      console.log(`✓ 已删除：${code}`);
      break;
    }
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      console.log(HELP);
      break;
    default:
      console.error(`未知命令：${cmd}`);
      console.log(HELP);
      process.exit(1);
  }
  closeDb();
  // node:sqlite 的写入在 close 后才完成落盘，强制 exit 避免数据丢失
  process.exit(0);
}

main();
