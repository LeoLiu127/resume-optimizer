export const LANGUAGES = [
  { key: 'zh', label: '中文简历', shortLabel: '中文' },
  { key: 'en', label: 'English Resume', shortLabel: 'EN' },
];

function sortKeysRecursively(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysRecursively);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeysRecursively(value[key])]),
    );
  }
  return value;
}

export function createEnglishCacheKey(finalResume, role) {
  return JSON.stringify(sortKeysRecursively({ finalResume, role }));
}

export function buildLocalizedAnalysis(analysis, englishPayload) {
  return {
    ...analysis,
    summary: {
      ...analysis?.summary,
      role: englishPayload.role,
    },
    finalResume: englishPayload.finalResume,
  };
}
