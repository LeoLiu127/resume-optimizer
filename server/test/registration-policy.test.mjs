import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isFirstUserRegistration } from '../../src/services/registrationPolicy.js';

test('only an explicit empty-user bootstrap enables first-user registration', () => {
  assert.equal(isFirstUserRegistration({ hasUsers: false }), true);
  assert.equal(isFirstUserRegistration({ hasUsers: true }), false);
  assert.equal(isFirstUserRegistration(null), false);
});

test('AuthGate omits the invite field and client invite validation only for the first-user policy state', () => {
  const authGatePath = fileURLToPath(new URL('../../src/components/AuthGate.jsx', import.meta.url));
  const source = readFileSync(authGatePath, 'utf8');

  assert.match(source, /isFirstUserRegistration\(bootstrap\)/);
  assert.match(source, /tab === TABS\.REGISTER && !firstUserRegistration/);
  assert.match(source, /if \(!firstUserRegistration && !code\.trim\(\)\) return setError\('请输入邀请码'\)/);
});
