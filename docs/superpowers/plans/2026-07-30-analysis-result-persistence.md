# Analysis Result Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist every successful nine-step analysis and automatically restore the latest result when the logged-in user returns to byte-equivalent normalized resume, JD, and targeting inputs.

**Architecture:** Add a content-only persistence key beside the existing record-aware analysis context key. The authenticated server hashes that key, stores it with each analysis, and exposes a restore endpoint that returns only the current user's latest exact match. The React app saves successful analyses in the background and uses a debounced, sequence-guarded restore flow so navigation and reloads retain results while stale responses and changed inputs cannot overwrite current state.

**Tech Stack:** React 18, Vite 5, Express 4, Node 24 `node:test`, Node `node:sqlite`, authenticated JSON API.

## Global Constraints

- Do not change the nine-step flow, page visual design, analysis result schema, or MiniMax provider.
- Do not add an analysis-history UI, version comparison, renaming, or deletion.
- Do not delete or rewrite existing analysis, resume, position, follow-up, or user data.
- The persistence identity contains target role, industry, company type, job stage, highlighted skills, full JD, full resume text, and extras.
- Normalize only nullish values, CRLF line endings, and field-edge whitespace; internal whitespace remains meaningful.
- User isolation is enforced by the authenticated server query in addition to exact context matching.
- A save or restore failure must never clear the current input or a successfully generated in-memory result.
- Every production change follows red-green-refactor and receives a focused commit.

---

## File Structure

- Modify `src/services/analysisContext.js`: produce a content-only stable persistence key while retaining the existing record-aware answer context key.
- Create `src/services/analysisPersistence.js`: pure payload and restore-race helpers used by `App.jsx`.
- Modify `src/services/api.js`: expose authenticated save and restore client calls.
- Modify `src/hooks/useResumeAnalysis.js`: hydrate a saved result through the existing normalization path.
- Modify `src/App.jsx`: save successful analyses and automatically restore exact matches with debounce and stale-response protection.
- Modify `server/src/db.js`: add backward-compatible analysis persistence columns and index.
- Create `server/src/analysis-context.js`: hash untrusted context strings and map database rows to the API contract.
- Modify `server/src/routes/analyses.js`: validate, save, and restore persisted analyses.
- Modify `server/server.js`: already mounts the analyses router; no routing change should be needed.
- Modify `server/test/analysis-context.test.mjs`: cover content-only key semantics.
- Create `server/test/analysis-persistence.test.mjs`: cover pure frontend persistence helpers.
- Create `server/test/analysis-persistence-api.test.mjs`: cover migration, authenticated save/restore, latest-result ordering, and user isolation.
- Modify `server/test/template-contract.test.mjs`: add source-contract checks for App integration only where React rendering is unavailable.

---

### Task 1: Stable persistence identity and restore guards

**Files:**
- Modify: `src/services/analysisContext.js`
- Create: `src/services/analysisPersistence.js`
- Modify: `server/test/analysis-context.test.mjs`
- Create: `server/test/analysis-persistence.test.mjs`

**Interfaces:**
- Consumes: the eight existing `ANALYSIS_INPUT_KEYS` and `normalizeValue` behavior.
- Produces: `createAnalysisPersistenceKey(input) -> string`.
- Produces: `buildAnalysisPersistencePayload({ input, resumeId, result, variant, engine }) -> object`.
- Produces: `createRestoreTicket(sequence, userId, contextKey) -> object`.
- Produces: `shouldApplyRestore(ticket, current) -> boolean`.

- [ ] **Step 1: Write failing context-key tests**

Append tests proving that record IDs do not affect the persistence key, harmless newline/edge whitespace changes normalize, and every material input field changes the key:

```js
import { createAnalysisPersistenceKey } from '../../src/services/analysisContext.js';

test('analysis persistence identity depends on normalized content rather than record ids', () => {
  const normalized = {
    ...baseInput,
    jd: '  Own the product roadmap.\\r\\n',
    resume: 'Candidate resume\\r\\n',
  };
  const equivalent = {
    ...baseInput,
    jd: 'Own the product roadmap.\\n',
    resume: 'Candidate resume\\n',
  };

  assert.equal(
    createAnalysisPersistenceKey(normalized),
    createAnalysisPersistenceKey(equivalent),
  );
  assert.notEqual(
    createAnalysisContextKey(baseInput, 'resume-1', 'position-1'),
    createAnalysisContextKey(baseInput, 'resume-2', 'position-1'),
  );
});

test('every effective analysis input participates in persistence identity', () => {
  for (const key of Object.keys(baseInput)) {
    assert.notEqual(
      createAnalysisPersistenceKey(baseInput),
      createAnalysisPersistenceKey({ ...baseInput, [key]: `${baseInput[key]} changed` }),
      key,
    );
  }
});
```

- [ ] **Step 2: Run the context tests and verify RED**

Run from `server/`:

```powershell
node --test test/analysis-context.test.mjs
```

Expected: FAIL because `createAnalysisPersistenceKey` is not exported.

- [ ] **Step 3: Implement the minimal content-only key**

Refactor `analysisContext.js` without changing existing behavior:

```js
function serializeAnalysisInput(input) {
  return ANALYSIS_INPUT_KEYS.map((key) => normalizeValue(input?.[key]));
}

export function createAnalysisPersistenceKey(input) {
  return JSON.stringify(serializeAnalysisInput(input));
}

export function createAnalysisContextKey(input, resumeId = '', positionId = '') {
  return JSON.stringify([
    normalizeValue(resumeId),
    normalizeValue(positionId),
    ...serializeAnalysisInput(input),
  ]);
}
```

- [ ] **Step 4: Run the context tests and verify GREEN**

Run:

```powershell
node --test test/analysis-context.test.mjs
```

Expected: all context tests PASS.

- [ ] **Step 5: Write failing payload and restore-guard tests**

Create `analysis-persistence.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnalysisPersistencePayload,
  createRestoreTicket,
  shouldApplyRestore,
} from '../../src/services/analysisPersistence.js';

test('persistence payload keeps result metadata and a content key', () => {
  const input = { targetRole: 'AI PM', jd: 'JD', resume: 'Resume' };
  const result = { summary: { role: 'AI PM' } };
  const payload = buildAnalysisPersistencePayload({
    input,
    resumeId: 'resume-1',
    result,
    variant: 'concise',
    engine: 'minimax-m3',
  });

  assert.equal(payload.resumeId, 'resume-1');
  assert.equal(payload.result, result);
  assert.equal(payload.variant, 'concise');
  assert.equal(payload.engine, 'minimax-m3');
  assert.equal(typeof payload.contextKey, 'string');
  assert.match(payload.contextKey, /AI PM/);
});

test('restore response applies only to the latest user and context ticket', () => {
  const ticket = createRestoreTicket(4, 'user-1', 'context-a');
  assert.equal(shouldApplyRestore(ticket, ticket), true);
  assert.equal(
    shouldApplyRestore(ticket, createRestoreTicket(5, 'user-1', 'context-a')),
    false,
  );
  assert.equal(
    shouldApplyRestore(ticket, createRestoreTicket(4, 'user-2', 'context-a')),
    false,
  );
  assert.equal(
    shouldApplyRestore(ticket, createRestoreTicket(4, 'user-1', 'context-b')),
    false,
  );
});
```

- [ ] **Step 6: Run the persistence helper tests and verify RED**

Run:

```powershell
node --test test/analysis-persistence.test.mjs
```

Expected: FAIL because `src/services/analysisPersistence.js` does not exist.

- [ ] **Step 7: Implement the minimal pure helpers**

Create:

```js
import { createAnalysisPersistenceKey } from './analysisContext.js';

export function buildAnalysisPersistencePayload({
  input,
  resumeId = '',
  result,
  variant = 'balanced',
  engine = '',
}) {
  return {
    resumeId: resumeId || undefined,
    contextKey: createAnalysisPersistenceKey(input),
    target: {
      targetRole: input?.targetRole || '',
      targetIndustry: input?.targetIndustry || '',
      targetCompanyType: input?.targetCompanyType || '',
      jobStage: input?.jobStage || '',
      highlightSkills: input?.highlightSkills || '',
    },
    jd: input?.jd || '',
    extras: input?.extras || '',
    result,
    variant,
    engine,
  };
}

export function createRestoreTicket(sequence, userId, contextKey) {
  return { sequence, userId: String(userId || ''), contextKey: String(contextKey || '') };
}

export function shouldApplyRestore(ticket, current) {
  return Boolean(
    ticket
      && current
      && ticket.sequence === current.sequence
      && ticket.userId === current.userId
      && ticket.contextKey === current.contextKey,
  );
}
```

- [ ] **Step 8: Run both focused suites and verify GREEN**

Run:

```powershell
node --test test/analysis-context.test.mjs test/analysis-persistence.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 9: Commit Task 1**

```powershell
git add src/services/analysisContext.js src/services/analysisPersistence.js server/test/analysis-context.test.mjs server/test/analysis-persistence.test.mjs
git commit -m "feat: define analysis persistence identity"
```

---

### Task 2: Backward-compatible server persistence and restore API

**Files:**
- Modify: `server/src/db.js`
- Create: `server/src/analysis-context.js`
- Modify: `server/src/routes/analyses.js`
- Create: `server/test/analysis-persistence-api.test.mjs`

**Interfaces:**
- Consumes: `contextKey: string`, authenticated `req.auth.userId`, and the existing analysis JSON schema.
- Produces: `hashAnalysisContextKey(contextKey) -> 64-character lowercase SHA-256 string`.
- Produces: `mapPersistedAnalysis(row) -> { id, result, variant, engine, createdAt } | null`.
- Produces: `POST /api/analyses` save contract and `POST /api/analyses/restore` lookup contract.

- [ ] **Step 1: Write the failing API and migration tests**

Create an isolated Express server and temporary SQLite database. Before `getDb()`, pre-create the legacy `analyses` table without `context_hash` or `engine`, then mount `analysisRoutes`:

```js
const legacy = new DatabaseSync(dbFile);
legacy.exec(`
  CREATE TABLE analyses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    resume_id TEXT,
    target_json TEXT,
    jd TEXT,
    extras TEXT,
    result_json TEXT NOT NULL,
    variant TEXT NOT NULL DEFAULT 'balanced',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
legacy.close();

config.paths.dbFile = dbFile;
const db = getDb();
const analysisColumns = new Set(
  db.prepare('PRAGMA table_info(analyses)').all().map((column) => column.name),
);
assert.equal(analysisColumns.has('context_hash'), true);
assert.equal(analysisColumns.has('engine'), true);
```

Use two authenticated users and verify:

```js
test('analysis persistence restores only the current users latest exact context', async () => {
  const contextKey = '["AI PM","","","","","JD","Resume",""]';

  const first = await requestAs(userOneToken, '/api/analyses', {
    method: 'POST',
    body: JSON.stringify({
      contextKey,
      result: { summary: { role: 'old' } },
      variant: 'balanced',
      engine: 'minimax-m3',
    }),
  });
  assert.equal(first.status, 200);

  const second = await requestAs(userOneToken, '/api/analyses', {
    method: 'POST',
    body: JSON.stringify({
      contextKey,
      result: { summary: { role: 'new' } },
      variant: 'concise',
      engine: 'minimax-m3',
    }),
  });
  assert.equal(second.status, 200);

  const restored = await requestAs(userOneToken, '/api/analyses/restore', {
    method: 'POST',
    body: JSON.stringify({ contextKey }),
  });
  assert.equal(restored.body.analysis.result.summary.role, 'new');
  assert.equal(restored.body.analysis.variant, 'concise');

  const otherUser = await requestAs(userTwoToken, '/api/analyses/restore', {
    method: 'POST',
    body: JSON.stringify({ contextKey }),
  });
  assert.equal(otherUser.body.analysis, null);
});

test('analysis restore requires an exact context and rejects missing keys', async () => {
  const missing = await requestAs(userOneToken, '/api/analyses/restore', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assert.equal(missing.status, 400);

  const unmatched = await requestAs(userOneToken, '/api/analyses/restore', {
    method: 'POST',
    body: JSON.stringify({ contextKey: 'different' }),
  });
  assert.equal(unmatched.status, 200);
  assert.equal(unmatched.body.analysis, null);
});
```

- [ ] **Step 2: Run the new API suite and verify RED**

Run:

```powershell
node --test test/analysis-persistence-api.test.mjs
```

Expected: FAIL because migration columns and `/restore` do not exist and save does not require/store `contextKey`.

- [ ] **Step 3: Implement hashing and row mapping**

Create `server/src/analysis-context.js`:

```js
import crypto from 'node:crypto';

export function hashAnalysisContextKey(contextKey) {
  return crypto.createHash('sha256').update(String(contextKey), 'utf8').digest('hex');
}

export function mapPersistedAnalysis(row) {
  if (!row?.result_json) return null;
  try {
    const result = JSON.parse(row.result_json);
    if (!result || typeof result !== 'object') return null;
    return {
      id: row.id,
      result,
      variant: row.variant || 'balanced',
      engine: row.engine || '',
      createdAt: row.created_at,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Add the additive database migration**

Update the fresh schema and `applyMigrations()`:

```js
context_hash TEXT,
engine TEXT NOT NULL DEFAULT '',
```

Then:

```js
const analysisCols = database.prepare('PRAGMA table_info(analyses)').all();
const analysisColNames = new Set(analysisCols.map((column) => column.name));
if (!analysisColNames.has('context_hash')) {
  alters.push('ALTER TABLE analyses ADD COLUMN context_hash TEXT');
}
if (!analysisColNames.has('engine')) {
  alters.push("ALTER TABLE analyses ADD COLUMN engine TEXT NOT NULL DEFAULT ''");
}
```

After running `alters`, create:

```sql
CREATE INDEX IF NOT EXISTS idx_analyses_user_context
ON analyses(user_id, context_hash, created_at DESC)
```

- [ ] **Step 5: Implement save validation and exact restore**

In `routes/analyses.js`, import the hashing and mapping helpers. Define a shared key validator:

```js
function readContextKey(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  return value;
}
```

Place `POST /restore` before the generic `POST /` route:

```js
router.post('/restore', (req, res) => {
  const contextKey = readContextKey(req.body?.contextKey);
  if (!contextKey) return res.status(400).json({ error: 'contextKey 必填' });

  const row = getDb().prepare(
    `SELECT id, result_json, variant, engine, created_at
     FROM analyses
     WHERE user_id = ? AND context_hash = ?
     ORDER BY created_at DESC, rowid DESC
     LIMIT 1`,
  ).get(req.auth.userId, hashAnalysisContextKey(contextKey));

  res.json({ analysis: mapPersistedAnalysis(row) });
});
```

Extend save:

```js
const { resumeId, contextKey, target, jd, extras, result, variant, engine } = req.body || {};
const normalizedContextKey = readContextKey(contextKey);
if (!normalizedContextKey) {
  return res.status(400).json({ error: 'contextKey 必填' });
}
```

Insert `context_hash` and `engine`, using `hashAnalysisContextKey(normalizedContextKey)`.

- [ ] **Step 6: Run the API suite and verify GREEN**

Run:

```powershell
node --test test/analysis-persistence-api.test.mjs
```

Expected: migration, exact match, latest result, missing key, and cross-user isolation tests all PASS.

- [ ] **Step 7: Run all server API-related tests**

Run:

```powershell
node --test test/api-contract.test.mjs test/auth-client-state.test.mjs test/analysis-persistence-api.test.mjs
```

Expected: all tests PASS with no route-contract regression.

- [ ] **Step 8: Commit Task 2**

```powershell
git add server/src/db.js server/src/analysis-context.js server/src/routes/analyses.js server/test/analysis-persistence-api.test.mjs
git commit -m "feat: persist and restore analysis results"
```

---

### Task 3: Frontend API hydration and App lifecycle integration

**Files:**
- Modify: `src/services/api.js`
- Modify: `src/hooks/useResumeAnalysis.js`
- Modify: `src/App.jsx`
- Modify: `server/test/analysis-persistence.test.mjs`
- Modify: `server/test/template-contract.test.mjs`

**Interfaces:**
- Consumes: `analyses.create(payload)` and new `analyses.restore(contextKey)`.
- Consumes: Task 1 payload and restore-ticket helpers.
- Produces: `useResumeAnalysis().restore(savedAnalysis, input) -> normalizedAnalysis | null`.
- Produces: debounced automatic restore and background save in `App`.

- [ ] **Step 1: Write failing normalization and source-contract tests**

Export pure response normalization from `useResumeAnalysis.js` for a real behavior
test:

```js
import {
  normalizeAnalysis,
  normalizeAnalysisResponse,
} from '../../src/hooks/useResumeAnalysis.js';

test('persisted analysis uses the same normalization as a live model response', () => {
  const restored = normalizeAnalysis({
    summary: { role: 'AI PM', fitScore: 82 },
    finalResume: { basic: ['Candidate'] },
  }, 'Candidate');

  assert.equal(restored.summary.role, 'AI PM');
  assert.equal(restored.summary.fitScore, 82);
  assert.equal(restored.finalResume.name, 'Candidate');
});

test('live analysis returns normalized data with the response engine', () => {
  const outcome = normalizeAnalysisResponse({
    engine: 'mock',
    data: {
      summary: { role: 'AI PM', fitScore: 82 },
      finalResume: { basic: ['Candidate'] },
    },
  }, 'Candidate');

  assert.equal(outcome.analysis.summary.role, 'AI PM');
  assert.equal(outcome.engine, 'mock');
});
```

Add focused `template-contract` assertions that `App.jsx`:

```js
assert.match(appSource, /analysesApi\\.create/);
assert.match(appSource, /analysesApi\\.restore/);
assert.match(appSource, /shouldApplyRestore/);
assert.doesNotMatch(
  appSource.match(/const handleStepNav[\\s\\S]*?\\n  };/)?.[0] || '',
  /reset\\(|invalidateAnalysisContext/,
);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --test test/analysis-persistence.test.mjs test/template-contract.test.mjs
```

Expected: FAIL because `normalizeAnalysis` is not exported and App has no persistence integration.

- [ ] **Step 3: Add the restore API client**

Extend `analyses` in `src/services/api.js`:

```js
restore(contextKey) {
  return request('/api/analyses/restore', {
    method: 'POST',
    body: { contextKey },
  });
},
```

- [ ] **Step 4: Add hook hydration through the existing normalizer**

Export `normalizeAnalysis`, add a pure live-response adapter, and hydrate persisted
results through the same normalizer:

```js
export function normalizeAnalysisResponse(response, fallbackName) {
  const analysis = normalizeAnalysis(response?.data, fallbackName);
  if (!analysis) return null;
  return {
    analysis,
    engine: response?.engine || 'minimax-m3',
  };
}

const restore = useCallback((savedAnalysis, input) => {
  const fallbackName = input?.resume?.split('\\n')?.[0]?.slice(0, 12) || '候选人';
  const normalized = normalizeAnalysis(savedAnalysis?.result, fallbackName);
  if (!normalized) return null;
  setData(normalized);
  setEngine(savedAnalysis?.engine || '');
  setError('');
  cacheRef.current = {};
  return normalized;
}, []);
```

Return `restore` from the hook.

Inside `analyze()`, replace direct normalization with:

```js
const outcome = normalizeAnalysisResponse(res, fallbackName);
if (!outcome) throw new Error('后端返回数据为空');
setData(outcome.analysis);
setEngine(outcome.engine);
return outcome;
```

- [ ] **Step 5: Integrate background save**

Import:

```js
import {
  getStoredUser,
  analyses as analysesApi,
  positions as positionsApi,
  jd as jdApi,
} from './services/api';
import { createAnalysisPersistenceKey } from './services/analysisContext';
import {
  buildAnalysisPersistencePayload,
  createRestoreTicket,
  shouldApplyRestore,
} from './services/analysisPersistence';
```

Add `analysisPersistenceWarning` state and, after a successful live result:

```js
setAnalyzedInput({ ...analysisInput });
setAnalysisPersistenceWarning('');
const payload = buildAnalysisPersistencePayload({
  input: analysisInput,
  resumeId: resumes.activeId || '',
  result: outcome.analysis,
  variant,
  engine: outcome.engine,
});
restoreAttemptRef.current = `${currentUser.id}\u0000${payload.contextKey}`;
analysesApi.create(payload).catch((error) => {
  setAnalysisPersistenceWarning(`分析结果暂未保存：${error.message || '未知错误'}`);
});
```

Use the documented outcome returned by `analyze()`:

```js
return { analysis: normalized, engine: res.engine || 'minimax-m3' };
```

Update the single `App.jsx` caller from `result` to `outcome`, set
`analyzedInput` only when `outcome?.analysis` exists, and use `outcome.engine`
for persistence. The pure response-adapter test must fail before this production
change.

- [ ] **Step 6: Integrate guarded automatic restore**

Add refs:

```js
const inputRef = useRef(input);
const currentUserRef = useRef(currentUser);
const restoreSequenceRef = useRef(0);
const restoreAttemptRef = useRef('');
```

Keep the first two synchronized in effects. Add a debounced effect that runs only
after the user and resume draft are restored, skips empty inputs and current/live
analysis, and records one attempt per `userId + contextKey`:

```js
useEffect(() => {
  if (!currentUser?.id || !resumeListLoaded || loading || preparingAnalysis) return undefined;
  if (!input.resume.trim() && !input.jd.trim()) return undefined;
  if (analysisIsCurrent) return undefined;

  const contextKey = createAnalysisPersistenceKey(input);
  const identity = `${currentUser.id}\\u0000${contextKey}`;
  if (restoreAttemptRef.current === identity) return undefined;

  const timer = window.setTimeout(async () => {
    restoreAttemptRef.current = identity;
    const ticket = createRestoreTicket(
      ++restoreSequenceRef.current,
      currentUser.id,
      contextKey,
    );
    const ticketIsCurrent = () => shouldApplyRestore(
      ticket,
      createRestoreTicket(
        restoreSequenceRef.current,
        currentUserRef.current?.id || '',
        createAnalysisPersistenceKey(inputRef.current),
      ),
    );
    try {
      const response = await analysesApi.restore(contextKey);
      if (!ticketIsCurrent() || !response.analysis?.result) return;
      const restored = restore(response.analysis, inputRef.current);
      if (!restored) return;
      setAnalyzedInput({ ...inputRef.current });
      setAnalysisStarted(true);
      setVariant(response.analysis.variant || 'balanced');
      setAnalysisPersistenceWarning('');
    } catch (error) {
      if (ticketIsCurrent()) {
        setAnalysisPersistenceWarning(`历史分析恢复失败：${error.message || '未知错误'}`);
      }
    }
  }, 350);

  return () => window.clearTimeout(timer);
}, [
  analysisIsCurrent,
  currentUser?.id,
  input,
  loading,
  preparingAnalysis,
  resumeListLoaded,
  restore,
]);
```

Increment `restoreSequenceRef.current` and clear `restoreAttemptRef.current` on
logout and before starting a new live analysis. Render the persistence warning
using the existing `note-card` style without changing layout structure.

- [ ] **Step 7: Run focused tests and build**

Run:

```powershell
node --test test/analysis-persistence.test.mjs test/template-contract.test.mjs
cd ..
npm run build
```

Expected: focused tests PASS and Vite production build succeeds.

- [ ] **Step 8: Commit Task 3**

```powershell
git add src/services/api.js src/hooks/useResumeAnalysis.js src/App.jsx server/test/analysis-persistence.test.mjs server/test/template-contract.test.mjs
git commit -m "feat: restore matching analysis in the workspace"
```

---

### Task 4: Full regression and live persistence verification

**Files:**
- Modify only if a failing regression proves a defect in Task 1-3 files.

**Interfaces:**
- Consumes: all persistence APIs and frontend lifecycle behavior from Tasks 1-3.
- Produces: verified build, full test suite, database migration, and running service behavior.

- [ ] **Step 1: Run the complete server test suite**

Run from `server/`:

```powershell
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Run the production frontend build**

Run from repository root:

```powershell
npm run build
```

Expected: Vite build exits `0` without unresolved imports or hook errors.

- [ ] **Step 3: Restart the backend to apply the migration**

Stop only the backend process listening for this project, then start:

```powershell
npm start
```

from `server/` in a hidden background process. Do not expose or print `.env`.

- [ ] **Step 4: Verify health and schema**

Check:

```powershell
Invoke-RestMethod http://127.0.0.1:4000/api/health
```

Expected:

```json
{ "ok": true, "minimaxConfigured": true }
```

Read-only schema query must show `context_hash`, `engine`, and
`idx_analyses_user_context`.

- [ ] **Step 5: Verify authenticated persistence without calling the model**

Using an isolated test user or the automated API suite, save a synthetic result,
restore the exact context, verify a changed context returns `null`, then remove only
the isolated test user/database. Do not insert demonstration records into the live
user database.

- [ ] **Step 6: Inspect Git diff and runtime warnings**

Run:

```powershell
git diff --check
git status --short --branch
```

Expected: only the intentionally untracked `.superpowers/brainstorm/` remains outside
the committed implementation.

- [ ] **Step 7: Final implementation commit if verification required a fix**

Only when Step 1-6 revealed and corrected an implementation defect:

```powershell
git add <exact corrected files>
git commit -m "fix: harden analysis result restoration"
```
