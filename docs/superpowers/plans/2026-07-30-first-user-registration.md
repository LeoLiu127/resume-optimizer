# First User Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow only the first registered user in an empty database to register without an invite code and become the administrator.

**Architecture:** The backend remains the source of truth by counting users before invite validation. The frontend derives whether to show and require the invite field from `bootstrap.hasUsers`, while defaulting to the secure invite-required state until bootstrap resolves.

**Tech Stack:** React 18, Express 4, Node test runner, SQLite, bcryptjs.

## Global Constraints

- 免邀请码仅适用于服务端数据库中用户数量为 `0` 的注册请求。
- 第一位用户注册成功后，第二位及以后用户继续按照现有邀请模式强制校验邀请码。
- 登录流程不变。
- 首次注册界面隐藏邀请码输入框，并显示“首位用户免邀请码，将自动成为管理员”。
- 前端尚未取得 bootstrap 结果时保持邀请码必填。
- 不增加数据库迁移或首位注册并发事务锁。
- 所有生产代码必须由先失败的真实行为测试驱动。
- 只在 `F:\tmp\resume-export-templates` 隔离 worktree 中工作。
- 禁止使用 Computer Use、WPS 或浏览器自动化。

---

### Task 1: First-user registration bypass

**Files:**
- Create: `src/services/registrationPolicy.js`
- Create: `server/test/auth-registration.test.mjs`
- Create: `server/test/registration-policy.test.mjs`
- Modify: `server/src/routes/auth.js`
- Modify: `src/components/AuthGate.jsx`

**Interfaces:**
- Produces: `isFirstUserRegistration(bootstrap): boolean`, true only when `bootstrap?.hasUsers === false`.
- Consumes: `GET /api/auth/bootstrap` response `{ hasUsers: boolean }`.
- Produces: `POST /api/auth/register` accepts an empty or omitted `code` only while `SELECT COUNT(*) FROM users` is `0`.

- [ ] **Step 1: Write failing backend behavior tests**

Create `server/test/auth-registration.test.mjs` with an isolated temporary database and Express app mounting `authRoutes`. Assert:

```js
const first = await request('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ displayName: '首位管理员', password: 'first-pass-123' }),
});
assert.equal(first.status, 200);
assert.equal(first.body.user.role, 'admin');

const second = await request('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ displayName: '第二位用户', password: 'second-pass-123' }),
});
assert.equal(second.status, 400);
assert.equal(second.body.error, '请提供邀请码');
```

- [ ] **Step 2: Run the backend test and verify RED**

Run:

```powershell
node --test test/auth-registration.test.mjs
```

Expected: the first registration fails with `400` and “请提供邀请码”.

- [ ] **Step 3: Implement the minimal backend policy**

In `handleRegister`, obtain `db` and `userCount` after nickname/password validation but before invite validation. When `userCount === 0`, skip invite lookup and consumption; otherwise preserve every existing invite validation branch. Pass `null` as `inviteCodeId` for the first user's session.

- [ ] **Step 4: Run the backend test and verify GREEN**

Run:

```powershell
node --test test/auth-registration.test.mjs
```

Expected: both first-user success and second-user rejection pass.

- [ ] **Step 5: Write failing frontend policy tests**

Create `server/test/registration-policy.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { isFirstUserRegistration } from '../../src/services/registrationPolicy.js';

test('only an explicit empty-user bootstrap enables first-user registration', () => {
  assert.equal(isFirstUserRegistration({ hasUsers: false }), true);
  assert.equal(isFirstUserRegistration({ hasUsers: true }), false);
  assert.equal(isFirstUserRegistration(null), false);
});
```

Add a source contract assertion that `AuthGate.jsx` uses this policy to omit the invite field and skip the “请输入邀请码” client validation only for the first-user state.

- [ ] **Step 6: Run the frontend policy test and verify RED**

Run:

```powershell
node --test test/registration-policy.test.mjs
```

Expected: import failure because `registrationPolicy.js` does not exist.

- [ ] **Step 7: Implement the minimal frontend behavior**

Create:

```js
export function isFirstUserRegistration(bootstrap) {
  return bootstrap?.hasUsers === false;
}
```

In `AuthGate.jsx`, derive `firstUserRegistration`, hide the invite label/input for that state, skip client invite validation only for that state, and change the registration footer to “首位用户免邀请码，将自动成为管理员。” Preserve existing invite UI and validation for all other states.

- [ ] **Step 8: Verify focused and full behavior**

Run:

```powershell
node --test test/auth-registration.test.mjs test/registration-policy.test.mjs
npm test
```

Expected: focused tests and the full server suite pass with zero failures.

- [ ] **Step 9: Verify the frontend build**

Run:

```powershell
npm run build
```

Expected: Vite exits `0`.

- [ ] **Step 10: Commit**

```powershell
git add docs/superpowers/specs/2026-07-30-first-user-registration-design.md docs/superpowers/plans/2026-07-30-first-user-registration.md server/src/routes/auth.js src/components/AuthGate.jsx src/services/registrationPolicy.js server/test/auth-registration.test.mjs server/test/registration-policy.test.mjs
git commit -m "fix: allow first user registration without invite"
```

