import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../../src/templates/templateCatalog.js';
import {
  buildLocalizedAnalysis,
  createEnglishCacheKey,
} from '../../src/services/resumeExportLanguage.js';
import { buildFileName } from '../../src/utils/resumeData.js';

test('template catalog preserves stable keys with new names', () => {
  assert.deepEqual(TEMPLATES.map(({ key, label }) => [key, label]), [
    ['classic', '编辑出版型'],
    ['modern', '精准网格型'],
    ['minimal', '极简留白'],
  ]);
});

test('english cache key changes with resume content', () => {
  assert.notEqual(
    createEnglishCacheKey({ basic: ['A'] }, 'PM'),
    createEnglishCacheKey({ basic: ['B'] }, 'PM'),
  );
});

test('localized analysis swaps only final resume and role', () => {
  const analysis = { summary: { role: '产品经理', fitScore: 80 }, finalResume: { basic: ['张晨'] } };
  const localized = buildLocalizedAnalysis(analysis, {
    role: 'Product Manager',
    finalResume: { basic: ['Zhang Chen'] },
  });
  assert.equal(localized.summary.fitScore, 80);
  assert.equal(localized.summary.role, 'Product Manager');
  assert.equal(localized.finalResume.basic[0], 'Zhang Chen');
});

test('english filename carries readable template and language tags', () => {
  assert.equal(
    buildFileName({ name: 'Zhang Chen' }, 'Product Manager', 'classic', 'pdf', 'en'),
    'Zhang_Chen_Product_Manager_Editorial_EN.pdf',
  );
});
