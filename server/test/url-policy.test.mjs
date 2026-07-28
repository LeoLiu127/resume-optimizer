import test from 'node:test';
import assert from 'node:assert/strict';

import { assertPublicHttpUrl } from '../src/url-policy.js';

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

test('public URL policy accepts an ordinary public HTTPS job link', async () => {
  const url = await assertPublicHttpUrl('https://jobs.example.com/roles/ai-pm', {
    lookup: publicLookup,
  });
  assert.equal(url, 'https://jobs.example.com/roles/ai-pm');
});

test('public URL policy rejects local, private, and link-local destinations', async () => {
  const blocked = [
    'http://localhost:4000/api/admin/users',
    'http://127.0.0.1:4000/api/health',
    'http://10.0.0.5/internal',
    'http://172.16.2.3/internal',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
  ];

  for (const url of blocked) {
    await assert.rejects(
      () => assertPublicHttpUrl(url, { lookup: publicLookup }),
      /公网|内网|本机/,
      url,
    );
  }
});

test('public URL policy rejects a hostname that resolves to a private address', async () => {
  await assert.rejects(
    () =>
      assertPublicHttpUrl('https://jobs.example.test/role', {
        lookup: async () => [{ address: '169.254.169.254', family: 4 }],
      }),
    /公网|内网|本机/,
  );
});
