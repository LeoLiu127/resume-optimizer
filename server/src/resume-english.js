function invalidSchema(path) {
  throw new Error(`英文简历结构无效：${path}`);
}

function assertObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalidSchema(path);
  }
}

function assertString(value, path) {
  if (typeof value !== 'string') {
    invalidSchema(path);
  }
}

function assertStringArray(value, path) {
  if (!Array.isArray(value)) {
    invalidSchema(path);
  }
  value.forEach((item, index) => assertString(item, `${path}[${index}]`));
}

function assertExperience(item, path) {
  assertObject(item, path);
  assertString(item.company, `${path}.company`);
  assertString(item.title, `${path}.title`);
  assertString(item.period, `${path}.period`);
  assertStringArray(item.bullets, `${path}.bullets`);
}

function assertProject(item, path) {
  assertObject(item, path);
  assertString(item.name, `${path}.name`);
  assertString(item.period, `${path}.period`);
  assertStringArray(item.bullets, `${path}.bullets`);
}

export function validateEnglishResumeRequest(finalResume) {
  assertObject(finalResume, 'finalResume');
  assertStringArray(finalResume.basic, 'finalResume.basic');
  assertString(finalResume.jobIntention, 'finalResume.jobIntention');
  assertString(finalResume.summary, 'finalResume.summary');
  assertStringArray(finalResume.skills, 'finalResume.skills');
  assertStringArray(finalResume.tools, 'finalResume.tools');
  if (!Array.isArray(finalResume.experience)) {
    invalidSchema('finalResume.experience');
  }
  finalResume.experience.forEach((item, index) => assertExperience(item, `finalResume.experience[${index}]`));
  if (!Array.isArray(finalResume.projects)) {
    invalidSchema('finalResume.projects');
  }
  finalResume.projects.forEach((item, index) => assertProject(item, `finalResume.projects[${index}]`));
  assertString(finalResume.education, 'finalResume.education');
  assertStringArray(finalResume.extras, 'finalResume.extras');
}

function assertSameLength(source, translated, path) {
  if (source.length !== translated.length) {
    invalidSchema(`${path} 数量不一致`);
  }
}

function assertPreservedEntryCounts(source, translated) {
  for (const field of ['basic', 'skills', 'tools', 'experience', 'projects', 'extras']) {
    assertSameLength(source[field], translated[field], `finalResume.${field}`);
  }
  source.experience.forEach((item, index) => {
    assertSameLength(item.bullets, translated.experience[index].bullets, `finalResume.experience[${index}].bullets`);
  });
  source.projects.forEach((item, index) => {
    assertSameLength(item.bullets, translated.projects[index].bullets, `finalResume.projects[${index}].bullets`);
  });
}

function assertRetainedFact(sourceValue, translatedValue, path) {
  if (sourceValue.trim() && !translatedValue.trim()) {
    invalidSchema(`${path} 不可为空`);
  }
}

function assertRetainedStringArray(source, translated, path) {
  source.forEach((value, index) => {
    assertRetainedFact(value, translated[index], `${path}[${index}]`);
  });
}

function assertPreservedNonEmptyFacts(source, translated, sourceRole, translatedRole) {
  assertRetainedFact(sourceRole, translatedRole, 'role');
  for (const field of ['jobIntention', 'summary', 'education']) {
    assertRetainedFact(source[field], translated[field], `finalResume.${field}`);
  }
  for (const field of ['basic', 'skills', 'tools', 'extras']) {
    assertRetainedStringArray(source[field], translated[field], `finalResume.${field}`);
  }
  source.experience.forEach((item, index) => {
    const translatedItem = translated.experience[index];
    for (const field of ['company', 'title', 'period']) {
      assertRetainedFact(item[field], translatedItem[field], `finalResume.experience[${index}].${field}`);
    }
    assertRetainedStringArray(item.bullets, translatedItem.bullets, `finalResume.experience[${index}].bullets`);
  });
  source.projects.forEach((item, index) => {
    const translatedItem = translated.projects[index];
    for (const field of ['name', 'period']) {
      assertRetainedFact(item[field], translatedItem[field], `finalResume.projects[${index}].${field}`);
    }
    assertRetainedStringArray(item.bullets, translatedItem.bullets, `finalResume.projects[${index}].bullets`);
  });
}

function normalizeFinalResume(resume) {
  return {
    basic: [...resume.basic],
    jobIntention: resume.jobIntention,
    summary: resume.summary,
    skills: [...resume.skills],
    tools: [...resume.tools],
    experience: resume.experience.map((item) => ({
      company: item.company,
      title: item.title,
      period: item.period,
      bullets: [...item.bullets],
    })),
    projects: resume.projects.map((item) => ({
      name: item.name,
      period: item.period,
      bullets: [...item.bullets],
    })),
    education: resume.education,
    extras: [...resume.extras],
  };
}

export function normalizeEnglishResume(value, fallback = {}) {
  assertObject(value, 'response');
  assertString(value.role, 'role');
  validateEnglishResumeRequest(value.finalResume);
  validateEnglishResumeRequest(fallback.finalResume);
  assertPreservedEntryCounts(fallback.finalResume, value.finalResume);
  assertPreservedNonEmptyFacts(fallback.finalResume, value.finalResume, fallback.role || '', value.role);

  return {
    role: value.role,
    finalResume: normalizeFinalResume(value.finalResume),
  };
}
