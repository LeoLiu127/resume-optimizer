import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatBilingualParagraphs,
  formatBilingualTitle,
  needsBilingualTranslation,
} from '../../src/services/bilingualJd.js';
import { normalizeTranslationResult } from '../src/jd-translator.js';

test('pairs every English paragraph with its Chinese translation', () => {
  assert.equal(
    formatBilingualParagraphs(
      'First requirement.\n\nSecond requirement.',
      '第一项要求。\n\n第二项要求。',
    ),
    'First requirement.\n第一项要求。\n\nSecond requirement.\n第二项要求。',
  );
});

test('keeps unmatched source paragraphs instead of dropping JD content', () => {
  assert.equal(
    formatBilingualParagraphs(
      'First requirement.\n\nSecond requirement.',
      '第一项要求。',
    ),
    'First requirement.\n第一项要求。\n\nSecond requirement.',
  );
});

test('does not duplicate content that is already bilingual', () => {
  const bilingual = 'Requirements\n岗位要求\n\nRemote work.\n远程工作。';
  assert.equal(formatBilingualParagraphs(bilingual, '新的中文译文'), bilingual);
  assert.equal(needsBilingualTranslation('Translator / 翻译专员', bilingual), false);
});

test('formats an English title with its Chinese translation', () => {
  assert.equal(
    formatBilingualTitle(
      'Mandarin Translation & Interpretation Specialist',
      '普通话翻译与口译专家',
    ),
    'Mandarin Translation & Interpretation Specialist / 普通话翻译与口译专家',
  );
});

test('detects an English JD that still needs Chinese translation', () => {
  assert.equal(
    needsBilingualTranslation(
      'Mandarin Translation Specialist',
      'Requirements include translation, interpretation, proofreading, and remote collaboration.',
    ),
    true,
  );
});

test('normalizes a translator result into original, translated, and bilingual fields', () => {
  const result = normalizeTranslationResult(
    {
      translatedTitle: '普通话翻译专家',
      translatedJd: '岗位要求\n\n远程协作。',
      extractedFields: {
        targetIndustry: '',
        targetCompanyType: '',
        jobStage: '',
        highlightSkills: '翻译、校对',
      },
      language: 'en',
    },
    {
      title: 'Mandarin Translation Specialist',
      jd: 'Requirements\n\nRemote collaboration.',
    },
  );

  assert.equal(
    result.bilingualTitle,
    'Mandarin Translation Specialist / 普通话翻译专家',
  );
  assert.equal(
    result.bilingualJd,
    'Requirements\n岗位要求\n\nRemote collaboration.\n远程协作。',
  );
  assert.equal(result.originalJd, 'Requirements\n\nRemote collaboration.');
  assert.equal(result.translatedJd, '岗位要求\n\n远程协作。');
  assert.equal(result.extractedFields.highlightSkills, '翻译、校对');
});
