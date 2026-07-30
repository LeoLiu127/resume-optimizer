const OWNED_TABLES = [
  { table: 'resumes', resultKey: 'resumes' },
  { table: 'positions', resultKey: 'positions' },
  { table: 'analyses', resultKey: 'analyses' },
  { table: 'followup_bullets', resultKey: 'followupBullets' },
];

function requireCanonicalName(value) {
  const name = String(value || '').trim();
  if (!name) throw new Error('Canonical display name is required');
  return name;
}

function findPositionUrlConflicts(db) {
  return db
    .prepare(
      `SELECT url, COUNT(*) AS count
       FROM positions
       WHERE trim(COALESCE(url, '')) <> ''
       GROUP BY url
       HAVING COUNT(*) > 1`,
    )
    .all();
}

export function buildAccountConsolidationPlan(db, canonicalDisplayName) {
  const cleanName = requireCanonicalName(canonicalDisplayName);
  const matches = db
    .prepare(
      `SELECT id, display_name
       FROM users
       WHERE LOWER(display_name) = LOWER(?)`,
    )
    .all(cleanName);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one canonical user named "${cleanName}", found ${matches.length}`,
    );
  }

  const canonicalUser = matches[0];
  const positionUrlConflicts = findPositionUrlConflicts(db);
  if (positionUrlConflicts.length) {
    const urls = positionUrlConflicts.map((row) => row.url).join(', ');
    throw new Error(`Position URL conflict prevents account consolidation: ${urls}`);
  }

  const moved = {};
  for (const { table, resultKey } of OWNED_TABLES) {
    moved[resultKey] = Number(
      db
        .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id <> ?`)
        .get(canonicalUser.id).n,
    );
  }

  return {
    canonicalUser,
    deletedUsers: Number(
      db.prepare('SELECT COUNT(*) AS n FROM users WHERE id <> ?').get(canonicalUser.id).n,
    ),
    revokedSessions: Number(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n),
    moved,
  };
}

export function applyAccountConsolidation(
  db,
  { canonicalDisplayName, passwordHash } = {},
) {
  if (!String(passwordHash || '').trim()) {
    throw new Error('Replacement password hash is required');
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const plan = buildAccountConsolidationPlan(db, canonicalDisplayName);
    const canonicalUserId = plan.canonicalUser.id;

    for (const { table } of OWNED_TABLES) {
      db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id <> ?`).run(
        canonicalUserId,
        canonicalUserId,
      );
    }
    db.prepare('DELETE FROM sessions').run();
    db.prepare(
      `UPDATE users
       SET role = 'admin', status = 'active', password_hash = ?
       WHERE id = ?`,
    ).run(passwordHash, canonicalUserId);
    db.prepare('DELETE FROM users WHERE id <> ?').run(canonicalUserId);

    const remainingUsers = Number(
      db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    );
    if (remainingUsers !== 1) {
      throw new Error(`Account consolidation left ${remainingUsers} users`);
    }
    for (const { table } of OWNED_TABLES) {
      const wrongOwnerCount = Number(
        db
          .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id <> ?`)
          .get(canonicalUserId).n,
      );
      if (wrongOwnerCount !== 0) {
        throw new Error(`${table} still contains ${wrongOwnerCount} noncanonical rows`);
      }
    }
    const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all();
    if (foreignKeyViolations.length) {
      throw new Error(
        `Account consolidation created ${foreignKeyViolations.length} foreign-key violations`,
      );
    }

    db.exec('COMMIT');
    return {
      canonicalUserId,
      deletedUsers: plan.deletedUsers,
      revokedSessions: plan.revokedSessions,
      moved: plan.moved,
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
