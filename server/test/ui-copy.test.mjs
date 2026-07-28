import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANALYSIS_ACTION_HINT,
  getAnalysisActionLabel,
} from '../../src/services/uiCopy.js';
import { steps } from '../../src/mockData.js';

test('analysis action uses full-flow labels', () => {
  assert.equal(getAnalysisActionLabel({ busy: false, hasAnalysis: false }), '开始智能优化');
  assert.equal(getAnalysisActionLabel({ busy: true, hasAnalysis: false }), '智能优化中…');
  assert.equal(getAnalysisActionLabel({ busy: false, hasAnalysis: true }), '重新生成结果');
  assert.match(ANALYSIS_ACTION_HINT, /重新生成结果/);
});

test('export step is named resume export', () => {
  assert.equal(steps.at(-1), '简历导出');
});
