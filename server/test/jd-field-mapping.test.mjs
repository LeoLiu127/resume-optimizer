import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPositionPayload,
  mergeBilingualTranslationIntoInput,
  mergeJdExtractionIntoInput,
} from '../../src/services/jdFieldMapping.js';
import { normalizeExtractedFields } from '../src/jd-translator.js';

const previousInput = {
  targetRole: 'AI 产品经理',
  targetIndustry: 'AI应用 / 企业服务',
  targetCompanyType: 'AI创业公司',
  jobStage: '社招-3-5年',
  highlightSkills: 'AI产品能力、项目推进',
  jd: '上一份 JD',
  resume: '用户简历',
  extras: '用户补充',
};

const extractionWithoutDerivedFields = {
  success: true,
  title: 'Mandarin Translation & Interpretation Specialist',
  company: 'Example Company',
  jdContent: '新的中文 JD',
  extractedFields: {
    targetIndustry: '',
    targetCompanyType: '',
    jobStage: '',
    highlightSkills: '',
  },
};

test('a successful JD extraction clears stale derived fields when none were extracted', () => {
  const next = mergeJdExtractionIntoInput(previousInput, extractionWithoutDerivedFields);

  assert.equal(next.targetRole, 'Mandarin Translation & Interpretation Specialist');
  assert.equal(next.jd, '新的中文 JD');
  assert.equal(next.targetIndustry, '');
  assert.equal(next.targetCompanyType, '');
  assert.equal(next.jobStage, '');
  assert.equal(next.highlightSkills, '');
  assert.equal(next.resume, '用户简历');
  assert.equal(next.extras, '用户补充');
});

test('auto-saved position uses empty extraction fields instead of stale form values', () => {
  const payload = buildPositionPayload({
    input: previousInput,
    extractedData: extractionWithoutDerivedFields,
    jdUrl: 'https://jobs.example.com/mandarin-specialist',
    sourceSite: 'other',
  });

  assert.equal(payload.targetIndustry, '');
  assert.equal(payload.targetCompanyType, '');
  assert.equal(payload.jobStage, '');
  assert.equal(payload.highlightSkills, '');
  assert.equal(payload.jdContent, '新的中文 JD');
});

test('translator normalizes unknown sentinel values to empty strings', () => {
  assert.deepEqual(
    normalizeExtractedFields({
      targetIndustry: '',
      targetCompanyType: '不限',
      jobStage: '未知',
      highlightSkills: '',
    }),
    {
      targetIndustry: '',
      targetCompanyType: '',
      jobStage: '',
      highlightSkills: '',
    },
  );
});

test('analysis preprocessing uses bilingual title and JD without changing resume data', () => {
  const next = mergeBilingualTranslationIntoInput(previousInput, {
    bilingualTitle: 'Mandarin Translation Specialist / 普通话翻译专家',
    bilingualJd: 'Requirements\n岗位要求',
  });

  assert.equal(next.targetRole, 'Mandarin Translation Specialist / 普通话翻译专家');
  assert.equal(next.jd, 'Requirements\n岗位要求');
  assert.equal(next.resume, previousInput.resume);
  assert.equal(next.extras, previousInput.extras);
  assert.equal(next.targetIndustry, previousInput.targetIndustry);
});
