import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isExactExampleInput,
  resumeRecordToEditorState,
  shouldAutoSaveDraft,
} from '../../src/services/resumeDraft.js';

const example = {
  targetRole: 'AI 产品经理',
  targetIndustry: '人工智能',
  targetCompanyType: '成长型公司',
  jobStage: '社招-3-5年',
  highlightSkills: '产品策略',
  jd: '示例 JD',
  resume: '示例简历',
  extras: '示例补充',
};

test('exact example input is excluded from resume autosave', () => {
  assert.equal(isExactExampleInput({ ...example }, example), true);
  assert.equal(shouldAutoSaveDraft({ ...example }, example, true), false);
  assert.equal(
    shouldAutoSaveDraft({ ...example, resume: '用户自己的简历' }, example, true),
    true,
  );
});

test('saved resume API records restore editor input and position binding', () => {
  const restored = resumeRecordToEditorState({
    id: 'resume-1',
    name: 'AI 产品经理简历',
    targetRole: 'AI 产品经理',
    content: '真实简历内容',
    input: null,
    positionId: 'position-1',
  });

  assert.equal(restored.title, 'AI 产品经理简历');
  assert.equal(restored.input.targetRole, 'AI 产品经理');
  assert.equal(restored.input.resume, '真实简历内容');
  assert.equal(restored.positionId, 'position-1');
  assert.equal(restored.positionTitle, 'AI 产品经理');
});
