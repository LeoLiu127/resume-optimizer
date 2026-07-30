# Account Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all retained resume application data into the existing
`Leo Liu` account, make Leo the sole administrator, revoke legacy sessions,
and restore login with a generated temporary password.

**Architecture:** A pure SQLite migration module performs preflight planning and
one guarded transaction. A separate operational script handles backup creation,
temporary-password generation, bcrypt hashing, and final audit output. In-memory
tests prove ownership transfer and rollback behavior before the script touches
the live database.

**Tech Stack:** Node.js 24, `node:sqlite`, `bcryptjs`, Node test runner,
PowerShell process control.

## Global Constraints

- Never print or commit `server/.env` or the MiniMax API key.
- Stop the live backend before mutating `server/data/app.db`.
- Make and validate a nonempty database backup before opening the live database.
- Do not delete a user until all owned resumes, positions, analyses, and
  follow-up bullets have been transferred.
- Abort on ambiguous `Leo Liu` records or position URL uniqueness conflicts.
- Keep the feature worktree and `codex/pre-merge-main-backup-20260730`.

---

### Task 1: Specify account-consolidation behavior

**Files:**
- Create: `server/test/account-consolidation.test.mjs`
- Test: `server/test/account-consolidation.test.mjs`

**Interfaces:**
- Consumes: `DatabaseSync` from `node:sqlite`.
- Produces: expected contracts for
  `buildAccountConsolidationPlan(db, canonicalDisplayName)` and
  `applyAccountConsolidation(db, { canonicalDisplayName, passwordHash })`.

- [ ] **Step 1: Write the failing ownership-transfer test**

Create an in-memory schema with two users, sessions, invite codes, resumes,
positions, analyses, and follow-up bullets. Assert that applying consolidation:

```js
const result = applyAccountConsolidation(db, {
  canonicalDisplayName: 'Leo Liu',
  passwordHash: '$2b$10$replacement',
});

assert.equal(result.canonicalUserId, 'leo');
assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n, 1);
assert.equal(
  db.prepare('SELECT role FROM users WHERE id = ?').get('leo').role,
  'admin',
);
assert.equal(
  db.prepare('SELECT COUNT(*) n FROM resumes WHERE user_id = ?').get('leo').n,
  2,
);
assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions').get().n, 0);
assert.equal(db.prepare('SELECT COUNT(*) n FROM invite_codes').get().n, 1);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
```

- [ ] **Step 2: Write failure-mode tests**

Add independent tests asserting:

```js
assert.throws(
  () => buildAccountConsolidationPlan(db, 'Missing User'),
  /exactly one canonical user/i,
);
assert.throws(
  () => applyAccountConsolidation(conflictDb, options),
  /position url conflict/i,
);
assert.equal(conflictDb.prepare('SELECT COUNT(*) n FROM users').get().n, 2);
```

- [ ] **Step 3: Run the focused test and confirm RED**

Run:

```powershell
node --test test/account-consolidation.test.mjs
```

Expected: failure because `../src/account-consolidation.js` does not exist.

### Task 2: Implement the guarded migration module

**Files:**
- Create: `server/src/account-consolidation.js`
- Test: `server/test/account-consolidation.test.mjs`

**Interfaces:**
- Consumes: a synchronous SQLite database with the production table names.
- Produces:
  - `buildAccountConsolidationPlan(db, canonicalDisplayName)`;
  - `applyAccountConsolidation(db, options)`.

- [ ] **Step 1: Implement read-only preflight**

`buildAccountConsolidationPlan` must:

```js
const matches = db.prepare(
  'SELECT id, display_name FROM users WHERE LOWER(display_name) = LOWER(?)',
).all(canonicalDisplayName.trim());
```

Require exactly one match, collect every other user ID, count owned rows by
table, and detect duplicate nonempty position URLs that would share the
canonical user after transfer.

- [ ] **Step 2: Implement the transaction**

Within `BEGIN IMMEDIATE`:

```js
for (const table of ['resumes', 'positions', 'analyses', 'followup_bullets']) {
  db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id <> ?`)
    .run(canonicalUserId, canonicalUserId);
}
db.prepare('DELETE FROM sessions').run();
db.prepare(
  `UPDATE users
   SET role = 'admin', status = 'active', password_hash = ?
   WHERE id = ?`,
).run(passwordHash, canonicalUserId);
db.prepare('DELETE FROM users WHERE id <> ?').run(canonicalUserId);
```

Commit only after foreign keys are clean and all owned rows belong to Leo.
Rollback and rethrow on every failure.

- [ ] **Step 3: Run focused tests and confirm GREEN**

Run:

```powershell
node --test test/account-consolidation.test.mjs
```

Expected: all account-consolidation tests pass.

### Task 3: Add the backup-and-run operational script

**Files:**
- Create: `server/scripts/consolidate-accounts.mjs`
- Modify: `server/package.json`
- Test: `server/test/account-consolidation.test.mjs`

**Interfaces:**
- Consumes: `config.paths.dbFile`, bcrypt, and the migration module.
- Produces: a backup file, JSON audit output, and a one-time temporary password.

- [ ] **Step 1: Create a mandatory backup**

Copy `app.db` to:

```text
server/data/backups/app-before-account-consolidation-YYYYMMDD-HHMMSS.db
```

Abort when the source is missing or the copied file size is zero.

- [ ] **Step 2: Generate and hash the temporary password**

Generate a 16-character URL-safe password:

```js
const temporaryPassword = randomBytes(12).toString('base64url');
const passwordHash = bcrypt.hashSync(temporaryPassword, 10);
```

Pass only the hash into the migration module.

- [ ] **Step 3: Print a post-migration audit**

Output JSON containing backup path, canonical user ID, deleted user count,
moved row counts, revoked session count, final table counts, zero foreign-key
violations, and the temporary password.

- [ ] **Step 4: Add the package command**

Add:

```json
"consolidate-accounts": "node scripts/consolidate-accounts.mjs"
```

### Task 4: Verify code before touching live data

**Files:**
- Verify: `server/test/*.test.mjs`
- Verify: frontend production build

- [ ] **Step 1: Run the complete backend test suite**

Run:

```powershell
npm test
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run the frontend production build**

Run from the repository root:

```powershell
npm run build
```

Expected: Vite exits zero; the existing large-chunk warning is nonblocking.

### Task 5: Consolidate the live database and restore runtime

**Files:**
- Mutate: ignored `server/data/app.db`
- Create: ignored backup under `server/data/backups`
- Read: ignored `server/.env`

- [ ] **Step 1: Resolve and stop the exact port-4000 Node process**

Validate that the listener command is `server.js`, then stop that process.
Abort if the listener is not the expected backend.

- [ ] **Step 2: Run the migration command**

Run:

```powershell
npm run consolidate-accounts
```

Save the printed temporary password for final handoff.

- [ ] **Step 3: Audit the database independently**

Assert:

```text
users=1
Leo role=admin
Leo status=active
resumes=5 and all owned by Leo
positions=1 and all owned by Leo
sessions=0
foreign_key_check=0
```

- [ ] **Step 4: Restart the backend from the main project**

Use hidden `Start-Process` from `F:\AI Projects\Resume\server`. Verify:

```text
/api/health ok=true
minimaxConfigured=true
```

- [ ] **Step 5: Verify real login and MiniMax**

POST the generated temporary password to `/api/auth/login`, verify the response
user is `Leo Liu` with role `admin`, immediately revoke the probe session, then
run the existing minimal MiniMax-M3 connectivity probe and require
`finishReason=stop`.

### Task 6: Commit and report

**Files:**
- Commit: migration module, tests, script, package metadata, design, and plan.
- Preserve: feature worktree and pre-merge safety branch.

- [ ] **Step 1: Check the final diff**

Run:

```powershell
git diff --check
git status --short
```

Confirm no ignored secret or database path is staged.

- [ ] **Step 2: Commit implementation**

Commit with:

```powershell
git commit -m "fix: consolidate legacy accounts safely"
```

- [ ] **Step 3: Report the temporary credential and audit**

Provide the backup path, final ownership counts, test/build evidence, backend
PID, and temporary password. Tell the user to log in and change the password
immediately.
