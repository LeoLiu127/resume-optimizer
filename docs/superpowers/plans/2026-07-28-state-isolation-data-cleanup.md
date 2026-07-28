# State Isolation and Data Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent stale analysis, answers, drafts, and delayed saves from crossing resume/JD/user boundaries, deduplicate future positions, and remove only verified demo residue after a recoverable database backup.

**Architecture:** Extract state decisions and storage coordination from `App.jsx` and hooks into small pure services that can be tested with Node's built-in test runner. Keep the current React UI and API contracts, add URL-based position upsert on the server, then run a narrowly scoped cleanup script against a backed-up SQLite database.

**Tech Stack:** React 18, Vite 5, Express 4, Node 24 `node:test`, Node `node:sqlite`, browser `localStorage`.

## Global Constraints

- Do not delete uploaded or otherwise non-example resumes.
- Preserve `resume.answerBank.{userId}` across logout and context switches.
- Clear transient answers and bullets when resume, position, or JD context changes.
- Do not change the nine-step flow, analysis result schema, UI visual design, or MiniMax provider.
- Back up `server/data/app.db` before the first cleanup write.
- Delete database rows only when exact predicates identify orphan duplicate positions or exact built-in example inputs.
- Do not delete users, sessions, browser profiles, or recruitment-site cookies.
- Work in the current explicitly approved dirty workspace because the uncommitted prior fixes are required and Git metadata is read-only; do not stage, commit, reset, or overwrite unrelated changes.

---

### Task 1: Analysis Context Invalidation

**Files:**
- Create: `src/services/analysisContext.js`
- Modify: `src/App.jsx`
- Test: `server/test/analysis-context.test.mjs`

**Interfaces:**
- Produces: `createAnalysisContextKey(input, resumeId, positionId) -> string`
- Produces: `isAnalysisCurrent(input, analyzedInput) -> boolean`
- Produces: `canUseAnalysis(analysis, input, analyzedInput) -> boolean`
- App consumes these helpers and one `invalidateAnalysisContext({ clearTransientAnswers })` callback.

- [ ] **Step 1: Write failing tests**

```js
test('context key changes when JD, resume, position, or resume record changes', () => {
  assert.notEqual(createAnalysisContextKey(base, 'r1', 'p1'), createAnalysisContextKey({ ...base, jd: 'new' }, 'r1', 'p1'));
});

test('stale analysis cannot be used', () => {
  assert.equal(canUseAnalysis({}, { ...base, jd: 'new' }, base), false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/analysis-context.test.mjs` from `server/`.

Expected: FAIL because `src/services/analysisContext.js` does not exist.

- [ ] **Step 3: Implement pure helpers and integrate App lifecycle**

Implement stable normalization for the eight input fields. In `App.jsx`, invalidate analysis and transient answers when selecting/newing a resume, applying a position, successfully extracting a different JD, clearing input, or using example data. Start analysis by resetting the old result; set `analyzedInput` only after `analyze()` returns a non-null result. Block copy, export-dependent presentation, follow-up generation, and style rewrite when `canUseAnalysis` is false.

- [ ] **Step 4: Verify focused tests GREEN**

Run: `node --test test/analysis-context.test.mjs`.

Expected: all analysis context tests pass.

---

### Task 2: Preserve Long-Term Follow-Up Memory

**Files:**
- Create: `src/services/answerStorage.js`
- Modify: `src/hooks/usePersistentAnswers.js`
- Modify: `src/App.jsx`
- Test: `server/test/answer-storage.test.mjs`

**Interfaces:**
- Produces: `answerStorageKeys(userId) -> { bankKey, answersKey, bulletsKey }`
- Produces: `clearTransientAnswerStorage(storage, userId) -> void`
- Produces: `clearAllAnswerStorage(storage, userId) -> void`

- [ ] **Step 1: Write failing tests**

```js
test('logout cleanup preserves the long-term answer bank', () => {
  const storage = fakeStorage({
    'resume.answerBank.u1': '{"question":{"answer":"kept"}}',
    'resume.answers.u1': '{"q1":"temporary"}',
    'resume.bullets.u1': '{"q1":"temporary bullet"}',
  });
  clearTransientAnswerStorage(storage, 'u1');
  assert.equal(storage.getItem('resume.answerBank.u1'), '{"question":{"answer":"kept"}}');
  assert.equal(storage.getItem('resume.answers.u1'), null);
  assert.equal(storage.getItem('resume.bullets.u1'), null);
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test test/answer-storage.test.mjs`.

Expected: FAIL because the storage service is missing.

- [ ] **Step 3: Implement storage helpers and change logout behavior**

Use the shared key builder in the hook. Change the workspace logout handler to call `clearCurrentAnswers()` instead of `clearAnswerMemory()`. Keep the explicit `clearAll` API available only for a future user-initiated “delete memory” action.

- [ ] **Step 4: Verify focused tests GREEN**

Run: `node --test test/answer-storage.test.mjs`.

Expected: all answer storage tests pass.

---

### Task 3: Race-Safe Resume Autosave and User-Scoped Drafts

**Files:**
- Create: `src/services/autoSaveCoordinator.js`
- Create: `src/services/resumeDraftStorage.js`
- Modify: `src/hooks/useResumes.js`
- Modify: `src/App.jsx`
- Test: `server/test/autosave-coordinator.test.mjs`
- Test: `server/test/resume-draft-storage.test.mjs`

**Interfaces:**
- Produces: `createAutoSaveCoordinator()`
- Coordinator methods: `schedule(payload)`, `beginRequest()`, `isCurrent(ticket)`, `complete(ticket)`, `advanceEpoch()`, `peek()`, `clear()`
- Produces: `draftStorageKeys(userId)`
- Produces: `migrateLegacyDraft(storage, userId)`
- `useResumes(userId)` exposes `beginEditingSession()` in addition to existing methods.

- [ ] **Step 1: Write failing autosave tests**

```js
test('a late save from the previous epoch cannot become current', () => {
  const coordinator = createAutoSaveCoordinator();
  coordinator.schedule({ name: 'old' });
  const ticket = coordinator.beginRequest();
  coordinator.advanceEpoch();
  assert.equal(coordinator.isCurrent(ticket), false);
});

test('completing an old request does not clear a newer pending payload', () => {
  const coordinator = createAutoSaveCoordinator();
  coordinator.schedule({ name: 'first' });
  const ticket = coordinator.beginRequest();
  coordinator.schedule({ name: 'second' });
  coordinator.complete(ticket);
  assert.equal(coordinator.peek().name, 'second');
});
```

- [ ] **Step 2: Write failing draft isolation tests**

```js
test('draft and active resume keys are isolated per user', () => {
  assert.deepEqual(draftStorageKeys('u1'), {
    localKey: 'resume.draft.local.u1',
    activeKey: 'resume.draft.activeId.u1',
  });
});
```

- [ ] **Step 3: Run both focused tests and verify RED**

Run: `node --test test/autosave-coordinator.test.mjs test/resume-draft-storage.test.mjs`.

Expected: FAIL because both services are missing.

- [ ] **Step 4: Implement coordinator, storage migration, and hook integration**

Replace the single mutable `pendingRef` lifecycle with coordinator tickets. Only a current ticket may set `activeId`, write a returned resume ID, or clear its own payload. Pass `currentUser?.id` into `useResumes`. Migrate global legacy keys only for an authenticated user, then remove the global keys. Increment the editing epoch before example, clear, resume switch, and logout transitions.

- [ ] **Step 5: Verify focused tests GREEN**

Run: `node --test test/autosave-coordinator.test.mjs test/resume-draft-storage.test.mjs`.

Expected: all coordinator and draft storage tests pass.

---

### Task 4: Unified Unauthorized Logout

**Files:**
- Modify: `src/services/api.js`
- Modify: `src/components/AuthGate.jsx`
- Test: `server/test/auth-client-state.test.mjs`

**Interfaces:**
- Produces: `notifyUnauthorized(windowLike) -> void`
- 401 handling dispatches `resume:logout` with `{ reason: 'unauthorized' }`.
- `AuthGate` listens to `resume:logout` and resets its local authenticated state.

- [ ] **Step 1: Write failing test**

```js
test('unauthorized notification dispatches the shared logout event', () => {
  const events = [];
  notifyUnauthorized({ dispatchEvent: (event) => events.push(event) });
  assert.equal(events[0].type, 'resume:logout');
  assert.equal(events[0].detail.reason, 'unauthorized');
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test test/auth-client-state.test.mjs`.

Expected: FAIL because `notifyUnauthorized` is missing.

- [ ] **Step 3: Implement the shared event and AuthGate listener**

After a 401, clear credentials and dispatch the event once. In `AuthGate`, listen for the event, set `user` to null, set `authed` to false, and show the login tab. Ensure manual logout still revokes the current token before local state is cleared.

- [ ] **Step 4: Verify focused tests GREEN**

Run: `node --test test/auth-client-state.test.mjs`.

Expected: unauthorized event test passes.

---

### Task 5: URL-Based Position Upsert

**Files:**
- Create: `server/src/position-url.js`
- Modify: `server/src/routes/positions.js`
- Modify: `server/src/db.js`
- Test: `server/test/position-upsert.test.mjs`
- Extend: `server/test/api-contract.test.mjs`

**Interfaces:**
- Produces: `normalizePositionUrl(value) -> string`
- `POST /api/positions` returns `{ id, created }`.
- Same user and normalized non-empty URL returns the existing ID and updates fields.

- [ ] **Step 1: Write failing URL normalization and API tests**

```js
test('normalizes equivalent job URLs', () => {
  assert.equal(
    normalizePositionUrl('HTTPS://Example.com/jobs/1/#details'),
    'https://example.com/jobs/1',
  );
});

test('posting the same URL twice updates one position', async () => {
  const first = await createPosition({ title: 'Old', url: 'https://example.com/jobs/1' });
  const second = await createPosition({ title: 'New', url: 'https://example.com/jobs/1/' });
  assert.equal(second.id, first.id);
  assert.equal(second.created, false);
  assert.equal((await listPositions()).length, 1);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test test/position-upsert.test.mjs test/api-contract.test.mjs`.

Expected: URL normalization module is missing and API creates two rows.

- [ ] **Step 3: Implement normalized URL upsert**

Normalize URL before lookup and storage. Inside a transaction, query by current user and normalized URL; update and return the existing ID when present, otherwise insert. Preserve independent inserts for empty URLs. Add a best-effort partial unique index on `(user_id, url)` after existing duplicates are cleaned; startup must continue with an explicit warning if legacy duplicates temporarily prevent index creation.

- [ ] **Step 4: Verify focused tests GREEN**

Run: `node --test test/position-upsert.test.mjs test/api-contract.test.mjs`.

Expected: all position tests pass.

---

### Task 6: Recoverable Exact Data Cleanup

**Files:**
- Create: `server/src/data-cleanup.js`
- Create: `server/scripts/cleanup-state-data.mjs`
- Test: `server/test/data-cleanup.test.mjs`
- Delete: `.env` after confirming `server/.env` contains the same MiniMax key.

**Interfaces:**
- Produces: `buildCleanupPlan(db, exampleInput) -> { duplicatePositionIds, exactExampleResumeIds }`
- Produces: `applyCleanupPlan(db, plan) -> { deletedPositions, deletedResumes }`
- Script creates a timestamped DB backup before opening the source database writable.

- [ ] **Step 1: Write failing cleanup-plan tests**

```js
test('cleanup plan selects only orphan duplicate positions and exact examples', () => {
  const plan = buildCleanupPlan(db, exampleInput);
  assert.deepEqual(plan.duplicatePositionIds, ['orphan-older', 'orphan-newer']);
  assert.deepEqual(plan.exactExampleResumeIds, ['exact-example']);
});

test('cleanup never selects a duplicate position linked to a resume', () => {
  assert.equal(plan.duplicatePositionIds.includes('linked-position'), false);
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test test/data-cleanup.test.mjs`.

Expected: FAIL because cleanup planning functions are missing.

- [ ] **Step 3: Implement dry-run planning and transactional cleanup**

Compare all eight input fields against `exampleInput`. For duplicate non-empty URLs, retain a linked position first; otherwise retain the most recently updated row. Select only unlinked surplus rows. The script prints the plan, verifies the backup exists and is non-empty, applies one SQLite transaction, checks foreign keys, and prints post-cleanup counts.

- [ ] **Step 4: Verify cleanup tests GREEN**

Run: `node --test test/data-cleanup.test.mjs`.

Expected: cleanup plan and transaction tests pass.

- [ ] **Step 5: Run the cleanup script against the workspace database**

Run: `node scripts/cleanup-state-data.mjs` from `server/`.

Expected:

- A non-empty backup under `server/data/backups/`.
- Two orphan duplicate positions removed.
- Two exact built-in example resumes removed.
- Five non-example resumes remain.
- No foreign-key violations.

- [ ] **Step 6: Remove legacy frontend environment file**

Verify `server/.env` still has `MINIMAX_API_KEY`, then delete the ignored root `.env`. Do not print either secret.

---

### Task 7: Full Regression and Runtime Verification

**Files:**
- Modify only if verification exposes a regression.

**Interfaces:**
- Consumes all earlier tasks.
- Produces final evidence for correctness and data preservation.

- [ ] **Step 1: Run all backend tests**

Run: `npm test` from `server/`.

Expected: all tests pass with zero failures.

- [ ] **Step 2: Build the frontend**

Run: `npm run build` from the project root.

Expected: Vite exits 0; the existing bundle-size warning is allowed.

- [ ] **Step 3: Restart and inspect health**

Restart the backend using the existing project process pattern, then request `http://localhost:4000/api/health`.

Expected: `{ "ok": true, "minimaxConfigured": true }`.

- [ ] **Step 4: Re-audit database invariants**

Expected:

- `positions`: 1 retained linked position.
- `resumes`: 5 non-example records.
- `analyses`: unchanged.
- Follow-up long-term memory is not deleted.
- Duplicate non-empty position URLs: 0.
- Exact example resumes: 0.
- Foreign-key violations: 0.

- [ ] **Step 5: Inspect the final diff**

Confirm no unrelated user changes were reverted, no secrets appear in tracked files, and only plan-scoped files changed.
