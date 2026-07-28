import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);
const testDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(testDir, '..');
const projectRoot = resolve(serverRoot, '..');

test('server config loads its own .env when the process starts from the project root', async () => {
  const fixtureRoot = await mkdtemp(join(testDir, 'config-env-'));
  const fixtureSrc = join(fixtureRoot, 'src');
  await mkdir(fixtureSrc);

  try {
    await copyFile(join(serverRoot, 'src', 'config.js'), join(fixtureSrc, 'config.js'));
    await writeFile(
      join(fixtureRoot, '.env'),
      [
        'MINIMAX_API_KEY=test-server-key',
        'MINIMAX_BASE_URL=https://example.invalid/v1',
        'MINIMAX_MODEL=test-model',
      ].join('\n'),
    );

    const moduleUrl = pathToFileURL(join(fixtureSrc, 'config.js')).href;
    const script = [
      `const imported = await import(${JSON.stringify(moduleUrl)});`,
      'console.log(JSON.stringify({',
      '  configured: imported.isMiniMaxConfigured(),',
      '  apiKey: imported.config.minimax.apiKey,',
      '  baseUrl: imported.config.minimax.baseUrl,',
      '  model: imported.config.minimax.model,',
      '}));',
    ].join('\n');
    const env = { ...process.env };
    delete env.MINIMAX_API_KEY;
    delete env.MINIMAX_BASE_URL;
    delete env.MINIMAX_MODEL;

    const { stdout } = await execFileAsync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { cwd: projectRoot, env },
    );
    const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));

    assert.deepEqual(result, {
      configured: true,
      apiKey: 'test-server-key',
      baseUrl: 'https://example.invalid/v1',
      model: 'test-model',
    });
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
