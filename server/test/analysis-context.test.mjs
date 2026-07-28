import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canUseAnalysis,
  createAnalysisContextKey,
  isAnalysisCurrent,
} from '../../src/services/analysisContext.js';

const baseInput = {
  targetRole: 'AI Product Manager',
  targetIndustry: 'AI',
  targetCompanyType: 'SaaS',
  jobStage: '社招-3-5年',
  highlightSkills: '需求分析',
  jd: 'Own the product roadmap.',
  resume: 'Candidate resume',
  extras: 'Remote',
};

test('analysis context changes with resume record, position, JD, or resume content', () => {
  const original = createAnalysisContextKey(baseInput, 'resume-1', 'position-1');

  assert.notEqual(original, createAnalysisContextKey(baseInput, 'resume-2', 'position-1'));
  assert.notEqual(original, createAnalysisContextKey(baseInput, 'resume-1', 'position-2'));
  assert.notEqual(
    original,
    createAnalysisContextKey({ ...baseInput, jd: 'A different JD' }, 'resume-1', 'position-1'),
  );
  assert.notEqual(
    original,
    createAnalysisContextKey({ ...baseInput, resume: 'A different resume' }, 'resume-1', 'position-1'),
  );
});

test('analysis comparison normalizes missing fields without hiding material changes', () => {
  assert.equal(isAnalysisCurrent({ targetRole: 'Role' }, { targetRole: 'Role' }), true);
  assert.equal(
    isAnalysisCurrent({ targetRole: 'Role', jd: 'new' }, { targetRole: 'Role', jd: 'old' }),
    false,
  );
});

test('stale or missing analysis cannot be used', () => {
  assert.equal(canUseAnalysis(null, baseInput, baseInput), false);
  assert.equal(canUseAnalysis({}, baseInput, null), false);
  assert.equal(canUseAnalysis({}, { ...baseInput, jd: 'new' }, baseInput), false);
  assert.equal(canUseAnalysis({}, baseInput, { ...baseInput }), true);
});
