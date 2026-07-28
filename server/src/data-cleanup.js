import { isExactExampleInput } from '../../src/services/resumeDraft.js';
import { normalizePositionUrl } from './position-url.js';

function asTimestamp(value) {
  const time = Date.parse(String(value || '').replace(' ', 'T') + 'Z');
  return Number.isFinite(time) ? time : 0;
}

export function buildCleanupPlan(db, exampleInput) {
  const positions = db
    .prepare(
      `SELECT p.id, p.user_id, p.url, p.updated_at,
              (SELECT COUNT(*) FROM resumes r WHERE r.position_id = p.id) AS linked_count
       FROM positions p`,
    )
    .all();
  const groups = new Map();
  for (const position of positions) {
    const normalizedUrl = normalizePositionUrl(position.url);
    if (!normalizedUrl) continue;
    const key = `${position.user_id}\n${normalizedUrl}`;
    const group = groups.get(key) || [];
    group.push(position);
    groups.set(key, group);
  }

  const duplicatePositionIds = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ranked = [...group].sort((a, b) => {
      const linkedDifference = Number(b.linked_count || 0) - Number(a.linked_count || 0);
      if (linkedDifference) return linkedDifference;
      return asTimestamp(b.updated_at) - asTimestamp(a.updated_at);
    });
    const retainedId = ranked[0].id;
    for (const position of ranked) {
      if (position.id !== retainedId && Number(position.linked_count || 0) === 0) {
        duplicatePositionIds.push(position.id);
      }
    }
  }

  const exactExampleResumeIds = [];
  const resumes = db.prepare('SELECT id, input_json FROM resumes WHERE input_json IS NOT NULL').all();
  for (const resume of resumes) {
    try {
      const input = JSON.parse(resume.input_json);
      if (isExactExampleInput(input, exampleInput)) exactExampleResumeIds.push(resume.id);
    } catch {
      // Invalid JSON is reported by the audit but never selected for cleanup.
    }
  }

  return { duplicatePositionIds, exactExampleResumeIds };
}

export function applyCleanupPlan(db, plan, exampleInput) {
  let deletedPositions = 0;
  let deletedResumes = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    const positionLinked = db.prepare(
      'SELECT COUNT(*) AS n FROM resumes WHERE position_id = ?',
    );
    const deletePosition = db.prepare('DELETE FROM positions WHERE id = ?');
    for (const id of plan.duplicatePositionIds || []) {
      if (Number(positionLinked.get(id)?.n || 0) !== 0) continue;
      deletedPositions += Number(deletePosition.run(id).changes || 0);
    }

    const getResume = db.prepare('SELECT input_json FROM resumes WHERE id = ?');
    const deleteResume = db.prepare('DELETE FROM resumes WHERE id = ?');
    for (const id of plan.exactExampleResumeIds || []) {
      const row = getResume.get(id);
      if (!row?.input_json) continue;
      let input;
      try {
        input = JSON.parse(row.input_json);
      } catch {
        continue;
      }
      if (!isExactExampleInput(input, exampleInput)) continue;
      deletedResumes += Number(deleteResume.run(id).changes || 0);
    }

    const remainingPositions = db
      .prepare('SELECT id, user_id, url FROM positions WHERE trim(url) <> ?')
      .all('');
    const normalizedGroups = new Map();
    for (const position of remainingPositions) {
      const normalizedUrl = normalizePositionUrl(position.url);
      if (!normalizedUrl) continue;
      const key = `${position.user_id}\n${normalizedUrl}`;
      const group = normalizedGroups.get(key) || [];
      group.push({ ...position, normalizedUrl });
      normalizedGroups.set(key, group);
    }
    const updateUrl = db.prepare('UPDATE positions SET url = ? WHERE id = ?');
    for (const group of normalizedGroups.values()) {
      if (group.length !== 1) continue;
      const position = group[0];
      if (position.url !== position.normalizedUrl) {
        updateUrl.run(position.normalizedUrl, position.id);
      }
    }

    db.exec('COMMIT');
    return { deletedPositions, deletedResumes };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
