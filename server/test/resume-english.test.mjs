import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeEnglishResume } from '../src/resume-english.js';
import {
  RESUME_ENGLISH_SYSTEM,
  buildResumeEnglishPrompt,
} from '../../src/services/prompts.js';

const source = {
  basic: ['张晨', 'AI产品经理'],
  jobIntention: 'AI产品经理',
  summary: '负责企业产品。',
  skills: ['需求分析', '项目管理'],
  tools: ['Figma'],
  experience: [{ company: 'A科技', title: '产品经理', period: '2021-至今', bullets: ['负责需求', '推进上线'] }],
  projects: [{ name: 'AI助手', period: '2024', bullets: ['完成原型验证'] }],
  education: 'XX大学 本科',
  extras: ['PMP证书'],
};

function translatedResume() {
  return {
    ...source,
    basic: ['Zhang Chen', 'AI Product Manager'],
    jobIntention: 'AI Product Manager',
    summary: 'Enterprise product manager.',
    skills: ['Requirements Analysis', 'Project Management'],
    tools: [...source.tools],
    experience: [{
      company: 'A科技',
      title: 'Product Manager',
      period: '2021-Present',
      bullets: ['Owned requirements', 'Drove launch'],
    }],
    projects: [{ name: 'AI Assistant', period: '2024', bullets: ['Completed prototype validation'] }],
    education: 'XX University, Bachelor of Arts',
    extras: ['PMP Certification'],
  };
}

test('english resume prompt preserves facts and schema', () => {
  const prompt = buildResumeEnglishPrompt(source, 'AI产品经理');
  assert.match(RESUME_ENGLISH_SYSTEM, /Do not invent/i);
  assert.match(RESUME_ENGLISH_SYSTEM, /preserve.*abbreviations/i);
  assert.match(RESUME_ENGLISH_SYSTEM, /name.*original/i);
  assert.match(prompt, /"finalResume"/);
  assert.match(prompt, /A科技/);
});

test('english resume normalization keeps all schema fields', () => {
  const normalized = normalizeEnglishResume({
    finalResume: {
      ...translatedResume(),
    },
    role: 'AI Product Manager',
  }, { finalResume: source, role: 'AI产品经理' });
  assert.equal(normalized.role, 'AI Product Manager');
  assert.equal(normalized.finalResume.basic[0], 'Zhang Chen');
  assert.deepEqual(normalized.finalResume.projects, translatedResume().projects);
});

test('english resume normalization rejects incomplete model schema fields', () => {
  const incomplete = translatedResume();
  delete incomplete.summary;

  assert.throws(
    () => normalizeEnglishResume({ finalResume: incomplete, role: 'AI Product Manager' }, { finalResume: source, role: 'AI产品经理' }),
    /英文简历结构无效/,
  );
});

test('english resume normalization rejects wrong model scalar, array, and nested item types', () => {
  const invalidResponses = [
    { role: { title: 'AI Product Manager' }, finalResume: translatedResume() },
    { role: 'AI Product Manager', finalResume: { ...translatedResume(), skills: 'Requirements Analysis' } },
    { role: 'AI Product Manager', finalResume: { ...translatedResume(), experience: [{ ...translatedResume().experience[0], bullets: 'Owned requirements' }] } },
    { role: 'AI Product Manager', finalResume: { ...translatedResume(), projects: [{}] } },
  ];

  for (const value of invalidResponses) {
    assert.throws(
      () => normalizeEnglishResume(value, { finalResume: source, role: 'AI产品经理' }),
      /英文简历结构无效/,
    );
  }
});

test('english resume normalization rejects translated arrays or bullets that lose source entries', () => {
  const missingSkill = translatedResume();
  missingSkill.skills = ['Requirements Analysis'];
  const missingBullet = translatedResume();
  missingBullet.experience[0].bullets = ['Owned requirements'];

  for (const finalResume of [missingSkill, missingBullet]) {
    assert.throws(
      () => normalizeEnglishResume({ finalResume, role: 'AI Product Manager' }, { finalResume: source, role: 'AI产品经理' }),
      /英文简历结构无效/,
    );
  }
});

test('english resume normalization rejects empty translated facts that are nonempty in the source', () => {
  const mutations = [
    (response) => { response.role = '   '; },
    (response) => { response.finalResume.jobIntention = '   '; },
    (response) => { response.finalResume.summary = ''; },
    (response) => { response.finalResume.education = '  '; },
    (response) => { response.finalResume.basic[0] = ''; },
    (response) => { response.finalResume.skills[0] = '   '; },
    (response) => { response.finalResume.tools[0] = ''; },
    (response) => { response.finalResume.extras[0] = ' '; },
    (response) => { response.finalResume.experience[0].company = ''; },
    (response) => { response.finalResume.experience[0].title = ' '; },
    (response) => { response.finalResume.experience[0].period = ''; },
    (response) => { response.finalResume.experience[0].bullets[0] = ' '; },
    (response) => { response.finalResume.projects[0].name = ''; },
    (response) => { response.finalResume.projects[0].period = ' '; },
    (response) => { response.finalResume.projects[0].bullets[0] = ''; },
  ];

  for (const mutate of mutations) {
    const response = { role: 'AI Product Manager', finalResume: translatedResume() };
    mutate(response);
    assert.throws(
      () => normalizeEnglishResume(response, { finalResume: source, role: 'AI产品经理' }),
      /英文简历结构无效/,
    );
  }
});

test('english resume normalization permits empty translated facts when the source fact is empty', () => {
  const emptySource = { ...source, summary: '' };
  const translated = translatedResume();
  translated.summary = '   ';

  assert.doesNotThrow(() => normalizeEnglishResume(
    { role: '', finalResume: translated },
    { finalResume: emptySource, role: '' },
  ));
});

test('english resume normalization rejects a response without finalResume', () => {
  assert.throws(
    () => normalizeEnglishResume({ role: 'AI Product Manager' }, { finalResume: source, role: 'AI产品经理' }),
    /英文简历结构无效/,
  );
});
