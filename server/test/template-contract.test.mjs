import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../src/templates/PreviewTemplates.jsx', import.meta.url), 'utf8');

test('preview templates expose all selected visual directions', () => {
  assert.match(source, /tpl-editorial/);
  assert.match(source, /tpl-precision-grid/);
  assert.match(source, /tpl-minimal/);
  assert.match(source, /language/);
  assert.match(source, /Selected Projects/);
  assert.match(source, /项目经历/);
});
