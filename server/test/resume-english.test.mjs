import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeEnglishResume } from '../src/resume-english.js';
import {
  RESUME_ENGLISH_SYSTEM,
  buildResumeEnglishPrompt,
} from '../../src/services/prompts.js';

const source = {
  basic: ['张晨', 'AI产品经理'],
  summary: '负责企业产品。',
  skills: ['需求分析'],
  tools: ['Figma'],
  experience: [{ company: 'A科技', title: '产品经理', period: '2021-至今', bullets: ['负责需求'] }],
  projects: [],
  education: 'XX大学 本科',
  extras: [],
};

test('english resume prompt preserves facts and schema', () => {
  const prompt = buildResumeEnglishPrompt(source, 'AI产品经理');
  assert.match(RESUME_ENGLISH_SYSTEM, /Do not invent/i);
  assert.match(prompt, /"finalResume"/);
  assert.match(prompt, /A科技/);
});

test('english resume normalization keeps all schema fields', () => {
  const normalized = normalizeEnglishResume({
    finalResume: {
      ...source,
      basic: ['Zhang Chen', 'AI Product Manager'],
      summary: 'Enterprise product manager.',
    },
    role: 'AI Product Manager',
  }, { finalResume: source, role: 'AI产品经理' });
  assert.equal(normalized.role, 'AI Product Manager');
  assert.equal(normalized.finalResume.basic[0], 'Zhang Chen');
  assert.deepEqual(normalized.finalResume.projects, []);
});

test('english resume normalization rejects a response without finalResume', () => {
  assert.throws(
    () => normalizeEnglishResume({ role: 'AI Product Manager' }, { finalResume: source, role: 'AI产品经理' }),
    /英文简历结构无效/,
  );
});
