import test from 'node:test';
import assert from 'node:assert/strict';

import { buildResumeView } from '../../src/utils/resumeData.js';

function analysisWithBasic(basic) {
  return {
    finalResume: {
      basic,
      jobIntention: '',
      summary: '',
      skills: [],
      tools: [],
      experience: [],
      projects: [{
        name: 'Marketplace Copilot',
        period: '2023 - 2024',
        bullets: ['Designed the review model.'],
      }],
      education: '',
      extras: [],
    },
  };
}

test('English basic fields parse labeled contact facts without treating location as headline', () => {
  const view = buildResumeView(analysisWithBasic([
    'Alex Chen',
    'AI Product Manager',
    'Email: alex.chen@example.com',
    'Phone: +86 138 0000 0000',
    'Location: Shanghai, China',
  ]));

  assert.equal(view.name, 'Alex Chen');
  assert.equal(view.headline, 'AI Product Manager');
  assert.equal(view.email, 'alex.chen@example.com');
  assert.equal(view.phone, '+86 138 0000 0000');
  assert.equal(view.location, 'Shanghai, China');
});

test('Chinese basic field parsing remains compatible', () => {
  const view = buildResumeView(analysisWithBasic([
    '张晨',
    '产品经理',
    '邮箱：zhangchen@example.com',
    '电话：138 0000 0000',
    '所在地：上海',
  ]));

  assert.equal(view.headline, '产品经理');
  assert.equal(view.email, 'zhangchen@example.com');
  assert.equal(view.phone, '138 0000 0000');
  assert.equal(view.location, '上海');
});

test('normalized projects preserve their period', () => {
  const view = buildResumeView(analysisWithBasic(['Alex Chen']));

  assert.deepEqual(view.projects[0], {
    name: 'Marketplace Copilot',
    period: '2023 - 2024',
    bullets: ['Designed the review model.'],
  });
});
