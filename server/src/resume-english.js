function asString(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function normalizeFinalResume(resume) {
  const basic = asArray(resume?.basic).map((value) => asString(value)).filter(Boolean);
  return {
    basic,
    jobIntention: asString(resume?.jobIntention),
    summary: asString(resume?.summary),
    skills: asArray(resume?.skills).map((value) => asString(value)).filter(Boolean).slice(0, 12),
    tools: asArray(resume?.tools).map((value) => asString(value)).filter(Boolean).slice(0, 12),
    experience: asArray(resume?.experience)
      .map((item) => ({
        company: asString(item?.company),
        title: asString(item?.title),
        period: asString(item?.period),
        bullets: asArray(item?.bullets).map((value) => asString(value)).filter(Boolean).slice(0, 6),
      }))
      .filter((item) => item.company || item.title || item.bullets.length),
    projects: asArray(resume?.projects)
      .map((item) => ({
        name: asString(item?.name),
        period: asString(item?.period),
        bullets: asArray(item?.bullets).map((value) => asString(value)).filter(Boolean).slice(0, 6),
      }))
      .filter((item) => item.name || item.bullets.length),
    education: asString(resume?.education),
    extras: asArray(resume?.extras).map((value) => asString(value)).filter(Boolean).slice(0, 6),
  };
}

export function normalizeEnglishResume(value, fallback = {}) {
  if (!value?.finalResume || typeof value.finalResume !== 'object' || Array.isArray(value.finalResume)) {
    throw new Error('英文简历结构无效：缺少 finalResume');
  }

  return {
    role: asString(value.role, asString(fallback.role)),
    finalResume: normalizeFinalResume(value.finalResume),
  };
}
