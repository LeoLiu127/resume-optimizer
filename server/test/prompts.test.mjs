import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOptimizeStylePrompt } from '../../src/services/prompts.js';

test('style rewrite prompt includes both the requested style and current rewrite items', () => {
  const prompt = buildOptimizeStylePrompt(
    {
      targetRole: 'AI 产品经理',
      targetIndustry: '人工智能',
      targetCompanyType: '成长型公司',
      jd: '负责 AI 产品规划与落地',
      resume: '负责产品需求与跨部门协作',
      extras: '',
    },
    [
      {
        section: '工作经历',
        before: '参与需求讨论',
        after: '协同业务与研发完成需求澄清',
        reason: '岗位匹配',
        riskWarning: '需补充结果',
      },
    ],
    'concise',
  );

  assert.match(prompt, /优化风格：更简洁/);
  assert.match(prompt, /当前修改对照表/);
  assert.match(prompt, /参与需求讨论/);
  assert.match(prompt, /协同业务与研发完成需求澄清/);
});
