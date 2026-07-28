import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, TEMPLATES } from '../../src/templates/templateCatalog.js';
import {
  buildLocalizedAnalysis,
  deriveLocalizedExport,
  createEnglishCacheKey,
  shouldApplyEnglishResponse,
} from '../../src/services/resumeExportLanguage.js';
import { buildFileName } from '../../src/utils/resumeData.js';

test('template catalog preserves stable keys with new names', () => {
  assert.deepEqual(TEMPLATES.map(({ key, label }) => [key, label]), [
    ['classic', '编辑出版型'],
    ['modern', '精准网格型'],
    ['minimal', '极简留白'],
  ]);
});

test('template catalog exposes supported export languages', () => {
  assert.deepEqual(LANGUAGES.map(({ key, label }) => [key, label]), [
    ['zh', '中文简历'],
    ['en', 'English Resume'],
  ]);
});

test('english cache key changes with resume content', () => {
  assert.notEqual(
    createEnglishCacheKey({ basic: ['A'] }, 'PM'),
    createEnglishCacheKey({ basic: ['B'] }, 'PM'),
  );
});

test('cache key includes role and structured resume', () => {
  const resume = { basic: ['张晨'], summary: '产品经理' };
  assert.notEqual(
    createEnglishCacheKey(resume, '产品经理'),
    createEnglishCacheKey(resume, '运营经理'),
  );
  assert.equal(
    createEnglishCacheKey(
      { basic: ['张晨'], experience: [{ company: 'A', title: '产品经理' }] },
      '产品经理',
    ),
    createEnglishCacheKey(
      { experience: [{ title: '产品经理', company: 'A' }], basic: ['张晨'] },
      '产品经理',
    ),
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

test('English loading never falls back to the Chinese analysis', () => {
  const sourceAnalysis = { summary: { role: '产品经理' }, finalResume: { basic: ['张晨'] } };
  const result = deriveLocalizedExport({
    analysis: sourceAnalysis,
    language: 'en',
    englishKey: 'analysis-b',
    englishState: 'loading',
    englishStateKey: 'analysis-b',
    englishPayload: { key: 'analysis-a', payload: { role: 'Old role', finalResume: { basic: ['Old'] } } },
    cachedPayload: null,
  });

  assert.equal(result.analysis, null);
  assert.equal(result.state, 'loading');
  assert.equal(result.canExport, false);
});

test('English cache hit provides localized analysis immediately', () => {
  const sourceAnalysis = { summary: { role: '产品经理' }, finalResume: { basic: ['张晨'] } };
  const result = deriveLocalizedExport({
    analysis: sourceAnalysis,
    language: 'en',
    englishKey: 'analysis-a',
    englishState: 'loading',
    englishPayload: null,
    cachedPayload: { role: 'Product Manager', finalResume: { basic: ['Zhang Chen'] } },
  });

  assert.equal(result.analysis.summary.role, 'Product Manager');
  assert.equal(result.analysis.finalResume.basic[0], 'Zhang Chen');
  assert.equal(result.state, 'ready');
  assert.equal(result.canExport, true);
});

test('a new English key does not inherit another key error state', () => {
  const result = deriveLocalizedExport({
    analysis: { summary: { role: '产品经理' }, finalResume: { basic: ['张晨'] } },
    language: 'en',
    englishKey: 'analysis-b',
    englishState: 'error',
    englishStateKey: 'analysis-a',
    englishPayload: null,
    cachedPayload: null,
  });

  assert.equal(result.analysis, null);
  assert.equal(result.state, 'idle');
});

test('only a response for the active English key may update the UI', () => {
  assert.equal(shouldApplyEnglishResponse('analysis-b', 'analysis-a'), false);
  assert.equal(shouldApplyEnglishResponse('', 'analysis-a'), false);
  assert.equal(shouldApplyEnglishResponse('analysis-a', 'analysis-a'), true);
});

test('Chinese export remains available after an English failure', () => {
  const sourceAnalysis = { summary: { role: '产品经理' }, finalResume: { basic: ['张晨'] } };
  const result = deriveLocalizedExport({
    analysis: sourceAnalysis,
    language: 'zh',
    englishKey: 'analysis-a',
    englishState: 'error',
    englishPayload: null,
    cachedPayload: null,
  });

  assert.equal(result.analysis, sourceAnalysis);
  assert.equal(result.canExport, true);
});

test('english filename carries readable template and language tags', () => {
  assert.equal(
    buildFileName({ name: 'Zhang Chen' }, 'Product Manager', 'classic', 'pdf', 'en'),
    'Zhang_Chen_Product_Manager_Editorial_EN.pdf',
  );
});
